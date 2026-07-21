import { describe, it, expect } from "vitest";
import { calculateOccupiedTables, calculateAvailableTables, getTableStatus } from "@/lib/tables/occupancy";
import { calculateOperationalSummary } from "@/lib/orders/metrics";
import type { TableRow, Order } from "@/lib/db";

describe("Single Occupancy Engine - Sprint 4.3", () => {
  const dummyTables: TableRow[] = [
    { id: "t1", label: "1", cafe_id: "c1", created_at: "", is_active: true, seats: 4, status: "free", active_session_id: null },
    { id: "t2", label: "2", cafe_id: "c1", created_at: "", is_active: true, seats: 2, status: "free", active_session_id: null },
    { id: "t3", label: "3", cafe_id: "c1", created_at: "", is_active: true, seats: 4, status: "free", active_session_id: "s3" },
  ];

  const dummyOrders: Order[] = [
    {
      id: "o1",
      table_id: "t1",
      cafe_id: "c1",
      order_number: 101,
      status: "pending",
      total_cents: 1500,
      session_id: "sess1",
      dining_session_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_reviewed_version: 1,
      last_updated_by: "customer",
      note: null,
      previous_items: null,
      version: 1,
      eta_timestamp: null,
      eta_calculated_at: null,
    },
    {
      id: "o2",
      table_id: "t2",
      cafe_id: "c1",
      order_number: 102,
      status: "served",
      total_cents: 2000,
      session_id: "sess2",
      dining_session_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_reviewed_version: 1,
      last_updated_by: "staff",
      note: null,
      previous_items: null,
      version: 1,
      eta_timestamp: null,
      eta_calculated_at: null,
    },
  ];

  it("calculates occupied tables based on active orders and active sessions", () => {
    const occupied = calculateOccupiedTables(dummyTables, dummyOrders);
    expect(occupied.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("calculates available tables accurately", () => {
    const available = calculateAvailableTables(dummyTables, dummyOrders);
    expect(available.map((t) => t.id)).toEqual(["t2"]);
  });

  it("returns table status details including chip colors", () => {
    const status1 = getTableStatus(dummyTables[0], dummyOrders);
    expect(status1.isOccupied).toBe(true);
    expect(status1.chipColor).toBe("amber");
    expect(status1.statusLabel).toBe("Pending");

    const status2 = getTableStatus(dummyTables[1], dummyOrders);
    expect(status2.isOccupied).toBe(false);
    expect(status2.chipColor).toBe("green");
    expect(status2.statusLabel).toBe("Available");
  });

  it("calculates today operational summary metrics correctly", () => {
    const summary = calculateOperationalSummary(dummyOrders, dummyTables);
    expect(summary.activeCount).toBe(1);
    expect(summary.ordersCompletedToday).toBe(1);
    expect(summary.revenueTodayCents).toBe(2000);
    expect(summary.occupiedTablesCount).toBe(2);
  });
});
