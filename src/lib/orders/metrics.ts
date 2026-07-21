import type { Order, TableRow } from "@/lib/db";
import { calculateOccupiedTables } from "@/lib/tables/occupancy";
import { isOrderActive } from "@/lib/orders/orderUtils";

export interface OperationalSummaryModel {
  activeCount: number;
  preparingCount: number;
  readyCount: number;
  ordersCompletedToday: number;
  revenueTodayCents: number;
  occupiedTablesCount: number;
  avgWaitMinsFormatted: string;
  activeOrdersText: string;
  occupiedTablesText: string;
}

/**
 * Calculates operational metrics for current business day.
 * Bug 5 Fix: Removed "Longest Wait" metric completely.
 */
export function calculateOperationalSummary(
  orders: Order[],
  tables: TableRow[] = []
): OperationalSummaryModel {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  // Filter orders created today
  const todayOrders = orders.filter((o) => {
    if (!o.created_at) return false;
    const createdTime = new Date(o.created_at).getTime();
    return !isNaN(createdTime) && createdTime >= todayStartMs;
  });

  // Active orders (pending, preparing, ready)
  const activeOrders = orders.filter((o) => isOrderActive(o.status));
  const activeCount = activeOrders.length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;
  const readyCount = orders.filter((o) => o.status === "ready").length;

  // Served orders today for revenue calculation
  const servedOrdersToday = todayOrders.filter((o) => o.status === "served");
  const ordersCompletedToday = servedOrdersToday.length;
  const rawRevenue = servedOrdersToday.reduce((sum, o) => sum + (o.total_cents || 0), 0);
  const revenueTodayCents = isNaN(rawRevenue) || rawRevenue < 0 ? 0 : rawRevenue;

  // Single occupancy calculation
  const occupiedTablesList = calculateOccupiedTables(tables, orders);
  const occupiedTablesCount = occupiedTablesList.length;

  const activeOrdersText = activeCount === 1 ? "1 order" : `${activeCount} orders`;
  const occupiedTablesText =
    occupiedTablesCount === 1 ? "1 table occupied" : `${occupiedTablesCount} tables occupied`;

  if (activeCount === 0) {
    return {
      activeCount: 0,
      preparingCount: 0,
      readyCount: 0,
      ordersCompletedToday,
      revenueTodayCents,
      occupiedTablesCount,
      avgWaitMinsFormatted: "—",
      activeOrdersText,
      occupiedTablesText,
    };
  }

  let totalWaitMs = 0;

  for (const o of activeOrders) {
    const createdTime = new Date(o.created_at).getTime();
    const waitMs = Math.max(0, now - createdTime);
    totalWaitMs += waitMs;
  }

  const avgMins = Math.round(totalWaitMs / activeCount / (1000 * 60));
  const avgWaitMinsFormatted = avgMins === 1 ? "1 min" : `${avgMins} min`;

  return {
    activeCount,
    preparingCount,
    readyCount,
    ordersCompletedToday,
    revenueTodayCents,
    occupiedTablesCount,
    avgWaitMinsFormatted,
    activeOrdersText,
    occupiedTablesText,
  };
}
