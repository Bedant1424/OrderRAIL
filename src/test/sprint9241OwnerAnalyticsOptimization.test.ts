import { describe, it, expect } from "vitest";
import { AnalyticsService } from "@/lib/analytics/analyticsService";
import { calculateRevenueMetrics, calculateAveragePrepTime } from "@/lib/analytics/metrics";

describe("Sprint 9.2.4.1 — Owner Analytics Performance Optimization Tests", () => {
  it("1. Pre-Aggregated Structure: AnalyticsService returns pre-aggregated analytics without overdraw", async () => {
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
    const data30 = await AnalyticsService.fetchOwnerAnalytics("test-cafe-123", 30);
    expect(data30.byDay.length).toBe(30);

    const data90 = await AnalyticsService.fetchOwnerAnalytics("test-cafe-123", 90);
    expect(data90.byDay.length).toBe(90);
  });

  it("5. Performance Benchmark: AnalyticsService resolves pre-aggregated response in < 1000ms", async () => {
    const start = performance.now();
    await AnalyticsService.fetchOwnerAnalytics("test-cafe-123", 7);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1000);
  });
});
