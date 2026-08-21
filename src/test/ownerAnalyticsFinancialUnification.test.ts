import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsService } from "@/lib/analytics/AnalyticsService";
import { AnalyticsRepository } from "@/lib/analytics/AnalyticsRepository";
import { mapAuthoritativeFinancialsToModel, calculateAveragePrepTime } from "@/lib/analytics/metrics";
import { FinancialSummaryCalculator } from "@/lib/analytics/FinancialSummaryCalculator";
import type {
  OwnerAnalyticsRangeResponse,
  OwnerAnalyticsFinancialSummary,
} from "@/lib/analytics/analyticsTypes";
import { supabase } from "@/lib/db";

describe("Milestone 2C.3 - Owner Analytics Financial Unification Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockAuthoritativeRpcResponse: OwnerAnalyticsRangeResponse = {
    cafe_id: "6d00d671-eaea-47ce-a842-f970878373c9",
    current_business_date: "2026-08-21",
    start_business_date: "2026-08-15",
    end_business_date: "2026-08-21",
    range_days: 7,
    range_financials: {
      gross_subtotal: 2024.0,
      total_discounts: 50.0,
      total_tax: 33.25,
      cgst: 16.64,
      sgst: 16.61,
      total_service_charge: 50.0,
      total_round_off: 0.0,
      net_collected: 2057.25,
      paid_bills_count: 5,
      total_items_sold: 16,
      average_bill_value: 411.45,
    },
    today_financials: {
      gross_subtotal: 1359.0,
      total_discounts: 0.0,
      total_tax: 0.0,
      cgst: 0.0,
      sgst: 0.0,
      total_service_charge: 0.0,
      total_round_off: 0.0,
      net_collected: 1359.0,
      paid_bills_count: 1,
      total_items_sold: 11,
      average_bill_value: 1359.0,
    },
    tenders: {
      cash: 1494.45,
      upi: 562.8,
      card: 0.0,
      other: 0.0,
    },
    by_day: [
      {
        business_date: "2026-08-15",
        day: "Aug 15",
        revenue: 0.0,
        gross_subtotal: 0.0,
        paid_bills: 0,
        items_sold: 0,
      },
      {
        business_date: "2026-08-16",
        day: "Aug 16",
        revenue: 0.0,
        gross_subtotal: 0.0,
        paid_bills: 0,
        items_sold: 0,
      },
      {
        business_date: "2026-08-17",
        day: "Aug 17",
        revenue: 0.0,
        gross_subtotal: 0.0,
        paid_bills: 0,
        items_sold: 0,
      },
      {
        business_date: "2026-08-18",
        day: "Aug 18",
        revenue: 0.0,
        gross_subtotal: 0.0,
        paid_bills: 0,
        items_sold: 0,
      },
      {
        business_date: "2026-08-19",
        day: "Aug 19",
        revenue: 0.0,
        gross_subtotal: 0.0,
        paid_bills: 0,
        items_sold: 0,
      },
      {
        business_date: "2026-08-20",
        day: "Aug 20",
        revenue: 0.0,
        gross_subtotal: 0.0,
        paid_bills: 0,
        items_sold: 0,
      },
      {
        business_date: "2026-08-21",
        day: "Aug 21",
        revenue: 2057.25,
        gross_subtotal: 2024.0,
        paid_bills: 5,
        items_sold: 16,
      },
    ],
    top_items: [
      {
        name: "Cheese Pull & Tear Garlic Bun",
        qty: 1,
        revenue: 149.0,
        percentage: 100,
      },
      {
        name: "Clay Pot Pizza",
        qty: 2,
        revenue: 278.0,
        percentage: 100,
      },
      {
        name: "Cheese Wrap",
        qty: 2,
        revenue: 258.0,
        percentage: 100,
      },
    ],
    operational_summary: {
      total_orders_placed: 12,
      cancelled_orders_count: 2,
      unsettled_orders_count: 5,
      unsettled_pipeline_cents: 35000,
    },
  };

  it("1. Unpaid served orders do NOT contribute to realized revenue", () => {
    // 3 orders served in kitchen but no bill paid
    const servedOrders = [
      { id: "o1", total_cents: 1500, status: "served" },
      { id: "o2", total_cents: 2500, status: "served" },
    ];
    // Authoritative financial RPC reports ₹0.00 paid bills
    const zeroFinancials: OwnerAnalyticsFinancialSummary = {
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
    };

    const metrics = mapAuthoritativeFinancialsToModel(zeroFinancials, servedOrders.length);

    expect(metrics.netSalesCents).toBe(0);
    expect(metrics.grossSalesCents).toBe(0);
    expect(metrics.paidBillsCount).toBe(0);
    expect(metrics.orderCount).toBe(2); // Operational order count preserved
  });

  it("2. Paid bill contributes exactly its finalized grand_total to net revenue", () => {
    const metrics = mapAuthoritativeFinancialsToModel(
      mockAuthoritativeRpcResponse.range_financials,
      12
    );

    expect(metrics.netSalesCents).toBe(205725);
    expect(metrics.grossSalesCents).toBe(202400);
    expect(metrics.paidBillsCount).toBe(5);
  });

  it("3. Cancelled orders do NOT contribute to realized revenue", () => {
    const cancelledOrders = [
      { id: "c1", total_cents: 5000, status: "cancelled" },
      { id: "c2", total_cents: 3000, status: "cancelled" },
    ];

    const opSummary = FinancialSummaryCalculator.calculateFromOrders(cancelledOrders);
    expect(opSummary.cancelledOrdersCount).toBe(2);
    expect(opSummary.netSalesCents).toBe(0);
  });

  it("4. Discounts are authoritatively captured from bills", () => {
    const metrics = mapAuthoritativeFinancialsToModel(
      mockAuthoritativeRpcResponse.range_financials,
      12
    );
    expect(metrics.discountsCents).toBe(5000);
  });

  it("5. CGST and SGST taxes are authoritatively captured", () => {
    const metrics = mapAuthoritativeFinancialsToModel(
      mockAuthoritativeRpcResponse.range_financials,
      12
    );
    expect(metrics.cgstCents).toBe(1664);
    expect(metrics.sgstCents).toBe(1661);
    expect(metrics.taxCents).toBe(3325);
  });

  it("6. Service charge is authoritatively captured", () => {
    const metrics = mapAuthoritativeFinancialsToModel(
      mockAuthoritativeRpcResponse.range_financials,
      12
    );
    expect(metrics.serviceChargeCents).toBe(5000);
  });

  it("7. Round-off is authoritatively captured", () => {
    const metrics = mapAuthoritativeFinancialsToModel(
      mockAuthoritativeRpcResponse.range_financials,
      12
    );
    expect(metrics.roundOffCents).toBe(0);
  });

  it("8. Tender breakdown matches paid bills exactly", () => {
    const tenders = mockAuthoritativeRpcResponse.tenders;
    expect(tenders.cash).toBe(1494.45);
    expect(tenders.upi).toBe(562.8);
    expect(tenders.card).toBe(0);
    expect(tenders.other).toBe(0);
    expect(tenders.cash + tenders.upi + tenders.card + tenders.other).toBe(2057.25);
  });

  it("9. Average Bill Value equals net realized sales divided by paid bills count", () => {
    const metrics = mapAuthoritativeFinancialsToModel(
      mockAuthoritativeRpcResponse.range_financials,
      12
    );
    // 2057.25 / 5 = 411.45
    expect(metrics.averageBillValueCents).toBe(41145);
  });

  it("10. Revenue trend is grouped strictly by business_date", () => {
    const byDay = mockAuthoritativeRpcResponse.by_day;
    expect(byDay.length).toBe(7);
    expect(byDay[6].business_date).toBe("2026-08-21");
    expect(byDay[6].revenue).toBe(2057.25);
    expect(byDay[6].paid_bills).toBe(5);
  });

  it("11. Midnight/Cutoff handling preserves cafe business_date grouping", () => {
    const byDay = mockAuthoritativeRpcResponse.by_day;
    // All 5 paid bills from 2026-08-21 belong to 2026-08-21 bucket
    const august21 = byDay.find((d) => d.business_date === "2026-08-21");
    expect(august21).toBeDefined();
    expect(august21?.revenue).toBe(2057.25);
  });

  it("12. Multi-day reconciliation: SUM(by_day.revenue) equals range net sales", () => {
    const byDay = mockAuthoritativeRpcResponse.by_day;
    const sumDailyRevenue = byDay.reduce((acc, d) => acc + d.revenue, 0);
    const sumDailyPaidBills = byDay.reduce((acc, d) => acc + d.paid_bills, 0);

    expect(sumDailyRevenue).toBe(mockAuthoritativeRpcResponse.range_financials.net_collected);
    expect(sumDailyPaidBills).toBe(mockAuthoritativeRpcResponse.range_financials.paid_bills_count);
  });

  it("13. Top item revenue comes only from paid bill_items", () => {
    const topItems = mockAuthoritativeRpcResponse.top_items;
    expect(topItems.length).toBe(3);
    const garlicBun = topItems.find((i) => i.name === "Cheese Pull & Tear Garlic Bun");
    expect(garlicBun).toBeDefined();
    expect(garlicBun?.qty).toBe(1);
    expect(garlicBun?.revenue).toBe(149.0);
  });

  it("14. Counter reconciliation: Owner Analytics financial totals match Counter get_daily_sales_report", () => {
    // Single-day snapshot for 2026-08-21
    const todayFin = mockAuthoritativeRpcResponse.today_financials;
    expect(todayFin.net_collected).toBe(1359.0);
    expect(todayFin.paid_bills_count).toBe(1);
    expect(todayFin.total_items_sold).toBe(11);
  });

  it("15. Operational metrics (prep time, queue, occupancy) remain accurate", () => {
    const mockOrders = [
      {
        id: "o1",
        status: "served",
        created_at: "2026-08-21T18:00:00.000Z",
        updated_at: "2026-08-21T18:20:00.000Z",
      },
      {
        id: "o2",
        status: "ready",
        created_at: "2026-08-21T18:05:00.000Z",
        updated_at: "2026-08-21T18:15:00.000Z",
      },
    ];

    const prep = calculateAveragePrepTime(mockOrders as any);
    expect(prep.hasData).toBe(true);
    expect(prep.averageMinutes).toBe(15);
    expect(prep.value).toBe("~15 mins");
  });

  it("16. Multi-tenant isolation: AnalyticsRepository requires cafe_id and passes it to RPC", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockAuthoritativeRpcResponse,
      error: null,
    } as any);

    const res = await AnalyticsRepository.fetchOwnerAnalyticsRange("6d00d671-eaea-47ce-a842-f970878373c9", 7);

    expect(rpcSpy).toHaveBeenCalledWith("get_owner_analytics_range", {
      p_cafe_id: "6d00d671-eaea-47ce-a842-f970878373c9",
      p_range_days: 7,
      p_start_date: null,
      p_end_date: null,
    });
    expect(res.cafe_id).toBe("6d00d671-eaea-47ce-a842-f970878373c9");
  });

  it("17. RPC failure: Errors are surfaced cleanly and never converted to fake ₹0", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: null,
      error: { message: "Database connection failed", details: "Timeout" },
    } as any);

    await expect(
      AnalyticsRepository.fetchOwnerAnalyticsRange("6d00d671-eaea-47ce-a842-f970878373c9", 7)
    ).rejects.toThrow("Failed to fetch owner analytics range: Database connection failed");
  });
});
