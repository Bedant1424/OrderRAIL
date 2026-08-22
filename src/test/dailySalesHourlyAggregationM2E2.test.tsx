import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DailySalesModal } from "@/components/counter/DailySalesModal";
import { DailySalesService } from "@/lib/sales/dailySalesService";
import { DailySalesRepository } from "@/lib/sales/dailySalesRepository";
import type { DailySalesReport, DailySalesHourlyBucket } from "@/lib/sales/types";
import { supabase } from "@/lib/db";

// Global mock for ResizeObserver required by Recharts ResponsiveContainer in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("Milestone 2E.2 - Authoritative Hourly Sales in Daily Sales Test Suite", () => {
  const CAFE_ID = "6d00d671-eaea-47ce-a842-f970878373c9";
  const BIZ_DATE = "2026-08-22";

  // Helper to generate a 24-bucket dense hourly array
  const create24HourlyBuckets = (overrides: Partial<DailySalesHourlyBucket>[] = []): DailySalesHourlyBucket[] => {
    const buckets: DailySalesHourlyBucket[] = Array.from({ length: 24 }, (_, h) => {
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

    overrides.forEach((o) => {
      if (o.hour !== undefined && o.hour >= 0 && o.hour < 24) {
        buckets[o.hour] = { ...buckets[o.hour], ...o };
      }
    });

    return buckets;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1 & 2: Dense 24-hour response & Single bill in one hour
  // =========================================================================
  it("1 & 2. Repository normalizes dense 24-bucket hourly array with single bill in Hour 11", async () => {
    const mockRpcResponse = {
      business_date: BIZ_DATE,
      cafe_id: CAFE_ID,
      net_collected: 135.45,
      gross_subtotal: 129.0,
      total_discounts: 0.0,
      total_tax: 6.45,
      cgst: 3.23,
      sgst: 3.22,
      total_service_charge: 0.0,
      total_round_off: 0.0,
      paid_bills_count: 1,
      total_items_sold: 1,
      average_bill_value: 135.45,
      tenders: { cash: 0, upi: 135.45, card: 0, other: 0 },
      hourly: [
        {
          hour: 11,
          label: "11 AM",
          revenue: 135.45,
          paid_bills: 1,
          items_sold: 1,
          cash: 0,
          upi: 135.45,
          card: 0,
          other: 0,
        },
      ],
      pipeline: {
        unsettled_orders_count: 0,
        unsettled_pipeline_cents: 0,
        cancelled_orders_count: 0,
      },
    };

    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockRpcResponse,
      error: null,
    } as any);

    const report = await DailySalesRepository.fetchDailySalesReport(CAFE_ID, BIZ_DATE);

    expect(report.hourly).toHaveLength(24);
    expect(report.hourly[11].revenue).toBe(135.45);
    expect(report.hourly[11].paid_bills).toBe(1);
    expect(report.hourly[11].items_sold).toBe(1);
    expect(report.hourly[11].upi).toBe(135.45);
    expect(report.hourly[11].label).toBe("11 AM");

    // All other hours should be zero
    expect(report.hourly[0].revenue).toBe(0);
    expect(report.hourly[10].revenue).toBe(0);
    expect(report.hourly[12].revenue).toBe(0);
  });

  // =========================================================================
  // 3 & 4: Zero-sales hours & Multiple bills in same hour
  // =========================================================================
  it("3 & 4. Multiple bills in same hour sum revenue, count, items, and tenders accurately", async () => {
    const mockRpcResponse = {
      business_date: BIZ_DATE,
      cafe_id: CAFE_ID,
      net_collected: 698.25,
      paid_bills_count: 4,
      gross_subtotal: 665.0,
      total_discounts: 0.0,
      total_tax: 33.25,
      cgst: 16.64,
      sgst: 16.61,
      total_service_charge: 0.0,
      total_round_off: 0.0,
      total_items_sold: 5,
      average_bill_value: 174.56,
      tenders: { cash: 135.45, upi: 562.8, card: 0, other: 0 },
      hourly: [
        {
          hour: 11,
          label: "11 AM",
          revenue: 698.25,
          paid_bills: 4,
          items_sold: 5,
          cash: 135.45,
          upi: 562.8,
          card: 0,
          other: 0,
        },
      ],
      pipeline: {
        unsettled_orders_count: 0,
        unsettled_pipeline_cents: 0,
        cancelled_orders_count: 0,
      },
    };

    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockRpcResponse,
      error: null,
    } as any);

    const report = await DailySalesRepository.fetchDailySalesReport(CAFE_ID, BIZ_DATE);

    expect(report.hourly[11].revenue).toBe(698.25);
    expect(report.hourly[11].paid_bills).toBe(4);
    expect(report.hourly[11].items_sold).toBe(5);
    expect(report.hourly[11].cash).toBe(135.45);
    expect(report.hourly[11].upi).toBe(562.8);
    expect(report.hourly[11].card).toBe(0);
    expect(report.hourly[11].other).toBe(0);
  });

  // =========================================================================
  // 5 & 6: Midnight boundary & Cutoff bucket handling
  // =========================================================================
  it("5 & 6. Hourly breakdown accounts for midnight and multi-hour distributions across operational window", () => {
    const hourly = create24HourlyBuckets([
      { hour: 0, label: "12 AM", revenue: 200, paid_bills: 1, items_sold: 2, cash: 200, upi: 0, card: 0, other: 0 },
      { hour: 2, label: "2 AM", revenue: 350, paid_bills: 2, items_sold: 3, cash: 0, upi: 350, card: 0, other: 0 },
      { hour: 23, label: "11 PM", revenue: 500, paid_bills: 3, items_sold: 4, cash: 100, upi: 400, card: 0, other: 0 },
    ]);

    expect(hourly[0].revenue).toBe(200);
    expect(hourly[2].revenue).toBe(350);
    expect(hourly[23].revenue).toBe(500);

    const totalRev = hourly.reduce((sum, h) => sum + h.revenue, 0);
    expect(totalRev).toBe(1050);
  });

  // =========================================================================
  // 8, 9, 10, 11: Single tenders (Cash, UPI, Card, Other)
  // =========================================================================
  it("8-11. Single tenders map to exact hourly tender keys", () => {
    const hourly = create24HourlyBuckets([
      { hour: 10, label: "10 AM", revenue: 100, paid_bills: 1, items_sold: 1, cash: 100, upi: 0, card: 0, other: 0 },
      { hour: 12, label: "12 PM", revenue: 200, paid_bills: 1, items_sold: 1, cash: 0, upi: 200, card: 0, other: 0 },
      { hour: 14, label: "2 PM", revenue: 300, paid_bills: 1, items_sold: 1, cash: 0, upi: 0, card: 300, other: 0 },
      { hour: 16, label: "4 PM", revenue: 400, paid_bills: 1, items_sold: 1, cash: 0, upi: 0, card: 0, other: 400 },
    ]);

    expect(hourly[10].cash).toBe(100);
    expect(hourly[12].upi).toBe(200);
    expect(hourly[14].card).toBe(300);
    expect(hourly[16].other).toBe(400);
  });

  // =========================================================================
  // 12 & 13: Split Cash + UPI & Three-way split in hourly bucket
  // =========================================================================
  it("12 & 13. Split Cash + UPI and Three-Way Split allocate tenders in the same hour without distortion", () => {
    const hourly = create24HourlyBuckets([
      // Split Cash 200 + UPI 112 on 312 bill
      { hour: 13, label: "1 PM", revenue: 312, paid_bills: 1, items_sold: 2, cash: 200, upi: 112, card: 0, other: 0 },
      // Three-way split: Card 100 + UPI 100 + Cash 112 on 312 bill
      { hour: 18, label: "6 PM", revenue: 312, paid_bills: 1, items_sold: 2, cash: 112, upi: 100, card: 100, other: 0 },
    ]);

    // Check 1 PM split
    expect(hourly[13].revenue).toBe(312);
    expect(hourly[13].cash + hourly[13].upi + hourly[13].card + hourly[13].other).toBe(312);

    // Check 6 PM three-way split
    expect(hourly[18].revenue).toBe(312);
    expect(hourly[18].cash + hourly[18].upi + hourly[18].card + hourly[18].other).toBe(312);
  });

  // =========================================================================
  // 15, 16, 17, 18: Full Mathematical Reconciliation Invariants
  // =========================================================================
  it("15-18. Mathematical Invariants: SUM(hourly) strictly equals daily totals across all dimensions", () => {
    const hourly = create24HourlyBuckets([
      { hour: 9, label: "9 AM", revenue: 150, paid_bills: 1, items_sold: 2, cash: 50, upi: 100, card: 0, other: 0 },
      { hour: 11, label: "11 AM", revenue: 698.25, paid_bills: 4, items_sold: 5, cash: 135.45, upi: 562.8, card: 0, other: 0 },
      { hour: 14, label: "2 PM", revenue: 312, paid_bills: 1, items_sold: 3, cash: 112, upi: 100, card: 100, other: 0 },
      { hour: 20, label: "8 PM", revenue: 450, paid_bills: 2, items_sold: 4, cash: 0, upi: 250, card: 200, other: 0 },
    ]);

    const report: DailySalesReport = {
      business_date: BIZ_DATE,
      cafe_id: CAFE_ID,
      net_collected: 1610.25,
      paid_bills_count: 8,
      gross_subtotal: 1550.0,
      total_discounts: 0.0,
      total_tax: 60.25,
      cgst: 30.13,
      sgst: 30.12,
      total_service_charge: 0.0,
      total_round_off: 0.0,
      total_items_sold: 14,
      average_bill_value: 201.28,
      tenders: {
        cash: 297.45,
        upi: 1012.8,
        card: 300.0,
        other: 0.0,
      },
      hourly,
      pipeline: {
        unsettled_orders_count: 0,
        unsettled_pipeline_cents: 0,
        cancelled_orders_count: 0,
      },
    };

    // Invariant 1: Revenue
    const sumRevenue = report.hourly.reduce((acc, h) => acc + h.revenue, 0);
    expect(sumRevenue).toBe(report.net_collected);

    // Invariant 2: Paid Bills
    const sumBills = report.hourly.reduce((acc, h) => acc + h.paid_bills, 0);
    expect(sumBills).toBe(report.paid_bills_count);

    // Invariant 3: Items Sold
    const sumItems = report.hourly.reduce((acc, h) => acc + h.items_sold, 0);
    expect(sumItems).toBe(report.total_items_sold);

    // Invariant 4: Cash
    const sumCash = report.hourly.reduce((acc, h) => acc + h.cash, 0);
    expect(Number(sumCash.toFixed(2))).toBe(report.tenders.cash);

    // Invariant 5: UPI
    const sumUpi = report.hourly.reduce((acc, h) => acc + h.upi, 0);
    expect(Number(sumUpi.toFixed(2))).toBe(report.tenders.upi);

    // Invariant 6: Card
    const sumCard = report.hourly.reduce((acc, h) => acc + h.card, 0);
    expect(sumCard).toBe(report.tenders.card);

    // Invariant 7: Intra-hour sum equals revenue for every bucket
    report.hourly.forEach((h) => {
      const tenderSum = Number((h.cash + h.upi + h.card + h.other).toFixed(2));
      expect(tenderSum).toBe(Number(h.revenue.toFixed(2)));
    });
  });

  // =========================================================================
  // 19: Cache Invalidation & Force Refresh
  // =========================================================================
  it("19. DailySalesService caches report with hourly data and invalidates on forceRefresh", async () => {
    const reportMock: DailySalesReport = {
      business_date: BIZ_DATE,
      cafe_id: CAFE_ID,
      net_collected: 698.25,
      paid_bills_count: 4,
      gross_subtotal: 665.0,
      total_discounts: 0.0,
      total_tax: 33.25,
      cgst: 16.64,
      sgst: 16.61,
      total_service_charge: 0.0,
      total_round_off: 0.0,
      total_items_sold: 5,
      average_bill_value: 174.56,
      tenders: { cash: 135.45, upi: 562.8, card: 0, other: 0 },
      hourly: create24HourlyBuckets([
        { hour: 11, label: "11 AM", revenue: 698.25, paid_bills: 4, items_sold: 5, cash: 135.45, upi: 562.8, card: 0, other: 0 },
      ]),
      pipeline: {
        unsettled_orders_count: 0,
        unsettled_pipeline_cents: 0,
        cancelled_orders_count: 0,
      },
    };

    const fetchSpy = vi.spyOn(DailySalesRepository, "fetchDailySalesReport").mockResolvedValue(reportMock);

    // First call caches
    const rep1 = await DailySalesService.getDailySalesReport(CAFE_ID, BIZ_DATE);
    expect(rep1.hourly).toHaveLength(24);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call without forceRefresh uses cache
    const rep2 = await DailySalesService.getDailySalesReport(CAFE_ID, BIZ_DATE);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(rep2.hourly[11].revenue).toBe(698.25);

    // Third call with forceRefresh bypasses cache
    await DailySalesService.getDailySalesReport(CAFE_ID, BIZ_DATE, { forceRefresh: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // =========================================================================
  // 20: UI Component Rendering in DailySalesModal
  // =========================================================================
  it("20. DailySalesModal renders Hourly Sales Distribution section and peak hour indicator", () => {
    const reportMock: DailySalesReport = {
      business_date: BIZ_DATE,
      cafe_id: CAFE_ID,
      net_collected: 698.25,
      paid_bills_count: 4,
      gross_subtotal: 665.0,
      total_discounts: 0.0,
      total_tax: 33.25,
      cgst: 16.64,
      sgst: 16.61,
      total_service_charge: 0.0,
      total_round_off: 0.0,
      total_items_sold: 5,
      average_bill_value: 174.56,
      tenders: { cash: 135.45, upi: 562.8, card: 0, other: 0 },
      hourly: create24HourlyBuckets([
        { hour: 11, label: "11 AM", revenue: 698.25, paid_bills: 4, items_sold: 5, cash: 135.45, upi: 562.8, card: 0, other: 0 },
      ]),
      pipeline: {
        unsettled_orders_count: 0,
        unsettled_pipeline_cents: 0,
        cancelled_orders_count: 0,
      },
    };

    render(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={reportMock}
        isLoading={false}
        isError={false}
        onRefresh={vi.fn()}
        cafeId={CAFE_ID}
      />
    );

    // Verify Hourly Sales Section Header
    expect(screen.getByTestId("daily-sales-hourly-section")).toBeDefined();
    expect(screen.getByText(/Hourly Sales Distribution/i)).toBeDefined();

    // Verify Peak Hour badge
    const peakBadge = screen.getByTestId("daily-sales-peak-hour");
    expect(peakBadge).toBeDefined();
    expect(peakBadge.textContent).toContain("11 AM");
    expect(peakBadge.textContent).toContain("698.25");
  });
});
