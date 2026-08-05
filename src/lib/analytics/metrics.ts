import type { Order, OrderItem } from "@/lib/db";
import { FinancialSummaryCalculator } from "./FinancialSummaryCalculator";

/**
 * Task 1: Shared Revenue Metrics Model
 * Unified through FinancialSummaryCalculator for consistent financial reporting.
 */
export interface RevenueMetricsModel {
  grossSalesCents: number;
  discountsCents: number;
  taxCents: number;
  netSalesCents: number;
  orderCount: number;
  averageOrderValueCents: number;
}

export function calculateRevenueMetrics(
  targetOrders: (Order & { order_items?: OrderItem[] })[]
): RevenueMetricsModel {
  const summary = FinancialSummaryCalculator.calculateFromOrders(targetOrders);

  return {
    grossSalesCents: summary.grossSalesCents,
    discountsCents: summary.discountsCents,
    taxCents: summary.taxCents,
    netSalesCents: summary.netSalesCents,
    orderCount: summary.nonCancelledOrdersCount,
    averageOrderValueCents: summary.averageOrderValueCents,
  };
}

/**
 * Result structure for dynamic preparation time calculations.
 */
export interface PreparationTimeResult {
  value: string;
  subtext: string;
  hasData: boolean;
  averageMinutes: number | null;
}

/**
 * Task 2: Preparation Time Calculation Engine & Timestamp Architecture
 *
 * TODO (Future POS / KDS Schema Migration):
 * Currently, preparation time is computed using timestamps (created_at -> updated_at) for completed orders.
 * When the database schema is extended in upcoming sprints, migrate this calculation to dedicated order lifecycle timestamps:
 *
 *   - accepted_at   : Timestamp when staff/kitchen accepts order
 *   - preparing_at  : Timestamp when kitchen starts cooking
 *   - ready_at      : Timestamp when order is marked ready on KDS
 *   - served_at     : Timestamp when runner serves order to table
 *   - completed_at  : Timestamp when order is finalized/closed
 *
 * Target calculation formula once migrated:
 *   prep_time = ready_at - accepted_at (or created_at)
 */
export function calculateAveragePrepTime(
  orders: (Order & { order_items?: OrderItem[] })[]
): PreparationTimeResult {
  const completedOrders = orders.filter(
    (o) => (o.status === "served" || o.status === "ready") && o.created_at && o.updated_at
  );

  if (completedOrders.length < 2) {
    return {
      value: "—",
      subtext: "Awaiting production data",
      hasData: false,
      averageMinutes: null
    };
  }

  let totalMins = 0;
  let validCount = 0;

  for (const o of completedOrders) {
    const created = new Date(o.created_at).getTime();
    const updated = new Date(o.updated_at).getTime();
    const diffMins = (updated - created) / (1000 * 60);

    // Sanity boundary: filter out non-sensical or extreme outlier timestamps (> 120 mins)
    if (diffMins > 0 && diffMins <= 120) {
      totalMins += diffMins;
      validCount += 1;
    }
  }

  if (validCount === 0) {
    return {
      value: "—",
      subtext: "Awaiting production data",
      hasData: false,
      averageMinutes: null
    };
  }

  const avgMins = Math.round(totalMins / validCount);
  return {
    value: `~${avgMins} mins`,
    subtext: `Based on ${validCount} completed orders`,
    hasData: true,
    averageMinutes: avgMins
  };
}
