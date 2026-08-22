/**
 * Daily Sales Repository
 * Authoritative PostgreSQL RPC dispatcher for Daily Sales metrics and transactions.
 */

import { supabase } from "@/lib/db";
import type {
  DailySalesReport,
  DailySalesTransaction,
  DailySalesTransactionsResponse,
} from "./types";

export class DailySalesRepository {
  /**
   * Fetch authoritative Daily Sales Report directly from PostgreSQL RPC public.get_daily_sales_report
   * 
   * @param cafeId Cafe UUID
   * @param businessDate Optional target business date YYYY-MM-DD. When null or omitted, PostgreSQL determines authoritative current business date.
   */
  public static async fetchDailySalesReport(
    cafeId: string,
    businessDate?: string | null
  ): Promise<DailySalesReport> {
    if (!cafeId) {
      throw new Error("[DailySalesRepository] cafeId is required to fetch daily sales report.");
    }

    const { data, error } = await supabase.rpc("get_daily_sales_report", {
      p_cafe_id: cafeId,
      p_business_date: businessDate || null,
    });

    if (error) {
      console.error("[DailySalesRepository] Failed to fetch daily sales report from RPC:", error);
      throw new Error(
        `Failed to fetch daily sales report: ${error.message || error.details || "Unknown database error"}`
      );
    }

    if (!data || typeof data !== "object") {
      throw new Error("[DailySalesRepository] RPC returned empty or invalid data format.");
    }

    const raw = data as Record<string, any>;

    // Build and normalize dense 24-bucket hourly breakdown
    const defaultHourly = Array.from({ length: 24 }, (_, h) => {
      const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
      return {
        hour: h,
        label,
        revenue: 0,
        paid_bills: 0,
        items_sold: 0,
        cash: 0,
        upi: 0,
        card: 0,
        other: 0,
      };
    });

    const hourlyRaw = Array.isArray(raw.hourly) ? raw.hourly : [];
    const hourly = defaultHourly.map((defaultBucket) => {
      const match = hourlyRaw.find((b: any) => Number(b?.hour) === defaultBucket.hour);
      if (!match) return defaultBucket;
      return {
        hour: defaultBucket.hour,
        label: String(match.label || defaultBucket.label),
        revenue: Number(match.revenue) || 0,
        paid_bills: Number(match.paid_bills) || 0,
        items_sold: Number(match.items_sold) || 0,
        cash: Number(match.cash) || 0,
        upi: Number(match.upi) || 0,
        card: Number(match.card) || 0,
        other: Number(match.other) || 0,
      };
    });

    // Strict type mapping and numeric normalization
    const report: DailySalesReport = {
      business_date: String(raw.business_date || businessDate || ""),
      cafe_id: String(raw.cafe_id || cafeId),
      net_collected: Number(raw.net_collected) || 0,
      gross_subtotal: Number(raw.gross_subtotal) || 0,
      total_discounts: Number(raw.total_discounts) || 0,
      total_tax: Number(raw.total_tax) || 0,
      cgst: Number(raw.cgst) || 0,
      sgst: Number(raw.sgst) || 0,
      total_service_charge: Number(raw.total_service_charge) || 0,
      total_round_off: Number(raw.round_off ?? raw.total_round_off) || 0,
      paid_bills_count: Number(raw.paid_bills_count) || 0,
      total_items_sold: Number(raw.total_items_sold) || 0,
      average_bill_value: Number(raw.average_bill_value) || 0,
      tenders: {
        cash: Number(raw.tenders?.cash) || 0,
        upi: Number(raw.tenders?.upi) || 0,
        card: Number(raw.tenders?.card) || 0,
        other: Number(raw.tenders?.other) || 0,
      },
      hourly,
      pipeline: {
        unsettled_orders_count: Number(raw.pipeline?.unsettled_orders_count) || 0,
        unsettled_pipeline_cents: Number(raw.pipeline?.unsettled_pipeline_cents) || 0,
        cancelled_orders_count: Number(raw.pipeline?.cancelled_orders_count) || 0,
      },
    };

    return report;
  }

  /**
   * Fetch authoritative transaction-level daily sales from PostgreSQL RPC public.get_daily_sales_transactions
   * 
   * @param cafeId Cafe UUID
   * @param businessDate Optional target business date YYYY-MM-DD. When null or omitted, PostgreSQL determines current business date.
   */
  public static async fetchDailySalesTransactions(
    cafeId: string,
    businessDate?: string | null
  ): Promise<DailySalesTransactionsResponse> {
    if (!cafeId) {
      throw new Error("[DailySalesRepository] cafeId is required to fetch daily sales transactions.");
    }

    const { data, error } = await supabase.rpc("get_daily_sales_transactions", {
      p_cafe_id: cafeId,
      p_business_date: businessDate || null,
    });

    if (error) {
      console.error("[DailySalesRepository] Failed to fetch daily sales transactions from RPC:", error);
      throw new Error(
        `Failed to fetch daily sales transactions: ${error.message || error.details || "Unknown database error"}`
      );
    }

    if (!data || typeof data !== "object") {
      throw new Error("[DailySalesRepository] RPC returned empty or invalid data format.");
    }

    const raw = data as Record<string, any>;
    const rawTransactions = Array.isArray(raw.transactions) ? raw.transactions : [];

    const transactions: DailySalesTransaction[] = rawTransactions.map((tx: any) => ({
      bill_id: String(tx.bill_id || ""),
      bill_number: Number(tx.bill_number) || 0,
      table_label: String(tx.table_label || "Quick Serve"),
      order_source: String(tx.order_source || "DINE_IN"),
      customer_name: tx.customer_name ? String(tx.customer_name) : null,
      customer_phone: tx.customer_phone ? String(tx.customer_phone) : null,
      cashier_id: String(tx.cashier_id || "Counter"),
      payment_method: String(tx.payment_method || "CASH"),
      subtotal: Number(tx.subtotal) || 0,
      discount: Number(tx.discount) || 0,
      cgst: Number(tx.cgst) || 0,
      sgst: Number(tx.sgst) || 0,
      service_charge: Number(tx.service_charge) || 0,
      round_off: Number(tx.round_off) || 0,
      grand_total: Number(tx.grand_total) || 0,
      total_items: Number(tx.total_items) || 0,
      paid_at: String(tx.paid_at || ""),
      business_date: String(tx.business_date || ""),
      items: Array.isArray(tx.items)
        ? tx.items.map((item: any) => ({
            item_name: String(item.item_name || ""),
            quantity: Number(item.quantity) || 0,
            line_total: Number(item.line_total) || 0,
          }))
        : [],
      tenders: Array.isArray(tx.tenders)
        ? tx.tenders.map((t: any) => ({
            method: String(t.method || "CASH"),
            amount: Number(t.amount) || 0,
            tendered_amount: t.tendered_amount !== undefined ? Number(t.tendered_amount) : undefined,
            change_due: t.change_due !== undefined ? Number(t.change_due) : undefined,
            transaction_ref: t.transaction_ref ? String(t.transaction_ref) : undefined,
          }))
        : undefined,
    }));

    return {
      business_date: String(raw.business_date || businessDate || ""),
      cafe_id: String(raw.cafe_id || cafeId),
      transactions,
    };
  }
}
