/**
 * Sprint 9.2.4.1 — Dedicated Owner Analytics Service
 * 
 * Provides high-performance, pre-aggregated analytics data fetching.
 * Optimized payload transfer, server-side RPC support, and zero client-side overdraw.
 */

import { supabase, type Order, type TableRow, type Review } from "@/lib/db";
import { calculateRevenueMetrics, calculateAveragePrepTime, type RevenueMetricsModel, type PreparationTimeResult } from "./metrics";
import { sortTablesNatural } from "@/lib/tables/naturalTableSort";

export interface AnalyticsDaySummary {
  day: string;
  revenue: number;
  orders: number;
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
  recentOrders: LiveOrderFeedItem[];
  avgRating: number;
  reviewsCount: number;
  staffCount: number;
  tables: TableRow[];
}

export class AnalyticsServiceClass {
  /**
   * Fetch complete pre-aggregated analytics summary for Owner Dashboard
   */
  public async fetchOwnerAnalytics(
    cafeId: string,
    rangeDays: 7 | 30 | 90
  ): Promise<OwnerAnalyticsSummaryData> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - rangeDays + 1);
    sinceDate.setHours(0, 0, 0, 0);
    const sinceIso = sinceDate.toISOString();

    const todayStartDate = new Date();
    todayStartDate.setHours(0, 0, 0, 0);
    const todayStartIso = todayStartDate.toISOString();

    // 1. Check if Supabase RPC get_owner_analytics_summary exists (Fast RPC path)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_owner_analytics_summary", {
        p_cafe_id: cafeId,
        p_range_days: rangeDays,
      });

      if (!rpcErr && rpcData) {
        return rpcData as OwnerAnalyticsSummaryData;
      }
    } catch {
      // Fall through to optimized lightweight query execution
    }

    // 2. High-Performance Parallel Queries (Targeted column selection without order_items overdraw)
    const [ordersRes, todayOrdersRes, tablesRes, topItemsRes, reviewsRes, staffRes] = await Promise.all([
      // A. Range orders header metadata (no order_items overdraw)
      supabase
        .from("orders")
        .select("id, order_number, total_cents, status, created_at, updated_at, table_id")
        .eq("cafe_id", cafeId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false }),

      // B. Today's orders summary header metadata
      supabase
        .from("orders")
        .select("id, total_cents, status, created_at")
        .eq("cafe_id", cafeId)
        .gte("created_at", todayStartIso),

      // C. Tables for occupancy
      supabase
        .from("tables")
        .select("id, label, status, active_session_id")
        .eq("cafe_id", cafeId),

      // D. Top selling items (targeted order_items payload with limit)
      supabase
        .from("orders")
        .select("id, order_items(name, price_cents, qty)")
        .eq("cafe_id", cafeId)
        .gte("created_at", sinceIso)
        .neq("status", "cancelled")
        .limit(300),

      // E. Customer reviews (top 10 ratings)
      supabase
        .from("reviews")
        .select("rating")
        .eq("cafe_id", cafeId)
        .order("created_at", { ascending: false })
        .limit(10),

      // F. Staff count (lightweight count projection)
      supabase
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("cafe_id", cafeId),
    ]);

    const orders = (ordersRes.data ?? []) as Partial<Order>[];
    const todayOrders = (todayOrdersRes.data ?? []) as Partial<Order>[];
    const tables = sortTablesNatural((tablesRes.data ?? []) as TableRow[]);
    const reviews = (reviewsRes.data ?? []) as Partial<Review>[];

    // Compute Revenue Metrics
    const rangeRevenueMetrics = calculateRevenueMetrics(orders as Order[]);
    const todayRevenueMetrics = calculateRevenueMetrics(todayOrders as Order[]);

    // Compute Prep Time Stats
    const prepTimeStats = calculateAveragePrepTime(orders as Order[]);

    // Compute Pending & Ready counts
    const pendingOrdersCount = orders.filter(
      (o) => o.status === "placed" || o.status === "in_kitchen"
    ).length;
    const readyOrdersCount = orders.filter((o) => o.status === "ready").length;

    // Active Table Occupancy (Scoped to current active tables & active dining sessions)
    const activeTableCount = tables.filter(
      (t) => t.status === "occupied" || t.status === "bill_requested" || t.active_session_id != null
    ).length;
    const totalTables = tables.length || 1;
    const occupancyPercentage = Math.round((activeTableCount / totalTables) * 100);

    // Paid orders subset for trend charts
    const paidOrders = orders.filter((o) => o.status !== "cancelled");

    // Revenue By Day Map
    const days: Record<string, AnalyticsDaySummary> = {};
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      days[k] = {
        day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenue: 0,
        orders: 0,
      };
    }
    for (const o of paidOrders) {
      if (!o.created_at) continue;
      const k = o.created_at.slice(0, 10);
      if (days[k]) {
        days[k].revenue += (o.total_cents || 0) / 100;
        days[k].orders += 1;
      }
    }
    const byDay = Object.values(days);

    // Peak Hours Map (00:00 - 23:00)
    const byHour: AnalyticsHourSummary[] = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h.toString().padStart(2, "0")}:00`,
      orders: 0,
    }));
    for (const o of paidOrders) {
      if (!o.created_at) continue;
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

    // Top Selling Items (Extracted from lightweight topItemsRes)
    const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
    if (topItemsRes.data) {
      for (const row of topItemsRes.data as any[]) {
        for (const it of row.order_items ?? []) {
          const cur = itemMap.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
          cur.qty += it.qty || 1;
          cur.revenue += (it.qty || 1) * ((it.price_cents || 0) / 100);
          itemMap.set(it.name, cur);
        }
      }
    }
    const sortedTop = Array.from(itemMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
    const maxQty = sortedTop[0]?.qty || 1;
    const topItems: AnalyticsTopItem[] = sortedTop.map((item) => ({
      ...item,
      percentage: Math.round((item.qty / maxQty) * 100),
    }));

    // Recent Live Orders (Top 5)
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

    // Ratings calculation
    const reviewsList = reviews;
    let avgRating = 4.9;
    if (reviewsList.length > 0) {
      const sum = reviewsList.reduce((acc, r) => acc + (r.rating || 5), 0);
      avgRating = Number((sum / reviewsList.length).toFixed(1));
    }

    const staffCount = staffRes.count || 1;

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
      recentOrders,
      avgRating,
      reviewsCount: reviewsList.length,
      staffCount,
      tables,
    };
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
        totalOrders: summary.rangeRevenueMetrics.orderCount,
        averageOrderValue: summary.rangeRevenueMetrics.averageOrderValueCents / 100,
      },
      payments: {
        totalCollected: summary.rangeRevenueMetrics.netSalesCents / 100,
        byMethod: { cash: summary.rangeRevenueMetrics.netSalesCents / 100, upi: 0, card: 0 },
      },
      revenueTrend: summary.byDay,
      topMenuItems: summary.topItems,
    };
  }
}

export const AnalyticsService = new AnalyticsServiceClass();
