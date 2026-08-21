import type { Order, OrderItem } from "@/lib/db";
import { FinancialSummaryCalculator } from "./FinancialSummaryCalculator";
import type { OwnerAnalyticsFinancialSummary } from "./analyticsTypes";

/**
 * Shared Revenue & Financial Metrics Model (Milestone 2C.3)
 * Unified with authoritative PostgreSQL bills and RPC contracts.
 */
export interface RevenueMetricsModel {
  grossSalesCents: number;
  discountsCents: number;
  taxCents: number;
  cgstCents?: number;
  sgstCents?: number;
  serviceChargeCents?: number;
  roundOffCents?: number;
  netSalesCents: number;
  orderCount: number;
  paidBillsCount: number;
  totalItemsSold: number;
  averageOrderValueCents: number;
  averageBillValueCents: number;
}

/**
 * Convert authoritative PostgreSQL financial summary into frontend RevenueMetricsModel
 */
export function mapAuthoritativeFinancialsToModel(
  fin: OwnerAnalyticsFinancialSummary,
  operationalOrderCount: number = 0
): RevenueMetricsModel {
  const grossSalesCents = Math.round((fin.gross_subtotal || 0) * 100);
  const discountsCents = Math.round((fin.total_discounts || 0) * 100);
  const cgstCents = Math.round((fin.cgst || 0) * 100);
  const sgstCents = Math.round((fin.sgst || 0) * 100);
  const taxCents = Math.round((fin.total_tax || 0) * 100);
  const serviceChargeCents = Math.round((fin.total_service_charge || 0) * 100);
  const roundOffCents = Math.round((fin.total_round_off || 0) * 100);
  const netSalesCents = Math.round((fin.net_collected || 0) * 100);
  const paidBillsCount = fin.paid_bills_count || 0;
  const totalItemsSold = fin.total_items_sold || 0;
  const averageBillValueCents = Math.round((fin.average_bill_value || 0) * 100);
  const averageOrderValueCents =
    operationalOrderCount > 0 ? Math.round(netSalesCents / operationalOrderCount) : averageBillValueCents;

  return {
    grossSalesCents,
    discountsCents,
    taxCents,
    cgstCents,
    sgstCents,
    serviceChargeCents,
    roundOffCents,
    netSalesCents,
    orderCount: operationalOrderCount || paidBillsCount,
    paidBillsCount,
    totalItemsSold,
    averageOrderValueCents,
    averageBillValueCents,
  };
}

/**
 * Fallback operational calculator for order ticket estimates
 */
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
    paidBillsCount: summary.paidOrdersCount,
    totalItemsSold: 0,
    averageOrderValueCents: summary.averageOrderValueCents,
    averageBillValueCents: summary.averageOrderValueCents,
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
 * Preparation Time Calculation Engine & Timestamp Architecture
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
      averageMinutes: null,
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
      averageMinutes: null,
    };
  }

  const avgMins = Math.round(totalMins / validCount);
  return {
    value: `~${avgMins} mins`,
    subtext: `Based on ${validCount} completed orders`,
    hasData: true,
    averageMinutes: avgMins,
  };
}
