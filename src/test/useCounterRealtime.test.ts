import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { supabase } from "@/lib/db";
import { useCounterRealtime } from "@/windows-pos/hooks/useCounterRealtime";
import * as syncService from "@/windows-pos/services/counterSyncService";

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    supabase: {
      from: vi.fn(),
      channel: vi.fn(),
      removeChannel: vi.fn(),
    },
  };
});

describe("useCounterRealtime Hook Tests", () => {
  const testCafeId = "8c418a5a-7cd4-4054-8a88-f412c1762f7d";

  let channelHandlers: Record<string, Function> = {};
  let subscribeStatusCallback: ((status: string) => void) | null = null;
  let loadActiveCounterStateSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    channelHandlers = {};
    subscribeStatusCallback = null;

    loadActiveCounterStateSpy = vi.spyOn(syncService, "loadActiveCounterState").mockResolvedValue({
      tables: [
        {
          id: "t1",
          label: "Table 1",
          status: "available",
          activeSessionId: null,
          sessionStartedAt: null,
          orders: [],
          unbilledTotalCents: 0,
        },
        {
          id: "t2",
          label: "Table 2",
          status: "occupied",
          activeSessionId: "sess-2",
          sessionStartedAt: "2026-09-16T09:00:00.000Z",
          orders: [
            {
              id: "ord-1",
              orderNumber: 101,
              tableId: "t2",
              diningSessionId: "sess-2",
              status: "pending",
              orderSource: "DINE_IN",
              createdAt: "2026-09-16T09:05:00.000Z",
              totalCents: 1500,
              items: [],
            },
          ],
          unbilledTotalCents: 1500,
        },
      ],
      lastSyncedAt: new Date(),
    });

    const mockChannel: any = {
      on: vi.fn().mockImplementation((type: string, filter: any, callback: Function) => {
        const key = filter?.table ? `${filter.table}` : type;
        channelHandlers[key] = callback;
        return mockChannel;
      }),
      subscribe: vi.fn().mockImplementation((cb: (status: string) => void) => {
        subscribeStatusCallback = cb;
        // Simulate immediate successful subscription
        cb("SUBSCRIBED");
        return mockChannel;
      }),
    };

    vi.mocked(supabase.channel).mockReturnValue(mockChannel);
  });

  afterEach(() => {
    loadActiveCounterStateSpy.mockRestore();
  });

  it("1. Loads active state on startup and subscribes to Realtime", async () => {
    const { result } = renderHook(() => useCounterRealtime(testCafeId));

    // Wait for initial async state load
    await act(async () => {
      await Promise.resolve();
    });

    expect(loadActiveCounterStateSpy).toHaveBeenCalledWith(testCafeId);
    expect(result.current.tables).toHaveLength(2);
    expect(result.current.selectedTableId).toBe("t1");
    expect(result.current.connectionStatus).toBe("connected");
  });

  it("2. Triggers authoritative reconciliation on incoming order event", async () => {
    const { result } = renderHook(() => useCounterRealtime(testCafeId));

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadActiveCounterStateSpy).toHaveBeenCalledTimes(1);

    // Simulate incoming Realtime order insert event
    expect(channelHandlers["orders"]).toBeDefined();
    await act(async () => {
      channelHandlers["orders"]({ eventType: "INSERT", new: { id: "new-order-id" } });
      await Promise.resolve();
    });

    expect(loadActiveCounterStateSpy).toHaveBeenCalledTimes(2);
  });

  it("3. Handles network online/offline events with reconnect reconciliation", async () => {
    const { result } = renderHook(() => useCounterRealtime(testCafeId));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.connectionStatus).toBe("connected");

    // Simulate browser going offline
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.connectionStatus).toBe("disconnected");

    // Simulate browser coming back online -> triggers authoritative sync
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    expect(result.current.connectionStatus).toBe("connected");
    expect(loadActiveCounterStateSpy).toHaveBeenCalledTimes(2);
  });
});
