import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, renderHook, act } from "@testing-library/react";
import { supabase } from "@/lib/db";
import { CounterCacheService } from "@/windows-pos/services/counterCacheService";
import { CounterOrderBuilderService, type BuildCounterOrderParams } from "@/windows-pos/services/counterOrderBuilderService";
import { MockCounterPrinter } from "@/windows-pos/services/printer/counterPrinter";
import { NetworkManager } from "@/lib/offline/networkManager";
import { SyncManager } from "@/lib/offline/syncManager";
import { OperationExecutor } from "@/lib/offline/operationExecutor";
import {
  enqueueOperation,
  getPendingOperations,
  clearAllOperations,
  getPendingCount,
} from "@/lib/offline/indexedDbQueue";
import { CounterHeader } from "@/windows-pos/components/CounterHeader";
import { useCounterRealtime } from "@/windows-pos/hooks/useCounterRealtime";
import * as syncService from "@/windows-pos/services/counterSyncService";

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    supabase: {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      channel: vi.fn(),
      removeChannel: vi.fn(),
    },
  };
});

describe("Milestone 5 — Local-First & Temporary Offline Resilience Tests", () => {
  const testCafeId = "8c418a5a-7cd4-4054-8a88-f412c1762f7d";
  let mockPrinter: MockCounterPrinter;
  const capturedDbOrders: any[] = [];

  const sampleItems = [
    {
      id: "cart-item-1",
      menuItemId: "item-pizza-1",
      name: "Farmhouse Pizza",
      priceCents: 29900,
      qty: 1,
    },
    {
      id: "cart-item-2",
      menuItemId: "item-drink-1",
      name: "Cold Coffee",
      priceCents: 12000,
      qty: 2,
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedDbOrders.length = 0;
    mockPrinter = new MockCounterPrinter();
    CounterCacheService.clearAll(testCafeId);
    await clearAllOperations();
    NetworkManager.resetForceOverride();

    // Configure mock DB operations
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => {
          if (table === "orders") {
            const last = capturedDbOrders[capturedDbOrders.length - 1];
            if (!last) return { data: null, error: null };
            return {
              data: {
                ...last,
                daily_order_number: 99,
                order_items: sampleItems.map((it) => ({
                  id: it.id,
                  menu_item_id: it.menuItemId,
                  name: it.name,
                  price_cents: it.priceCents,
                  qty: it.qty,
                })),
              },
              error: null,
            };
          }
          if (table === "dining_sessions") {
            return { data: { status: "active" }, error: null };
          }
          return { data: null, error: null };
        }),
        insert: vi.fn().mockImplementation(async (payload: any) => {
          if (table === "orders") {
            capturedDbOrders.push(payload);
          }
          return { data: payload, error: null };
        }),
        update: vi.fn().mockReturnThis(),
      };
      return builder;
    });

    // Mock channel for realtime
    const mockChannel: any = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockImplementation((cb: (s: string) => void) => {
        cb("SUBSCRIBED");
        return mockChannel;
      }),
    };
    vi.mocked(supabase.channel).mockReturnValue(mockChannel);
  });

  afterEach(async () => {
    NetworkManager.resetForceOverride();
    CounterCacheService.clearAll(testCafeId);
    await clearAllOperations();
  });

  it("1. Persists and loads counter state cache across restarts", () => {
    const mockState: syncService.LoadedCounterState = {
      tables: [
        {
          id: "t-1",
          label: "Table 1",
          status: "occupied",
          activeSessionId: "s-1",
          sessionStartedAt: "2026-09-16T10:00:00.000Z",
          orders: [],
          unbilledTotalCents: 5000,
        },
      ],
      channelOrders: [
        {
          id: "ord-tk-1",
          orderNumber: 101,
          tableId: null,
          diningSessionId: null,
          status: "preparing",
          orderSource: "TAKEAWAY",
          createdAt: "2026-09-16T10:05:00.000Z",
          totalCents: 2500,
          items: [],
        },
      ],
      lastSyncedAt: new Date("2026-09-16T10:10:00.000Z"),
    };

    CounterCacheService.saveCounterStateCache(testCafeId, mockState);

    const loaded = CounterCacheService.loadCounterStateCache(testCafeId);
    expect(loaded).not.toBeNull();
    expect(loaded!.tables).toHaveLength(1);
    expect(loaded!.tables[0].label).toBe("Table 1");
    expect(loaded!.channelOrders).toHaveLength(1);
    expect(loaded!.channelOrders[0].orderSource).toBe("TAKEAWAY");
    expect(loaded!.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("2. Persists and retrieves menu catalog in local cache", () => {
    const mockCategories = [{ id: "cat-1", name: "Pizzas" }];
    const mockItems = [{ id: "item-1", name: "Cheese Pizza", price_cents: 20000 }];

    CounterCacheService.saveMenuCache(testCafeId, mockCategories, mockItems);

    const cached = CounterCacheService.loadMenuCache(testCafeId);
    expect(cached).not.toBeNull();
    expect(cached!.categories).toHaveLength(1);
    expect(cached!.categories[0].name).toBe("Pizzas");
    expect(cached!.items).toHaveLength(1);
    expect(cached!.items[0].name).toBe("Cheese Pizza");
  });

  it("3. Draft cart persists, reloads, and clears cleanly", () => {
    CounterCacheService.saveCounterCartDraft(testCafeId, {
      cafeId: testCafeId,
      channel: "DINE_IN",
      tableId: "t-1",
      customerName: "Rohan",
      orderNote: "Less spicy",
      items: sampleItems,
    });

    const draft = CounterCacheService.loadCounterCartDraft(testCafeId);
    expect(draft).not.toBeNull();
    expect(draft!.channel).toBe("DINE_IN");
    expect(draft!.customerName).toBe("Rohan");
    expect(draft!.items).toHaveLength(2);

    CounterCacheService.clearCounterCartDraft(testCafeId);
    const clearedDraft = CounterCacheService.loadCounterCartDraft(testCafeId);
    expect(clearedDraft).toBeNull();
  });

  it("4. Offline counter order creation enters pending-sync queue with PENDING_SYNC status and prints offline KOT", async () => {
    NetworkManager.forceOffline();
    expect(NetworkManager.isOnline()).toBe(false);

    const params: BuildCounterOrderParams = {
      cafeId: testCafeId,
      orderSource: "TAKEAWAY",
      items: sampleItems,
      customerName: "Meera",
      printer: mockPrinter,
    };

    const result = await CounterOrderBuilderService.submitOrder(params, "Cheese Corner");

    expect(result.success).toBe(true);
    expect(result.isOffline).toBe(true);
    expect(result.syncStatus).toBe("PENDING_SYNC");
    expect(result.orderId).toBeDefined();
    expect(typeof result.orderId).toBe("string");
    expect(result.orderId.length).toBeGreaterThan(10);

    // Verified offline KOT generation
    expect(result.kot).toBeDefined();
    expect(result.kot!.text).toContain("[OFFLINE ORDER - PENDING SYNC]");
    expect(result.printResult?.status).toBe("ACCEPTED_FOR_TEST_PRINT");
    expect(mockPrinter.getHistory()).toHaveLength(1);

    // Verified pending queue insertion
    const pending = await getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0].operationType).toBe("CREATE_ORDER");
    expect(pending[0].status).toBe("Queued");
    expect(pending[0].payload.customer_name).toBe("Meera");
    expect(pending[0].payload.order_source).toBe("TAKEAWAY");
  });

  it("5. Network restoration triggers sync and successfully drains the offline queue", async () => {
    // 1. Create offline order
    NetworkManager.forceOffline();
    await CounterOrderBuilderService.submitOrder(
      {
        cafeId: testCafeId,
        orderSource: "SWIGGY",
        items: sampleItems,
        externalOrderRef: "SWG-OFF-1",
        printer: mockPrinter,
      },
      "Cheese Corner"
    );

    expect(await getPendingCount()).toBe(1);

    // 2. Restore network and execute sync
    NetworkManager.forceOnline();
    expect(NetworkManager.isOnline()).toBe(true);

    const syncResult = await SyncManager.startSync();
    expect(syncResult.success).toBe(true);
    expect(syncResult.processed).toBe(1);

    // 3. Verify queue is now clean
    const remainingOps = await getPendingOperations();
    expect(remainingOps).toHaveLength(0);
    expect(await getPendingCount()).toBe(0);

    // 4. Verify DB received the order
    expect(capturedDbOrders).toHaveLength(1);
    expect(capturedDbOrders[0].external_order_ref).toBe("SWG-OFF-1");
  });

  it("6. Failed sync remains queued with Retrying state and incremented retryCount", async () => {
    // Enqueue an invalid operation directly to simulate backend rejection
    await enqueueOperation({
      operationId: "fail-op-1",
      operationType: "CREATE_ORDER",
      payload: { cafe_id: testCafeId, invalid_data: true },
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: "Queued",
      idempotencyKey: "test_fail_idempotency_1",
    });

    // Mock handler to reject
    const originalHandler = OperationExecutor.getHandler("CREATE_ORDER");
    OperationExecutor.registerHandler("CREATE_ORDER", async () => {
      throw new Error("Simulated 500 Network Database Conflict");
    });

    try {
      NetworkManager.forceOnline();
      const syncResult = await SyncManager.startSync();
      expect(syncResult.success).toBe(false);

      const pending = await getPendingOperations();
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe("Retrying");
      expect(pending[0].retryCount).toBe(1);
      expect(pending[0].error).toContain("Simulated 500");
    } finally {
      if (originalHandler) {
        OperationExecutor.registerHandler("CREATE_ORDER", originalHandler);
      }
    }
  });

  it("7. Idempotency key prevents duplicate operations in the offline queue", async () => {
    NetworkManager.forceOffline();

    const idempotencyKey = "order_idemp_key_unique_test";

    // Dispatch 1st time
    await OperationExecutor.dispatch(
      "CREATE_ORDER",
      { id: "temp-order-1", cafe_id: testCafeId, items: [] },
      { idempotencyKey, forceQueue: true }
    );

    // Dispatch 2nd time with exact same idempotencyKey
    await OperationExecutor.dispatch(
      "CREATE_ORDER",
      { id: "temp-order-1", cafe_id: testCafeId, items: [] },
      { idempotencyKey, forceQueue: true }
    );

    const pending = await getPendingOperations();
    expect(pending).toHaveLength(1);
  });

  it("8. Reconnect authoritative reconciliation brings in customer QR orders created while counter was offline", async () => {
    // Mock loadActiveCounterState returning orders from Supabase (including a customer Dine-In QR order)
    const customerQrOrder = {
      id: "cust-qr-ord-99",
      orderNumber: 202,
      tableId: "t-qr-1",
      diningSessionId: "session-qr-1",
      status: "pending",
      orderSource: "DINE_IN" as const,
      createdAt: new Date().toISOString(),
      totalCents: 45000,
      customerName: "Rahul Customer (QR)",
      customerPhone: "+919888877777",
      items: [],
    };

    const spy = vi.spyOn(syncService, "loadActiveCounterState").mockResolvedValue({
      tables: [
        {
          id: "t-qr-1",
          label: "Table 4",
          status: "occupied",
          activeSessionId: "session-qr-1",
          sessionStartedAt: new Date().toISOString(),
          orders: [customerQrOrder],
          unbilledTotalCents: 45000,
        },
      ],
      channelOrders: [],
      lastSyncedAt: new Date(),
    });

    try {
      const state = await syncService.loadActiveCounterState(testCafeId);
      expect(state.tables[0].orders).toHaveLength(1);
      expect(state.tables[0].orders[0].customerName).toBe("Rahul Customer (QR)");
      expect(state.tables[0].orders[0].orderSource).toBe("DINE_IN");
    } finally {
      spy.mockRestore();
    }
  });

  it("9. CounterHeader UI displays connected, offline, and pending sync count correctly", () => {
    // 9a: Connected with 0 pending
    const { rerender } = render(
      <CounterHeader
        cafeName="Cheese Corner"
        connectionStatus="connected"
        lastSyncedAt={new Date()}
        isLoading={false}
        onRefresh={() => {}}
        activeChannel="DINE_IN"
        onSelectChannel={() => {}}
        onOpenNewOrder={() => {}}
        pendingSyncCount={0}
      />
    );

    expect(screen.getByText(/Live Realtime/i)).toBeDefined();
    expect(screen.queryByText(/waiting to sync/i)).toBeNull();

    // 9b: Offline with 3 pending sync orders
    rerender(
      <CounterHeader
        cafeName="Cheese Corner"
        connectionStatus="offline"
        lastSyncedAt={null}
        isLoading={false}
        onRefresh={() => {}}
        activeChannel="DINE_IN"
        onSelectChannel={() => {}}
        onOpenNewOrder={() => {}}
        pendingSyncCount={3}
      />
    );

    expect(screen.getByText(/Offline/i)).toBeDefined();
    expect(screen.getByText(/3 waiting to sync/i)).toBeDefined();
  });

  it("10. useCounterRealtime hook overlays queued offline orders during disconnection", async () => {
    // Enqueue an offline takeaway order
    await enqueueOperation({
      operationId: "offline-op-tk-99",
      operationType: "CREATE_ORDER",
      payload: {
        id: "temp-counter-ord-tk-99",
        cafe_id: testCafeId,
        order_source: "TAKEAWAY",
        status: "preparing",
        total_cents: 18000,
        customer_name: "Priya",
        items: [],
      },
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: "Queued",
      idempotencyKey: "idemp_tk_99",
    });

    const spy = vi.spyOn(syncService, "loadActiveCounterState").mockResolvedValue({
      tables: [],
      channelOrders: [],
      lastSyncedAt: new Date(),
    });

    try {
      const { result } = renderHook(() => useCounterRealtime(testCafeId));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.pendingSyncCount).toBe(1);
      expect(result.current.channelOrders).toHaveLength(1);
      expect(result.current.channelOrders[0].id).toBe("temp-counter-ord-tk-99");
      expect(result.current.channelOrders[0].syncStatus).toBe("PENDING_SYNC");
      expect(result.current.channelOrders[0].isOfflineCreated).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("11. Idempotent retry recovery succeeds without 23505 error when order was already committed on server", async () => {
    NetworkManager.resetForceOverride();
    const existingOrderId = "c4992dc7-8fb7-4467-9c96-6e580e227911";

    // Simulate that the order already exists in Supabase (e.g. committed during a previous timed-out attempt)
    capturedDbOrders.push({
      id: existingOrderId,
      cafe_id: testCafeId,
      order_source: "TAKEAWAY",
      total_cents: 29900,
      status: "preparing",
    });

    // Mock insert attempting to re-insert the same UUID and encountering Postgres 23505 error
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => {
          if (table === "orders") {
            const found = capturedDbOrders.find((o) => o.id === existingOrderId);
            if (found) {
              return {
                data: {
                  ...found,
                  daily_order_number: 77,
                  order_items: sampleItems.map((it) => ({
                    id: it.id,
                    menu_item_id: it.menuItemId,
                    name: it.name,
                    price_cents: it.priceCents,
                    qty: it.qty,
                  })),
                },
                error: null,
              };
            }
          }
          return { data: null, error: null };
        }),
        insert: vi.fn().mockImplementation(async (payload: any) => {
          if (table === "orders") {
            // Simulate Postgres 23505 duplicate key on retry
            return {
              data: null,
              error: {
                code: "23505",
                message: 'duplicate key value violates unique constraint "orders_pkey"',
                details: `Key (id)=(${existingOrderId}) already exists.`,
              },
            };
          }
          return { data: payload, error: null };
        }),
        update: vi.fn().mockReturnThis(),
      };
      return builder;
    });

    // Queue operation for retrying
    const op = {
      operationId: "retry-op-123",
      operationType: "CREATE_ORDER",
      payload: {
        id: existingOrderId,
        cafe_id: testCafeId,
        order_source: "TAKEAWAY",
        total_cents: 29900,
        status: "preparing",
        items: sampleItems,
      },
      createdAt: new Date().toISOString(),
      retryCount: 1,
      status: "Retrying" as const,
      idempotencyKey: `create_order_${existingOrderId}`,
    };

    await enqueueOperation(op);

    // Sync queue
    const syncResult = await SyncManager.startSync();
    expect(syncResult.success).toBe(true);
    expect(syncResult.processed).toBe(1);

    // Queue should now be drained (operation completed)
    const remaining = await getPendingOperations();
    expect(remaining).toHaveLength(0);
  });

  it("12. Offline Dine-In order preserves active dining session and attaches cleanly upon reconnect", async () => {
    NetworkManager.forceOffline();
    const activeSessionId = "d7890abc-1234-4567-89ab-cdef01234567";
    const tableId = "table-uuid-dinein-4";

    // 1. Submit Dine-In order while terminal is offline
    const offlineResult = await CounterOrderBuilderService.submitOrder({
      cafeId: testCafeId,
      orderSource: "DINE_IN",
      tableId,
      diningSessionId: activeSessionId,
      tableLabel: "Table 4",
      customerName: "Vikas Dine-In",
      items: sampleItems,
      status: "preparing",
      printer: mockPrinter,
    });

    expect(offlineResult.success).toBe(true);
    expect(offlineResult.isOffline).toBe(true);
    expect(offlineResult.syncStatus).toBe("PENDING_SYNC");
    expect(offlineResult.tableId).toBe(tableId);
    expect(offlineResult.diningSessionId).toBe(activeSessionId);

    // 2. Verify queue payload contains diningSessionId
    const pendingOps = await getPendingOperations();
    expect(pendingOps).toHaveLength(1);
    const queuedOrderOp = pendingOps[0];
    expect(queuedOrderOp.operationType).toBe("CREATE_ORDER");
    expect(queuedOrderOp.payload.table_id).toBe(tableId);
    expect(queuedOrderOp.payload.dining_session_id).toBe(activeSessionId);
    expect(queuedOrderOp.payload.order_source).toBe("DINE_IN");

    // 3. Track dining_sessions calls during reconnect
    let createdNewSession = false;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => {
          if (table === "orders") {
            const last = capturedDbOrders[capturedDbOrders.length - 1];
            if (!last) return { data: null, error: null };
            return {
              data: {
                ...last,
                daily_order_number: 88,
                order_items: sampleItems.map((it) => ({
                  id: it.id,
                  menu_item_id: it.menuItemId,
                  name: it.name,
                  price_cents: it.priceCents,
                  qty: it.qty,
                })),
              },
              error: null,
            };
          }
          if (table === "dining_sessions") {
            return { data: { id: activeSessionId, status: "active" }, error: null };
          }
          return { data: null, error: null };
        }),
        insert: vi.fn().mockImplementation(async (payload: any) => {
          if (table === "orders") {
            capturedDbOrders.push(payload);
          }
          if (table === "dining_sessions") {
            createdNewSession = true;
          }
          return { data: payload, error: null };
        }),
        update: vi.fn().mockReturnThis(),
      };
      return builder;
    });

    // 4. Reconnect network and trigger sync
    NetworkManager.resetForceOverride();
    const syncRes = await SyncManager.startSync();
    expect(syncRes.success).toBe(true);

    // 5. Server order must have attached to the existing active session without creating a new session
    expect(capturedDbOrders).toHaveLength(1);
    expect(capturedDbOrders[0].dining_session_id).toBe(activeSessionId);
    expect(capturedDbOrders[0].table_id).toBe(tableId);
    expect(capturedDbOrders[0].order_source).toBe("DINE_IN");
    expect(createdNewSession).toBe(false);
  });
});
