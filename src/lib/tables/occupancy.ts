import type { TableRow, Order } from "@/lib/db";
import { isOrderActive } from "@/lib/orders/orderUtils";

export interface TableOccupancyStatus {
  table: TableRow;
  isOccupied: boolean;
  activeOrders: Order[];
  primaryStatus?: Order["status"];
  hasActiveSession: boolean;
}

/**
 * Single source of truth for table occupancy across Summary cards, Table widget, and Floor view.
 */
export function getTableStatus(table: TableRow, orders: Order[]): TableOccupancyStatus {
  // Find active orders belonging to this table
  const activeOrders = orders.filter(
    (o) => o.table_id === table.id && isOrderActive(o.status)
  );

  // Table session status check (from active_session_id or status property or dining_sessions join)
  const hasActiveSession =
    (table.active_session_id !== null && table.active_session_id !== undefined) ||
    table.status === "occupied" ||
    (table as any).dining_sessions?.status === "active";

  const isOccupied = activeOrders.length > 0 || hasActiveSession;

  let primaryStatus: Order["status"] | undefined = undefined;
  if (activeOrders.length > 0) {
    // Priority order: pending > preparing > ready
    if (activeOrders.some((o) => o.status === "pending")) {
      primaryStatus = "pending";
    } else if (activeOrders.some((o) => o.status === "preparing")) {
      primaryStatus = "preparing";
    } else if (activeOrders.some((o) => o.status === "ready")) {
      primaryStatus = "ready";
    }
  }

  return {
    table,
    isOccupied,
    activeOrders,
    primaryStatus,
    hasActiveSession,
  };
}

export function calculateOccupiedTables(tables: TableRow[], orders: Order[]): TableRow[] {
  return tables.filter((t) => getTableStatus(t, orders).isOccupied);
}

export function calculateAvailableTables(tables: TableRow[], orders: Order[]): TableRow[] {
  return tables.filter((t) => !getTableStatus(t, orders).isOccupied);
}
