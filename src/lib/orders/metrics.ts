import type { Order, TableRow } from "@/lib/db";
import { calculateOccupiedTables } from "@/lib/tables/occupancy";
import { isOrderActive } from "@/lib/orders/orderUtils";
import { FinancialSummaryCalculator } from "@/lib/analytics/FinancialSummaryCalculator";

export interface OperationalSummaryModel {
  activeCount: number;
  preparingCount: number;
  readyCount: number;
  completedCount: number;
  cancelledCount: number;
  totalOrdersCount: number;
  totalRevenue: number;
  ordersCompletedToday: number;
  revenueTodayCents: number;
  occupiedTablesCount: number;
  avgWaitMinsFormatted: string;
  activeOrdersText: string;
  occupiedTablesText: string;
}

/**
 * Calculates operational metrics for current business day or filtered historical range.
 */
export function calculateOperationalSummary(
  orders: Order[],
  tables: TableRow[] = []
): OperationalSummaryModel {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  // Active orders (pending, preparing, ready)
  const activeOrders = orders.filter((o) => isOrderActive(o.status));
  const activeCount = activeOrders.length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;
  const readyCount = orders.filter((o) => o.status === "ready").length;

  // Completed / served & cancelled orders across passed dataset
  const completedOrders = orders.filter((o) => o.status === "served" || o.status === "completed");
  const completedCount = completedOrders.length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
  const totalOrdersCount = orders.length;

  const totalSummary = FinancialSummaryCalculator.calculateFromOrders(completedOrders);
  const totalRevenue = totalSummary.netSalesCents;

  // Legacy today calculation for backwards compatibility
  const todayOrders = orders.filter((o) => {
    if (!o.created_at) return false;
    const createdTime = new Date(o.created_at).getTime();
    return !isNaN(createdTime) && createdTime >= todayStartMs;
  });
  const servedOrdersToday = todayOrders.filter((o) => o.status === "served" || o.status === "completed");
  const ordersCompletedToday = servedOrdersToday.length;

  const todaySummary = FinancialSummaryCalculator.calculateFromOrders(servedOrdersToday);
  const revenueTodayCents = todaySummary.netSalesCents;

  // Single occupancy calculation
  const occupiedTablesList = calculateOccupiedTables(tables, orders);
  const occupiedTablesCount = occupiedTablesList.length;

  const activeOrdersText = activeCount === 1 ? "1 order" : `${activeCount} orders`;
  const occupiedTablesText =
    occupiedTablesCount === 1 ? "1 table occupied" : `${occupiedTablesCount} tables occupied`;

  let totalWaitMs = 0;
  for (const o of activeOrders) {
    const createdTime = new Date(o.created_at).getTime();
    const waitMs = Math.max(0, now - createdTime);
    totalWaitMs += waitMs;
  }

  const avgMins = activeCount > 0 ? Math.round(totalWaitMs / activeCount / (1000 * 60)) : 0;
  const avgWaitMinsFormatted = activeCount === 0 ? "—" : avgMins === 1 ? "1 min" : `${avgMins} min`;

  return {
    activeCount,
    preparingCount,
    readyCount,
    completedCount,
    cancelledCount,
    totalOrdersCount,
    totalRevenue,
    ordersCompletedToday,
    revenueTodayCents,
    occupiedTablesCount,
    avgWaitMinsFormatted,
    activeOrdersText,
    occupiedTablesText,
  };
}
