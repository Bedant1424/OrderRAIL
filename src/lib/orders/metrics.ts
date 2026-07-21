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
  longestWaitMinsFormatted: string;
  activeOrdersText: string;
  occupiedTablesText: string;
}

/**
 * Calculates today's operational metrics strictly for the current business day.
 */
export function calculateOperationalSummary(
  orders: Order[],
  tables: TableRow[] = []
): OperationalSummaryModel {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  // Filter orders created or updated today
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

  // Served orders today
  const servedOrdersToday = todayOrders.filter((o) => o.status === "served");
  const ordersCompletedToday = servedOrdersToday.length;
  const revenueTodayCents = servedOrdersToday.reduce((sum, o) => sum + (o.total_cents || 0), 0);

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
      longestWaitMinsFormatted: "—",
      activeOrdersText,
      occupiedTablesText,
    };
  }

  let totalWaitMs = 0;
  let maxWaitMs = 0;

  for (const o of activeOrders) {
    const createdTime = new Date(o.created_at).getTime();
    const waitMs = Math.max(0, now - createdTime);
    totalWaitMs += waitMs;
    if (waitMs > maxWaitMs) {
      maxWaitMs = waitMs;
    }
  }

  const avgMins = Math.round(totalWaitMs / activeCount / (1000 * 60));
  const maxMins = Math.round(maxWaitMs / (1000 * 60));

  const avgWaitMinsFormatted = avgMins === 1 ? "1 min" : `${avgMins} min`;
  const longestWaitMinsFormatted = maxMins >= 20 ? `${maxMins} min (Urgent)` : `${maxMins} min`;

  return {
    activeCount,
    preparingCount,
    readyCount,
    ordersCompletedToday,
    revenueTodayCents,
    occupiedTablesCount,
    avgWaitMinsFormatted,
    longestWaitMinsFormatted,
    activeOrdersText,
    occupiedTablesText,
  };
}
