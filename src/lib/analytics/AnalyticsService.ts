/**
 * Authoritative Owner Analytics Service (Milestone 2C.3)
 * 
 * Unifies Owner Analytics financial metrics (Revenue, Gross Sales, Discounts, Taxes,
 * Paid Bills, ABV, Daily Trends, Top Selling Items, Tender Breakdown) with authoritative
 * PostgreSQL public.bills and public.get_owner_analytics_range RPC.
 * 
 * Preserves operational analytics (Prep Time, Pending/Ready Queues, Table Occupancy,
 * Live Order Stream) on public.orders and public.tables.
 */

import { supabase, type Order, type TableRow, type Review } from "@/lib/db";
import {
  calculateAveragePrepTime,
  mapAuthoritativeFinancialsToModel,
  type RevenueMetricsModel,
  type PreparationTimeResult,
} from "./metrics";
import { sortTablesNatural } from "@/lib/tables/naturalTableSort";
import { AnalyticsRepository } from "./AnalyticsRepository";
import type {
  OwnerAnalyticsRangeResponse,
  OwnerAnalyticsDayPoint,
  OwnerAnalyticsTopItem,
  OwnerAnalyticsTenders,
} from "./analyticsTypes";

export interface AnalyticsDaySummary {
  day: string;
  business_date?: string;
  revenue: number;
  gross_subtotal?: number;
  orders: number;
  paid_bills?: number;
  items_sold?: number;
}

export interface AnalyticsHourSummary {
  hour: string;
  orders: number;
}

export interface AnalyticsTopItem {
  name: string;
  qty: number;
  revenue: number;
  percentage: number;
}

export interface LiveOrderFeedItem {
  id: string;
  order_number: number;
  table_id: string;
  table_label: string;
  created_at: string;
  status: Order["status"];
  total_cents: number;
}

export interface OwnerAnalyticsSummaryData {
  rangeRevenueMetrics: RevenueMetricsModel;
  todayRevenueMetrics: RevenueMetricsModel;
  prepTimeStats: PreparationTimeResult;
  pendingOrdersCount: number;
  readyOrdersCount: number;
  activeTableCount: number;
  totalTables: number;
  occupancyPercentage: number;
  byDay: AnalyticsDaySummary[];
  byHour: AnalyticsHourSummary[];
  peakHour: { hour: string; count: number };
  topItems: AnalyticsTopItem[];
  tenders: OwnerAnalyticsTenders;
  recentOrders: LiveOrderFeedItem[];
  avgRating: number;
  reviewsCount: number;
  staffCount: number;
  tables: TableRow[];
  rawRpc?: OwnerAnalyticsRangeResponse | null;
  operationalSummary?: OwnerAnalyticsOperationalSummary;
}

export class AnalyticsServiceClass {
  /**
   * Fetch complete authoritative analytics summary for Owner Dashboard
   */
  public async fetchOwnerAnalytics(
    cafeId: string,
    rangeDays: number = 7,
    startDate?: string | null,
    endDate?: string | null
  ): Promise<OwnerAnalyticsSummaryData> {
    let sinceDate: Date;
    if (startDate) {
      sinceDate = new Date(startDate + "T00:00:00.000Z");
    } else {
      sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - rangeDays + 1);
      sinceDate.setHours(0, 0, 0, 0);
    }
    const sinceIso = sinceDate.toISOString();

    const todayStartDate = new Date();
    todayStartDate.setHours(0, 0, 0, 0);
    const todayStartIso = todayStartDate.toISOString();

    // 1. Parallel Execution: Authoritative Financial Range RPC + Operational Queries
    const [rangeRpcResult, operationalOrdersRes, todayOrdersRes, tablesRes, reviewsRes, staffRes] =
      await Promise.allSettled([
        // A. Authoritative Financial Range RPC (Single source of financial truth)
        AnalyticsRepository.fetchOwnerAnalyticsRange(cafeId, rangeDays, startDate, endDate),

        // B. Operational Orders (for prep time, queue counts, hourly peak distribution, live feed)
        supabase
          .from("orders")
          .select("id, order_number, total_cents, status, created_at, updated_at, table_id")
          .eq("cafe_id", cafeId)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false }),

        // C. Today's Operational Orders count
        supabase
          .from("orders")
          .select("id, total_cents, status, created_at")
          .eq("cafe_id", cafeId)
          .gte("created_at", todayStartIso),

        // D. Tables for occupancy
        supabase
          .from("tables")
          .select("id, label, status, active_session_id")
          .eq("cafe_id", cafeId),

        // E. Customer reviews (top 10 ratings)
        supabase
          .from("reviews")
          .select("rating")
          .eq("cafe_id", cafeId)
          .order("created_at", { ascending: false })
          .limit(10),

        // F. Staff count
        supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("cafe_id", cafeId),
      ]);

    // Extract Operational Query Results
    const orders =
      operationalOrdersRes.status === "fulfilled"
        ? ((operationalOrdersRes.value.data ?? []) as Partial<Order>[])
        : [];
    const todayOrders =
      todayOrdersRes.status === "fulfilled"
        ? ((todayOrdersRes.value.data ?? []) as Partial<Order>[])
        : [];
    const tablesRaw =
      tablesRes.status === "fulfilled" ? ((tablesRes.value.data ?? []) as TableRow[]) : [];
    const tables = sortTablesNatural(tablesRaw);
    const reviews =
      reviewsRes.status === "fulfilled"
        ? ((reviewsRes.value.data ?? []) as Partial<Review>[])
        : [];
    const staffCount =
      staffRes.status === "fulfilled" ? staffRes.value.count || 1 : 1;

    // Operational Metrics
    const prepTimeStats = calculateAveragePrepTime(orders as Order[]);
    const pendingOrdersCount = orders.filter(
      (o) => o.status === "placed" || o.status === "in_kitchen"
    ).length;
    const readyOrdersCount = orders.filter((o) => o.status === "ready").length;

    // Active Table Occupancy
    const activeTableCount = tables.filter(
      (t) => t.status === "occupied" || t.status === "bill_requested" || t.active_session_id != null
    ).length;
    const totalTables = tables.length || 1;
    const occupancyPercentage = Math.round((activeTableCount / totalTables) * 100);

    // Hourly Operational Peak (Orders placed by hour of day)
    const byHour: AnalyticsHourSummary[] = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h.toString().padStart(2, "0")}:00`,
      orders: 0,
    }));
    for (const o of orders) {
      if (!o.created_at || o.status === "cancelled") continue;
      const hr = new Date(o.created_at).getHours();
      if (byHour[hr]) byHour[hr].orders += 1;
    }
    let maxPeak = 0;
    let peakHourStr = "12:00";
    for (const h of byHour) {
      if (h.orders > maxPeak) {
        maxPeak = h.orders;
        peakHourStr = h.hour;
      }
    }
    const peakHour = { hour: peakHourStr, count: maxPeak };

    // Recent Live Orders Feed (Top 5)
    const tableMap = new Map(tables.map((t) => [t.id, t.label]));
    const recentOrders: LiveOrderFeedItem[] = orders.slice(0, 5).map((o) => ({
      id: o.id || "",
      order_number: o.order_number || 100,
      table_id: o.table_id || "",
      table_label: tableMap.get(o.table_id || "") || "?",
      created_at: o.created_at || new Date().toISOString(),
      status: (o.status as Order["status"]) || "placed",
      total_cents: o.total_cents || 0,
    }));

    // Customer Ratings
    let avgRating = 4.9;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
      avgRating = Number((sum / reviews.length).toFixed(1));
    }

    // 2. Resolve Financial Metrics from Authoritative RPC or Fallback
    if (rangeRpcResult.status === "fulfilled") {
      const rpcData = rangeRpcResult.value;
      const rangeRevenueMetrics = mapAuthoritativeFinancialsToModel(
        rpcData.range_financials,
        rpcData.operational_summary?.total_orders_placed || orders.length
      );
      const todayRevenueMetrics = mapAuthoritativeFinancialsToModel(
        rpcData.today_financials,
        todayOrders.length
      );

      const byDay: AnalyticsDaySummary[] = (rpcData.by_day || []).map((d: OwnerAnalyticsDayPoint) => ({
        business_date: d.business_date,
        day: d.day,
        revenue: d.revenue,
        gross_subtotal: d.gross_subtotal,
        orders: d.paid_bills, // Display paid bills as count on financial trend
        paid_bills: d.paid_bills,
        items_sold: d.items_sold,
      }));

      const topItems: AnalyticsTopItem[] = (rpcData.top_items || []).map(
        (item: OwnerAnalyticsTopItem) => ({
          name: item.name,
          qty: item.qty,
          revenue: item.revenue,
          percentage: item.percentage,
        })
      );

      return {
        rangeRevenueMetrics,
        todayRevenueMetrics,
        prepTimeStats,
        pendingOrdersCount,
        readyOrdersCount,
        activeTableCount,
        totalTables,
        occupancyPercentage,
        byDay,
        byHour,
        peakHour,
        topItems,
        tenders: rpcData.tenders,
        recentOrders,
        avgRating,
        reviewsCount: reviews.length,
        staffCount,
        tables,
        rawRpc: rpcData,
        operationalSummary: rpcData.operational_summary,
      };
    } else {
      // Fallback path if RPC is not available in mock/test environment
      console.warn(
        "[AnalyticsService] get_owner_analytics_range RPC unavailable, falling back to direct bills aggregation:",
        rangeRpcResult.reason
      );

      const untilIso = endDate ? new Date(endDate + "T23:59:59.999Z").toISOString() : new Date().toISOString();
      const fallbackBills = await AnalyticsRepository.getBillsByDateRange(cafeId, sinceIso, untilIso);
      const paidBills = fallbackBills.filter((b) => b.payment_status === "PAID");
      const todayPaidBills = paidBills.filter((b) => {
        const bd = b.business_date || (b.paid_at || b.created_at || "").slice(0, 10);
        return bd === new Date().toISOString().slice(0, 10);
      });

      const rangeNetSales = paidBills.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
      const rangeGrossSales = paidBills.reduce((acc, b) => acc + Number(b.subtotal || 0), 0);
      const rangeDiscounts = paidBills.reduce((acc, b) => acc + Number(b.discount || 0), 0);
      const rangeTax = paidBills.reduce((acc, b) => acc + Number(b.cgst || 0) + Number(b.sgst || 0), 0);
      const rangeItemsSold = paidBills.reduce((acc, b) => acc + Number(b.total_items || 0), 0);

      const todayNetSales = todayPaidBills.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
      const todayGrossSales = todayPaidBills.reduce((acc, b) => acc + Number(b.subtotal || 0), 0);
      const todayDiscounts = todayPaidBills.reduce((acc, b) => acc + Number(b.discount || 0), 0);
      const todayTax = todayPaidBills.reduce((acc, b) => acc + Number(b.cgst || 0) + Number(b.sgst || 0), 0);
      const todayItemsSold = todayPaidBills.reduce((acc, b) => acc + Number(b.total_items || 0), 0);

      const rangeRevenueMetrics: RevenueMetricsModel = {
        grossSalesCents: Math.round(rangeGrossSales * 100),
        discountsCents: Math.round(rangeDiscounts * 100),
        taxCents: Math.round(rangeTax * 100),
        netSalesCents: Math.round(rangeNetSales * 100),
        orderCount: orders.length,
        paidBillsCount: paidBills.length,
        totalItemsSold: rangeItemsSold,
        averageOrderValueCents: orders.length > 0 ? Math.round((rangeNetSales * 100) / orders.length) : 0,
        averageBillValueCents: paidBills.length > 0 ? Math.round((rangeNetSales * 100) / paidBills.length) : 0,
      };

      const todayRevenueMetrics: RevenueMetricsModel = {
        grossSalesCents: Math.round(todayGrossSales * 100),
        discountsCents: Math.round(todayDiscounts * 100),
        taxCents: Math.round(todayTax * 100),
        netSalesCents: Math.round(todayNetSales * 100),
        orderCount: todayOrders.length,
        paidBillsCount: todayPaidBills.length,
        totalItemsSold: todayItemsSold,
        averageOrderValueCents: todayOrders.length > 0 ? Math.round((todayNetSales * 100) / todayOrders.length) : 0,
        averageBillValueCents: todayPaidBills.length > 0 ? Math.round((todayNetSales * 100) / todayPaidBills.length) : 0,
      };

      // Fallback byDay
      const effectiveDays = startDate && endDate
        ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
        : rangeDays;
      const days: Record<string, AnalyticsDaySummary> = {};
      for (let i = effectiveDays - 1; i >= 0; i--) {
        const d = endDate ? new Date(endDate + "T00:00:00.000Z") : new Date();
        d.setDate(d.getDate() - i);
        const k = d.toISOString().slice(0, 10);
        days[k] = {
          day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          business_date: k,
          revenue: 0,
          gross_subtotal: 0,
          orders: 0,
          paid_bills: 0,
          items_sold: 0,
        };
      }
      for (const b of paidBills) {
        const k = b.business_date || (b.paid_at || b.created_at || "").slice(0, 10);
        if (days[k]) {
          days[k].revenue += Number(b.grand_total || 0);
          days[k].gross_subtotal = (days[k].gross_subtotal || 0) + Number(b.subtotal || 0);
          days[k].orders += 1;
          days[k].paid_bills = (days[k].paid_bills || 0) + 1;
          days[k].items_sold = (days[k].items_sold || 0) + Number(b.total_items || 0);
        }
      }

      // Fallback Tenders
      const tenders: OwnerAnalyticsTenders = {
        cash: paidBills.filter((b) => (b.payment_method || "").toUpperCase() === "CASH").reduce((a, b) => a + Number(b.grand_total || 0), 0),
        upi: paidBills.filter((b) => (b.payment_method || "").toUpperCase() === "UPI").reduce((a, b) => a + Number(b.grand_total || 0), 0),
        card: paidBills.filter((b) => (b.payment_method || "").toUpperCase() === "CARD").reduce((a, b) => a + Number(b.grand_total || 0), 0),
        other: paidBills.filter((b) => !["CASH", "UPI", "CARD"].includes((b.payment_method || "").toUpperCase())).reduce((a, b) => a + Number(b.grand_total || 0), 0),
      };

      // Fallback Top Items from Bill Items
      const fallbackBillItems = await AnalyticsRepository.getBillItemsByDateRange(cafeId, sinceIso, new Date().toISOString());
      const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
      for (const it of fallbackBillItems) {
        const cur = itemMap.get(it.item_name) ?? { name: it.item_name, qty: 0, revenue: 0 };
        cur.qty += Number(it.quantity || 1);
        cur.revenue += Number(it.line_total || 0);
        itemMap.set(it.item_name, cur);
      }
      const sortedTop = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 6);
      const maxQty = sortedTop[0]?.qty || 1;
      const topItems: AnalyticsTopItem[] = sortedTop.map((item) => ({
        ...item,
        percentage: Math.round((item.qty / maxQty) * 100),
      }));

      return {
        rangeRevenueMetrics,
        todayRevenueMetrics,
        prepTimeStats,
        pendingOrdersCount,
        readyOrdersCount,
        activeTableCount,
        totalTables,
        occupancyPercentage,
        byDay: Object.values(days),
        byHour,
        peakHour,
        topItems,
        tenders,
        recentOrders,
        avgRating,
        reviewsCount: reviews.length,
        staffCount,
        tables,
        rawRpc: null,
        operationalSummary: {
          total_orders_placed: orders.length,
          cancelled_orders_count: orders.filter((o) => o.status === "cancelled").length,
          unsettled_orders_count: orders.filter((o) => o.status !== "cancelled" && o.status !== "served").length,
          unsettled_pipeline_cents: orders
            .filter((o) => o.status !== "cancelled" && o.status !== "served")
            .reduce((acc, o) => acc + (o.total_cents || 0), 0),
        },
      };
    }
  }

  /**
   * Fetch complete ranked top selling items for paid bills across the active date range (untruncated).
   */
  public async fetchFullTopSellingItems(
    cafeId: string,
    rangeDays: number = 7,
    startDate?: string | null,
    endDate?: string | null
  ): Promise<AnalyticsTopItem[]> {
    let sinceDate: Date;
    if (startDate) {
      sinceDate = new Date(startDate + "T00:00:00.000Z");
    } else {
      sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - rangeDays + 1);
      sinceDate.setHours(0, 0, 0, 0);
    }
    const sinceIso = sinceDate.toISOString();
    const untilIso = endDate ? new Date(endDate + "T23:59:59.999Z").toISOString() : new Date().toISOString();

    return AnalyticsRepository.fetchFullTopItems(cafeId, sinceIso, untilIso, startDate, endDate);
  }

  /**
   * BI Dashboard aggregation helper for Sales Reports
   */
  public async getDashboard(cafeId: string, dateRange?: any): Promise<any> {
    const summary = await this.fetchOwnerAnalytics(cafeId, 7);
    return {
      summary: {
        totalRevenue: summary.rangeRevenueMetrics.netSalesCents / 100,
        netRevenue: summary.rangeRevenueMetrics.netSalesCents / 100,
        grossSales: summary.rangeRevenueMetrics.grossSalesCents / 100,
        totalDiscounts: (summary.rangeRevenueMetrics.discountsCents || 0) / 100,
        totalTax: (summary.rangeRevenueMetrics.taxCents || 0) / 100,
        paidBillsCount: summary.rangeRevenueMetrics.paidBillsCount,
        totalOrders: summary.rangeRevenueMetrics.orderCount,
        averageBillValue: (summary.rangeRevenueMetrics.averageBillValueCents || 0) / 100,
        averageOrderValue: summary.rangeRevenueMetrics.averageOrderValueCents / 100,
      },
      payments: {
        totalCollected: summary.rangeRevenueMetrics.netSalesCents / 100,
        byMethod: summary.tenders || { cash: 0, upi: 0, card: 0, other: 0 },
      },
      revenueTrend: summary.byDay,
      topMenuItems: summary.topItems,
    };
  }
}

export const AnalyticsService = new AnalyticsServiceClass();
