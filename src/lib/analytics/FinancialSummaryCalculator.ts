/**
 * Sprint 1: Unified Financial Summary Calculator
 * Single source of calculation truth for OrderRail financial metrics across Dashboard, Analytics, Sales History, and Exports.
 */

export interface UnifiedFinancialSummary {
  grossSalesCents: number;
  discountsCents: number;
  taxCents: number;
  netSalesCents: number;
  totalOrdersCount: number;
  nonCancelledOrdersCount: number;
  paidOrdersCount: number;
  cancelledOrdersCount: number;
  averageOrderValueCents: number;
}

export class FinancialSummaryCalculator {
  /**
   * Unifies financial calculations across an array of order records.
   */
  public static calculateFromOrders(
    orders: Array<{ total_cents?: number | null; status?: string | null }>
  ): UnifiedFinancialSummary {
    let grossSalesCents = 0;
    let discountsCents = 0;
    let taxCents = 0;
    let nonCancelledOrdersCount = 0;
    let paidOrdersCount = 0;
    let cancelledOrdersCount = 0;

    for (const o of orders) {
      const status = (o.status || "").toLowerCase();
      const amount = o.total_cents || 0;

      if (status === "cancelled") {
        cancelledOrdersCount++;
        continue;
      }

      nonCancelledOrdersCount++;
      grossSalesCents += amount;

      if (status === "served" || status === "completed" || status === "paid") {
        paidOrdersCount++;
      }
    }

    const netSalesCents = Math.max(0, grossSalesCents - discountsCents + taxCents);
    const totalOrdersCount = orders.length;
    const averageOrderValueCents =
      nonCancelledOrdersCount > 0 ? Math.round(netSalesCents / nonCancelledOrdersCount) : 0;

    return {
      grossSalesCents,
      discountsCents,
      taxCents,
      netSalesCents,
      totalOrdersCount,
      nonCancelledOrdersCount,
      paidOrdersCount,
      cancelledOrdersCount,
      averageOrderValueCents,
    };
  }
}
