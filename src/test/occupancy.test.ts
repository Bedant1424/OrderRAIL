import { describe, it, expect } from "vitest";
import { getTableStatus } from "../lib/tables/occupancy";
import type { TableRow, Order } from "../lib/db";

describe("Table Occupancy Engine — DiningSession Single Source of Truth", () => {
  const baseTable: TableRow = {
    id: "table-1",
    cafe_id: "cafe-1",
    label: "1",
    seats: 4,
    status: "free",
    active_session_id: null,
    is_active: true,
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z",
  };

  it("should report table as Free when active_session_id is null and table.status is free", () => {
    const orders: Order[] = [];
    const statusInfo = getTableStatus(baseTable, orders);

    expect(statusInfo.isOccupied).toBe(false);
    expect(statusInfo.statusLabel).toBe("Available");
  });

  it("should report table as Occupied when active_session_id exists (QR scanned)", () => {
    const occupiedTable: TableRow = {
      ...baseTable,
      status: "occupied",
      active_session_id: "session-123",
    };
    const orders: Order[] = [];
    const statusInfo = getTableStatus(occupiedTable, orders);

    expect(statusInfo.isOccupied).toBe(true);
    expect(statusInfo.hasActiveSession).toBe(true);
    expect(statusInfo.statusLabel).toBe("Seated");
  });

  it("should remain Occupied when all orders for the table are Served", () => {
    const occupiedTable: TableRow = {
      ...baseTable,
      status: "occupied",
      active_session_id: "session-123",
    };
    const servedOrders: any[] = [
      {
        id: "order-1",
        table_id: "table-1",
        dining_session_id: "session-123",
        status: "served",
      },
      {
        id: "order-2",
        table_id: "table-1",
        dining_session_id: "session-123",
        status: "served",
      },
    ];

    const statusInfo = getTableStatus(occupiedTable, servedOrders);

    expect(statusInfo.activeOrders.length).toBe(0);
    expect(statusInfo.servedOrders.length).toBe(2);
    // Crucial requirement: serving all orders MUST NOT free the table
    expect(statusInfo.isOccupied).toBe(true);
    expect(statusInfo.hasActiveSession).toBe(true);
  });

  it("should become Free only when active_session_id is cleared and status is set to free (markTableFree)", () => {
    const freedTable: TableRow = {
      ...baseTable,
      status: "free",
      active_session_id: null,
    };
    const servedOrders: any[] = [
      {
        id: "order-1",
        table_id: "table-1",
        dining_session_id: "session-123",
        status: "served",
      },
    ];

    const statusInfo = getTableStatus(freedTable, servedOrders);

    expect(statusInfo.isOccupied).toBe(false);
    expect(statusInfo.hasActiveSession).toBe(false);
    expect(statusInfo.statusLabel).toBe("Available");
  });
});
