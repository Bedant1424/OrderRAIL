import type { TableRow, Order } from "@/lib/db";
import { isOrderActive } from "@/lib/orders/orderUtils";

export type TableChipColor = "green" | "amber" | "orange" | "blue" | "gray";

export interface TableOccupancyStatus {
  table: TableRow;
  isOccupied: boolean;
  activeOrders: Order[];
  servedOrders: Order[];
  primaryStatus?: Order["status"];
  hasActiveSession: boolean;
  chipColor: TableChipColor;
  statusLabel: string;
}

/**
 * Single source of truth for table occupancy across Summary cards, Floor chips, and Table Details panel.
 * Crucial Lifecycle Rule: Serving an order DOES NOT free a table. Table remains occupied until staff/owner explicitly marks it free.
 */
export function getTableStatus(table: TableRow, orders: Order[]): TableOccupancyStatus {
  // Active orders for this table (pending, preparing, ready)
  const activeOrders = orders.filter(
    (o) => o.table_id === table.id && isOrderActive(o.status)
  );

  // Served orders for this table
  const servedOrders = orders.filter(
    (o) => o.table_id === table.id && o.status === "served"
  );

  // Check if session is active
  const hasActiveSession =
    (table.active_session_id !== null && table.active_session_id !== undefined) ||
    table.status === "occupied" ||
    (table as any).dining_sessions?.status === "active";

  // Table is occupied if active orders exist OR an active dining session exists
  const isOccupied = activeOrders.length > 0 || hasActiveSession;

  let primaryStatus: Order["status"] | undefined = undefined;
  let chipColor: TableChipColor = "green";
  let statusLabel = "Available";

  if (table.is_active === false) {
    chipColor = "gray";
    statusLabel = "Closed";
  } else if (activeOrders.length > 0) {
    if (activeOrders.some((o) => o.status === "pending")) {
      primaryStatus = "pending";
      chipColor = "amber";
      statusLabel = "Pending";
    } else if (activeOrders.some((o) => o.status === "preparing")) {
      primaryStatus = "preparing";
      chipColor = "orange";
      statusLabel = "Preparing";
    } else if (activeOrders.some((o) => o.status === "ready")) {
      primaryStatus = "ready";
      chipColor = "blue";
      statusLabel = "Ready";
    }
  } else if (hasActiveSession) {
    // All orders served, but customer is still dining/seated
    chipColor = "amber";
    statusLabel = "Seated (Dining)";
  }

  return {
    table,
    isOccupied,
    activeOrders,
    servedOrders,
    primaryStatus,
    hasActiveSession,
    chipColor,
    statusLabel,
  };
}

export function calculateOccupiedTables(tables: TableRow[], orders: Order[]): TableRow[] {
  return tables.filter((t) => getTableStatus(t, orders).isOccupied);
}

export function calculateAvailableTables(tables: TableRow[], orders: Order[]): TableRow[] {
  return tables.filter((t) => !getTableStatus(t, orders).isOccupied);
}
