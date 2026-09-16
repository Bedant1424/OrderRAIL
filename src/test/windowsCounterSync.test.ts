import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/lib/db";
import { loadActiveCounterState } from "@/windows-pos/services/counterSyncService";

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

describe("Windows Counter Synchronization & State Loading Tests", () => {
  const testCafeId = "8c418a5a-7cd4-4054-8a88-f412c1762f7d";

  const mockTables = [
    { id: "table-1-uuid", cafe_id: testCafeId, label: "Table 1", status: "available", active_session_id: null },
    { id: "table-2-uuid", cafe_id: testCafeId, label: "Table 2", status: "occupied", active_session_id: "sess-2-uuid" },
    { id: "table-10-uuid", cafe_id: testCafeId, label: "Table 10", status: "available", active_session_id: null },
  ];

  const mockSessions = [
    { id: "sess-2-uuid", table_id: "table-2-uuid", status: "active", created_at: "2026-09-16T09:00:00.000Z" },
  ];

  const mockOrders = [
    {
      id: "ord-101-uuid",
      daily_order_number: 101,
      table_id: "table-2-uuid",
      dining_session_id: "sess-2-uuid",
      status: "pending",
      order_source: "DINE_IN",
      created_at: "2026-09-16T09:05:00.000Z",
      total_cents: 4500,
      customer_name: "Customer at T2",
      customer_phone: "+919876543210",
      note: "Extra spicy",
      order_items: [
        {
          id: "item-1",
          name: "Peri Peri Fries",
          price_cents: 2500,
          qty: 1,
          note: "Crispy",
        },
        {
          id: "item-2",
          name: "Cold Coffee",
          price_cents: 2000,
          qty: 1,
          note: null,
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      let resolvedData: any = [];
      if (table === "tables") resolvedData = mockTables;
      else if (table === "dining_sessions") resolvedData = mockSessions;
      else if (table === "orders") resolvedData = mockOrders;

      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: (val: any) => any) =>
          Promise.resolve({ data: resolvedData, error: null }).then(resolve),
      };

      return builder;
    });
  });

  it("1. Loads active counter state and maps tables with natural ordering", async () => {
    const result = await loadActiveCounterState(testCafeId);

    expect(result.tables).toHaveLength(3);
    // Table 1, Table 2, Table 10 natural order
    expect(result.tables[0].label).toBe("Table 1");
    expect(result.tables[1].label).toBe("Table 2");
    expect(result.tables[2].label).toBe("Table 10");

    expect(result.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("2. Accurately reflects table occupancy and active orders", async () => {
    const result = await loadActiveCounterState(testCafeId);

    const table1 = result.tables.find((t) => t.id === "table-1-uuid");
    const table2 = result.tables.find((t) => t.id === "table-2-uuid");

    // Table 1 has no session/orders -> available
    expect(table1).toBeDefined();
    expect(table1!.status).toBe("available");
    expect(table1!.orders).toHaveLength(0);
    expect(table1!.unbilledTotalCents).toBe(0);

    // Table 2 has active session and Order #101
    expect(table2).toBeDefined();
    expect(table2!.status).toBe("occupied");
    expect(table2!.activeSessionId).toBe("sess-2-uuid");
    expect(table2!.orders).toHaveLength(1);

    const order = table2!.orders[0];
    expect(order.orderNumber).toBe(101);
    expect(order.status).toBe("pending");
    expect(order.orderSource).toBe("DINE_IN");
    expect(order.totalCents).toBe(4500);
    expect(order.items).toHaveLength(2);
    expect(order.items[0].name).toBe("Peri Peri Fries");
    expect(order.items[0].qty).toBe(1);
    expect(order.items[1].name).toBe("Cold Coffee");

    expect(table2!.unbilledTotalCents).toBe(4500);
  });

  it("3. Handles empty cafe tables gracefully", async () => {
    vi.mocked(supabase.from).mockImplementation((_table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: (val: any) => any) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return builder;
    });

    const result = await loadActiveCounterState("non-existent-cafe");
    expect(result.tables).toEqual([]);
    expect(result.channelOrders).toEqual([]);
    expect(result.lastSyncedAt).toBeInstanceOf(Date);
  });
});
