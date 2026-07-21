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
 * Single source of truth for table occupancy calculation (Part B).
 * Rule: active_session_id != null AND session.status != 'closed' (or activeOrders.length > 0) => Occupied.
 * Otherwise => Free.
 */
export function getTableStatus(table: TableRow, orders: Order[] = []): TableOccupancyStatus {
  const activeOrders = orders.filter(
    (o) => o.table_id === table.id && isOrderActive(o.status)
  );

  const servedOrders = orders.filter(
    (o) => o.table_id === table.id && o.status === "served"
  );

  const hasActiveSession =
    (table.active_session_id !== null && table.active_session_id !== undefined) ||
    table.status === "occupied" ||
    (table as any).dining_sessions?.status === "active";

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
      chipColor = "green";
      statusLabel = "Ready";
    }
  } else if (hasActiveSession) {
    chipColor = "amber";
    statusLabel = "Seated";
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

export function calculateOccupiedTables(tables: TableRow[], orders: Order[] = []): TableRow[] {
  return tables.filter((t) => getTableStatus(t, orders).isOccupied);
}

export function calculateAvailableTables(tables: TableRow[], orders: Order[] = []): TableRow[] {
  return tables.filter((t) => !getTableStatus(t, orders).isOccupied);
}
