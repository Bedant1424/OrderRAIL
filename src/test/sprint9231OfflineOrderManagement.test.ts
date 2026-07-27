import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NetworkManager,
  OperationExecutor,
  SyncManager,
  ConflictDetector,
  OfflineEventBus,
  clearAllOperations,
  getAllOperations,
} from "@/lib/offline";
import { OrderService, orderIdMapping } from "@/lib/orders/orderService";

describe("Sprint 9.2.3.1 — Offline Order Management Tests", () => {
  beforeEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    ConflictDetector.clearConflicts();
    OfflineEventBus.removeAllListeners();
    orderIdMapping.clear();
  });

  afterEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    OfflineEventBus.removeAllListeners();
    orderIdMapping.clear();
  });

  it("1. Offline Order Creation: Support creating new orders while offline with temporary IDs", async () => {
    NetworkManager.forceOffline();

    const result = await OrderService.createOrder({
      cafe_id: "cafe-101",
      table_id: "tbl-5",
      dining_session_id: "sess-999",
      total_cents: 2500,
      status: "kot_sent",
      items: [
        { menu_item_id: "item-1", name: "Artisan Burger", price_cents: 1500, qty: 1 },
        { menu_item_id: "item-2", name: "Fries", price_cents: 1000, qty: 1 },
      ],
    });

    expect(result.queued).toBe(true);
    expect(result.status).toBe("Queued");
    expect(result.orderId).toContain("temp_ord_");

    const queuedView = await OrderService.getQueuedOfflineOrders();
    expect(queuedView.length).toBe(1);
    expect(queuedView[0].id).toBe(result.orderId);
    expect(queuedView[0].syncState).toBe("Pending Sync");
    expect(queuedView[0].table_id).toBe("tbl-5");
    expect(queuedView[0].dining_session_id).toBe("sess-999");
  });

  it("2. Offline Order Modification: Support updating items, quantity, notes offline", async () => {
    NetworkManager.forceOffline();

    const created = await OrderService.createOrder({
      cafe_id: "cafe-101",
      table_id: "tbl-2",
      dining_session_id: "sess-888",
      total_cents: 1000,
      items: [{ menu_item_id: "item-1", name: "Cold Brew", price_cents: 1000, qty: 1 }],
    });

    // Edit offline order
    const editRes = await OrderService.editOrder({
      orderId: created.orderId,
      items: [
        { id: "item-1", menu_item_id: "item-1", name: "Cold Brew", price_cents: 1000, qty: 2, note: "Extra ice" },
      ],
      notes: "Customer requested extra ice",
    });

    expect(editRes.queued).toBe(true);

    const queuedView = await OrderService.getQueuedOfflineOrders();
    expect(queuedView.length).toBe(1);
    expect(queuedView[0].items[0].qty).toBe(2);
    expect(queuedView[0].total_cents).toBe(2000);
    expect(queuedView[0].note).toBe("Customer requested extra ice");
  });

  it("3. Offline Order Cancellation: Support cancelling an un-synchronized order offline", async () => {
    NetworkManager.forceOffline();

    const created = await OrderService.createOrder({
      cafe_id: "cafe-101",
      table_id: "tbl-3",
      dining_session_id: "sess-777",
      total_cents: 1200,
      items: [{ menu_item_id: "item-5", name: "Pizza", price_cents: 1200, qty: 1 }],
    });

    const cancelRes = await OrderService.cancelOrder(created.orderId, "staff");
    expect(cancelRes.queued).toBe(true);

    const queuedView = await OrderService.getQueuedOfflineOrders();
    expect(queuedView.length).toBe(1);
    expect(queuedView[0].status).toBe("cancelled");
  });

  it("4. Queue Persistence: Offline operations survive page refresh & browser restart", async () => {
    NetworkManager.forceOffline();

    await OrderService.createOrder({
      cafe_id: "cafe-101",
      table_id: "tbl-4",
      total_cents: 800,
      items: [{ menu_item_id: "item-10", name: "Espresso", price_cents: 800, qty: 1 }],
    });

    // Simulate page refresh by fetching operations directly from IndexedDB store
    const opsInDb = await getAllOperations();
    expect(opsInDb.length).toBe(1);
    expect(opsInDb[0].operationType).toBe("CREATE_ORDER");

    const reloadedView = await OrderService.getQueuedOfflineOrders();
    expect(reloadedView.length).toBe(1);
    expect(reloadedView[0].items[0].name).toBe("Espresso");
  });

  it("5. Automatic Synchronization: Flushes FIFO queue upon network reconnection", async () => {
    const executedOps: string[] = [];

    // Register test mock handlers
    OperationExecutor.registerHandler("CREATE_ORDER", async (payload: any) => {
      executedOps.push(`CREATE:${payload.id}`);
      return { orderId: payload.id };
    });

    OperationExecutor.registerHandler("EDIT_ORDER", async (payload: any) => {
      executedOps.push(`EDIT:${payload.orderId}`);
      return { success: true };
    });

    NetworkManager.forceOffline();

    const o1 = await OrderService.createOrder({
      cafe_id: "cafe-101",
      table_id: "tbl-1",
      total_cents: 500,
      items: [{ name: "Tea", price_cents: 500, qty: 1 }],
    });

    await OrderService.editOrder({
      orderId: o1.orderId,
      items: [{ name: "Tea", price_cents: 500, qty: 2 }],
    });

    const pendingBefore = await getAllOperations();
    expect(pendingBefore.length).toBe(2);

    // Reconnect network
    NetworkManager.forceOnline();
    const syncRes = await SyncManager.startSync();

    expect(syncRes.success).toBe(true);
    expect(syncRes.processed).toBe(2);
    expect(executedOps).toEqual([`CREATE:${o1.orderId}`, `EDIT:${o1.orderId}`]);

    const pendingAfter = await getAllOperations();
    expect(pendingAfter.length).toBe(0);
  });

  it("6. Temporary ID Strategy: Server ID mapping replaces temporary local IDs", async () => {
    const SERVER_ASSIGNED_ID = "ord_srv_99999";

    OperationExecutor.registerHandler("CREATE_ORDER", async (payload: any) => {
      // Map temp ID to real server ID
      orderIdMapping.set(payload.id, SERVER_ASSIGNED_ID);
      return { orderId: SERVER_ASSIGNED_ID };
    });

    OperationExecutor.registerHandler("EDIT_ORDER", async (payload: any) => {
      const realId = orderIdMapping.get(payload.orderId) || payload.orderId;
      expect(realId).toBe(SERVER_ASSIGNED_ID);
      return { success: true };
    });

    NetworkManager.forceOffline();

    const created = await OrderService.createOrder({
      cafe_id: "cafe-101",
      table_id: "tbl-1",
      total_cents: 1000,
      items: [{ name: "Latte", price_cents: 1000, qty: 1 }],
    });

    await OrderService.editOrder({
      orderId: created.orderId,
      items: [{ name: "Latte", price_cents: 1000, qty: 2 }],
    });

    NetworkManager.forceOnline();
    const syncRes = await SyncManager.startSync();
    expect(syncRes.success).toBe(true);
    expect(orderIdMapping.get(created.orderId)).toBe(SERVER_ASSIGNED_ID);
  });

  it("7. Duplicate Prevention: Idempotency keys prevent duplicate order execution", async () => {
    const handlerCallCount = { count: 0 };

    OperationExecutor.registerHandler("CREATE_ORDER", async (payload: any) => {
      handlerCallCount.count++;
      return { orderId: payload.id };
    });

    NetworkManager.forceOffline();

    const res1 = await OrderService.createOrder({
      id: "temp_fixed_id_100",
      cafe_id: "cafe-101",
      table_id: "tbl-1",
      total_cents: 1000,
      items: [{ name: "Coffee", price_cents: 1000, qty: 1 }],
    });

    // Attempt second creation with same ID
    const res2 = await OrderService.createOrder({
      id: "temp_fixed_id_100",
      cafe_id: "cafe-101",
      table_id: "tbl-1",
      total_cents: 1000,
      items: [{ name: "Coffee", price_cents: 1000, qty: 1 }],
    });

    expect(res1.orderId).toBe(res2.orderId);

    NetworkManager.forceOnline();
    await SyncManager.startSync();

    expect(handlerCallCount.count).toBe(1); // Handler executed exactly once
  });

  it("8. Failure Handling & Manual Retry: Operations remain in queue on error and retry cleanly", async () => {
    let attempts = 0;

    OperationExecutor.registerHandler("CREATE_ORDER", async (payload: any) => {
      attempts++;
      if (attempts === 1) {
        throw new Error("Server temporary 500 internal error");
      }
      return { orderId: payload.id };
    });

    NetworkManager.forceOffline();

    await OrderService.createOrder({
      cafe_id: "cafe-101",
      table_id: "tbl-1",
      total_cents: 900,
      items: [{ name: "Sandwich", price_cents: 900, qty: 1 }],
    });

    NetworkManager.forceOnline();

    // First sync attempt fails
    const sync1 = await SyncManager.startSync();
    expect(sync1.success).toBe(false);

    const opsAfterFail = await getAllOperations();
    expect(opsAfterFail.length).toBe(1);
    expect(opsAfterFail[0].status).toBe("Retrying");

    // Second sync attempt (manual retry) succeeds
    const sync2 = await SyncManager.startSync();
    expect(sync2.success).toBe(true);
    expect(sync2.processed).toBe(1);

    const opsAfterSuccess = await getAllOperations();
    expect(opsAfterSuccess.length).toBe(0);
  });
});
