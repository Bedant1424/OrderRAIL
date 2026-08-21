/**
 * Daily Sales Repository
 * Authoritative PostgreSQL RPC dispatcher for Daily Sales metrics.
 */

import { supabase } from "@/lib/db";
import type { DailySalesReport } from "./types";

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
      pipeline: {
        unsettled_orders_count: Number(raw.pipeline?.unsettled_orders_count) || 0,
        unsettled_pipeline_cents: Number(raw.pipeline?.unsettled_pipeline_cents) || 0,
        cancelled_orders_count: Number(raw.pipeline?.cancelled_orders_count) || 0,
      },
    };

    return report;
  }
}
