import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsService } from "@/lib/analytics/AnalyticsService";
import { AnalyticsRepository } from "@/lib/analytics/AnalyticsRepository";
import { calculateRevenueMetrics, calculateAveragePrepTime } from "@/lib/analytics/metrics";

describe("Sprint 9.2.4.1 — Owner Analytics Performance Optimization Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Pre-Aggregated Structure: AnalyticsService returns pre-aggregated analytics without overdraw", async () => {
    vi.spyOn(AnalyticsRepository, "fetchOwnerAnalyticsRange").mockResolvedValue({
      cafe_id: "test-cafe-123",
      current_business_date: "2026-08-21",
      start_business_date: "2026-08-15",
      end_business_date: "2026-08-21",
      range_days: 7,
      range_financials: {
        gross_subtotal: 1000,
        total_discounts: 0,
        total_tax: 50,
        cgst: 25,
        sgst: 25,
        total_service_charge: 0,
        total_round_off: 0,
        net_collected: 1050,
        paid_bills_count: 3,
        total_items_sold: 6,
        average_bill_value: 350,
      },
      today_financials: {
        gross_subtotal: 300,
        total_discounts: 0,
        total_tax: 15,
        cgst: 7.5,
        sgst: 7.5,
        total_service_charge: 0,
        total_round_off: 0,
        net_collected: 315,
        paid_bills_count: 1,
        total_items_sold: 2,
        average_bill_value: 315,
      },
      tenders: { cash: 315, upi: 735, card: 0, other: 0 },
      by_day: Array.from({ length: 7 }, (_, i) => ({
        business_date: `2026-08-${15 + i}`,
        day: `Aug ${15 + i}`,
        revenue: 150,
        gross_subtotal: 140,
        paid_bills: 1,
        items_sold: 2,
      })),
      top_items: [{ name: "Pizza", qty: 4, revenue: 600, percentage: 100 }],
      operational_summary: {
        total_orders_placed: 5,
        cancelled_orders_count: 0,
        unsettled_orders_count: 1,
        unsettled_pipeline_cents: 1500,
      },
    });

    const data = await AnalyticsService.fetchOwnerAnalytics("test-cafe-123", 7);

    expect(data).toBeDefined();
    expect(data.rangeRevenueMetrics).toBeDefined();
    expect(data.todayRevenueMetrics).toBeDefined();
    expect(data.prepTimeStats).toBeDefined();
    expect(data.byDay.length).toBe(7);
    expect(data.byHour.length).toBe(24);
    expect(data.peakHour).toBeDefined();
    expect(Array.isArray(data.topItems)).toBe(true);
    expect(Array.isArray(data.recentOrders)).toBe(true);
  });

  it("2. Revenue Math Precision: Shared RevenueMetrics utility produces identical math", () => {
    const mockOrders = [
      { id: "o1", total_cents: 2500, status: "served" },
      { id: "o2", total_cents: 1500, status: "ready" },
      { id: "o3", total_cents: 3000, status: "cancelled" },
    ];

    const metrics = calculateRevenueMetrics(mockOrders as any);

    expect(metrics.grossSalesCents).toBe(4000);
    expect(metrics.netSalesCents).toBe(4000);
    expect(metrics.orderCount).toBe(2);
    expect(metrics.averageOrderValueCents).toBe(2000);
  });

  it("3. Preparation Time Calculation: Calculates accurate minutes from timestamp diffs", () => {
    const now = new Date();
    const t1Created = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
    const t1Updated = now.toISOString();

    const t2Created = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const t2Updated = now.toISOString();

    const mockOrders = [
      { id: "o1", status: "served", created_at: t1Created, updated_at: t1Updated },
      { id: "o2", status: "ready", created_at: t2Created, updated_at: t2Updated },
    ];

    const prep = calculateAveragePrepTime(mockOrders as any);

    expect(prep.hasData).toBe(true);
    expect(prep.averageMinutes).toBe(15);
    expect(prep.value).toBe("~15 mins");
  });

  it("4. Range Multi-Day Support: Correctly formats 30-day and 90-day time series arrays", async () => {
    vi.spyOn(AnalyticsRepository, "fetchOwnerAnalyticsRange").mockImplementation(async (_, rangeDays = 7) => ({
      cafe_id: "test-cafe-123",
      current_business_date: "2026-08-21",
      start_business_date: "2026-08-01",
      end_business_date: "2026-08-21",
      range_days: rangeDays,
      range_financials: {
        gross_subtotal: 0,
        total_discounts: 0,
        total_tax: 0,
        cgst: 0,
        sgst: 0,
        total_service_charge: 0,
        total_round_off: 0,
        net_collected: 0,
        paid_bills_count: 0,
        total_items_sold: 0,
        average_bill_value: 0,
      },
      today_financials: {
        gross_subtotal: 0,
        total_discounts: 0,
        total_tax: 0,
        cgst: 0,
        sgst: 0,
        total_service_charge: 0,
        total_round_off: 0,
        net_collected: 0,
        paid_bills_count: 0,
        total_items_sold: 0,
        average_bill_value: 0,
      },
      tenders: { cash: 0, upi: 0, card: 0, other: 0 },
      by_day: Array.from({ length: rangeDays }, (_, i) => ({
        business_date: `2026-08-${i + 1}`,
        day: `Day ${i + 1}`,
        revenue: 0,
        gross_subtotal: 0,
        paid_bills: 0,
        items_sold: 0,
      })),
      top_items: [],
      operational_summary: {
        total_orders_placed: 0,
        cancelled_orders_count: 0,
        unsettled_orders_count: 0,
        unsettled_pipeline_cents: 0,
      },
    }));

    const data30 = await AnalyticsService.fetchOwnerAnalytics("test-cafe-123", 30);
    expect(data30.byDay.length).toBe(30);

    const data90 = await AnalyticsService.fetchOwnerAnalytics("test-cafe-123", 90);
    expect(data90.byDay.length).toBe(90);
  });

  it("5. Performance Benchmark: AnalyticsService resolves pre-aggregated response in < 1000ms", async () => {
    vi.spyOn(AnalyticsRepository, "fetchOwnerAnalyticsRange").mockResolvedValue({
      cafe_id: "test-cafe-123",
      current_business_date: "2026-08-21",
      start_business_date: "2026-08-15",
      end_business_date: "2026-08-21",
      range_days: 7,
      range_financials: {
        gross_subtotal: 0,
        total_discounts: 0,
        total_tax: 0,
        cgst: 0,
        sgst: 0,
        total_service_charge: 0,
        total_round_off: 0,
        net_collected: 0,
        paid_bills_count: 0,
        total_items_sold: 0,
        average_bill_value: 0,
      },
      today_financials: {
        gross_subtotal: 0,
        total_discounts: 0,
        total_tax: 0,
        cgst: 0,
        sgst: 0,
        total_service_charge: 0,
        total_round_off: 0,
        net_collected: 0,
        paid_bills_count: 0,
        total_items_sold: 0,
        average_bill_value: 0,
      },
      tenders: { cash: 0, upi: 0, card: 0, other: 0 },
      by_day: Array.from({ length: 7 }, (_, i) => ({
        business_date: `2026-08-${15 + i}`,
        day: `Aug ${15 + i}`,
        revenue: 0,
        gross_subtotal: 0,
        paid_bills: 0,
        items_sold: 0,
      })),
      top_items: [],
      operational_summary: {
        total_orders_placed: 0,
        cancelled_orders_count: 0,
        unsettled_orders_count: 0,
        unsettled_pipeline_cents: 0,
      },
    });

    const start = performance.now();
    await AnalyticsService.fetchOwnerAnalytics("test-cafe-123", 7);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1000);
  });
});
