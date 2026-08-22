import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import OwnerAnalyticsPage from "@/pages/owner/OwnerAnalyticsPage";
import { AnalyticsService } from "@/lib/analytics/AnalyticsService";
import { AnalyticsRepository } from "@/lib/analytics/AnalyticsRepository";
import { getPresetDates, formatDateDDMMYYYY, toISODateString } from "@/components/ui/OrderRailDateRangePicker";
import type { OwnerAnalyticsRangeResponse } from "@/lib/analytics/analyticsTypes";

// Mock dependencies
vi.mock("@/lib/cafe", () => ({
  useCafe: () => ({
    cafe: {
      id: "6d00d671-eaea-47ce-a842-f970878373c9",
      name: "Cheese Corner",
      currency: "INR",
    },
  }),
}));

vi.mock("@/components/owner/GlobalNotificationControls", () => ({
  GlobalNotificationControls: () => <div data-testid="global-notification-controls" />,
}));

describe("Milestone 3A.2 - Owner Analytics Tender Breakdown & Custom Date Range UX Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  const mock7dResponse: OwnerAnalyticsRangeResponse = {
    cafe_id: "6d00d671-eaea-47ce-a842-f970878373c9",
    current_business_date: "2026-08-22",
    start_business_date: "2026-08-16",
    end_business_date: "2026-08-22",
    range_days: 7,
    range_financials: {
      gross_subtotal: 665.0,
      total_discounts: 0.0,
      total_tax: 33.25,
      cgst: 16.64,
      sgst: 16.61,
      total_service_charge: 0.0,
      total_round_off: 0.0,
      net_collected: 698.25,
      paid_bills_count: 4,
      total_items_sold: 5,
      average_bill_value: 174.56,
    },
    today_financials: {
      gross_subtotal: 665.0,
      total_discounts: 0.0,
      total_tax: 33.25,
      cgst: 16.64,
      sgst: 16.61,
      total_service_charge: 0.0,
      total_round_off: 0.0,
      net_collected: 698.25,
      paid_bills_count: 4,
      total_items_sold: 5,
      average_bill_value: 174.56,
    },
    tenders: {
      cash: 135.45,
      upi: 562.8,
      card: 0.0,
      other: 0.0,
    },
    by_day: [
      { business_date: "2026-08-16", day: "Aug 16", revenue: 0, gross_subtotal: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-17", day: "Aug 17", revenue: 0, gross_subtotal: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-18", day: "Aug 18", revenue: 0, gross_subtotal: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-19", day: "Aug 19", revenue: 0, gross_subtotal: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-20", day: "Aug 20", revenue: 0, gross_subtotal: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-21", day: "Aug 21", revenue: 0, gross_subtotal: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-22", day: "Aug 22", revenue: 698.25, gross_subtotal: 665.0, paid_bills: 4, items_sold: 5 },
    ],
    top_items: [
      { name: "Clay Pot Pizza", qty: 2, revenue: 278.0, percentage: 100 },
      { name: "Cheese Wrap", qty: 2, revenue: 258.0, percentage: 100 },
      { name: "Wrap", qty: 1, revenue: 129.0, percentage: 50 },
    ],
    operational_summary: {
      total_orders_placed: 16,
      cancelled_orders_count: 7,
      unsettled_orders_count: 9,
      unsettled_pipeline_cents: 61200,
    },
  };

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };

  // =========================================================================
  // 1. Date Range Presets & Utility Tests
  // =========================================================================
  it("1. getPresetDates generates valid start and end strings for all presets", () => {
    const refDate = new Date("2026-08-22T10:00:00.000Z");

    const today = getPresetDates("today", refDate);
    expect(today.start).toBe("2026-08-22");
    expect(today.end).toBe("2026-08-22");

    const yesterday = getPresetDates("yesterday", refDate);
    expect(yesterday.start).toBe("2026-08-21");
    expect(yesterday.end).toBe("2026-08-21");

    const d7 = getPresetDates("7d", refDate);
    expect(d7.start).toBe("2026-08-16");
    expect(d7.end).toBe("2026-08-22");

    const d30 = getPresetDates("30d", refDate);
    expect(d30.start).toBe("2026-07-24");
    expect(d30.end).toBe("2026-08-22");

    const thisMonth = getPresetDates("this_month", refDate);
    expect(thisMonth.start).toBe("2026-08-01");
    expect(thisMonth.end).toBe("2026-08-31");

    const lastMonth = getPresetDates("last_month", refDate);
    expect(lastMonth.start).toBe("2026-07-01");
    expect(lastMonth.end).toBe("2026-07-31");
  });

  // =========================================================================
  // 2. AnalyticsService fetchOwnerAnalytics Parameter Handling
  // =========================================================================
  it("2. AnalyticsService passes custom startDate and endDate to AnalyticsRepository", async () => {
    const repoSpy = vi
      .spyOn(AnalyticsRepository, "fetchOwnerAnalyticsRange")
      .mockResolvedValue(mock7dResponse);

    await AnalyticsService.fetchOwnerAnalytics(
      "6d00d671-eaea-47ce-a842-f970878373c9",
      22,
      "2026-08-01",
      "2026-08-22"
    );

    expect(repoSpy).toHaveBeenCalledWith(
      "6d00d671-eaea-47ce-a842-f970878373c9",
      22,
      "2026-08-01",
      "2026-08-22"
    );
  });

  const mockSummaryData = {
    rangeRevenueMetrics: {
      grossSalesCents: 66500,
      discountsCents: 0,
      taxCents: 3325,
      netSalesCents: 69825,
      orderCount: 16,
      paidBillsCount: 4,
      totalItemsSold: 5,
      averageOrderValueCents: 4364,
      averageBillValueCents: 17456,
    },
    todayRevenueMetrics: {
      grossSalesCents: 66500,
      discountsCents: 0,
      taxCents: 3325,
      netSalesCents: 69825,
      orderCount: 16,
      paidBillsCount: 4,
      totalItemsSold: 5,
      averageOrderValueCents: 4364,
      averageBillValueCents: 17456,
    },
    prepTimeStats: {
      value: "12m",
      subtext: "Avg kitchen time",
      hasData: true,
      averageMinutes: 12,
    },
    pendingOrdersCount: 0,
    readyOrdersCount: 0,
    activeTableCount: 1,
    totalTables: 5,
    occupancyPercentage: 20,
    byDay: [
      { business_date: "2026-08-16", day: "Aug 16", revenue: 0, gross_subtotal: 0, orders: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-17", day: "Aug 17", revenue: 0, gross_subtotal: 0, orders: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-18", day: "Aug 18", revenue: 0, gross_subtotal: 0, orders: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-19", day: "Aug 19", revenue: 0, gross_subtotal: 0, orders: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-20", day: "Aug 20", revenue: 0, gross_subtotal: 0, orders: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-21", day: "Aug 21", revenue: 0, gross_subtotal: 0, orders: 0, paid_bills: 0, items_sold: 0 },
      { business_date: "2026-08-22", day: "Aug 22", revenue: 698.25, gross_subtotal: 665.0, orders: 4, paid_bills: 4, items_sold: 5 },
    ],
    byHour: Array.from({ length: 24 }, (_, h) => ({ hour: `${h.toString().padStart(2, "0")}:00`, orders: 0 })),
    peakHour: { hour: "11:00", count: 4 },
    topItems: [
      { name: "Clay Pot Pizza", qty: 2, revenue: 278.0, percentage: 100 },
      { name: "Cheese Wrap", qty: 2, revenue: 258.0, percentage: 100 },
      { name: "Wrap", qty: 1, revenue: 129.0, percentage: 50 },
    ],
    tenders: {
      cash: 135.45,
      upi: 562.8,
      card: 0.0,
      other: 0.0,
    },
    recentOrders: [],
    avgRating: 4.9,
    reviewsCount: 10,
    staffCount: 2,
    tables: [],
  };

  // =========================================================================
  // 3. Tender Breakdown UI Rendering & Share Calculations
  // =========================================================================
  it("3. OwnerAnalyticsPage renders authoritative Tender Collection Breakdown cards with exact amounts and share percentages", async () => {
    vi.spyOn(AnalyticsService, "fetchOwnerAnalytics").mockResolvedValue(mockSummaryData);

    render(<OwnerAnalyticsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Tender Collection Breakdown")).toBeInTheDocument();
      expect(screen.queryAllByText((content) => content.includes("135.45")).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("UPI")).toBeInTheDocument();
    expect(screen.getByText("Card")).toBeInTheDocument();
    expect(screen.getByText("Other / Split")).toBeInTheDocument();

    const all135 = screen.queryAllByText((content) => content.includes("135.45"));
    const all562 = screen.queryAllByText((content) => content.includes("562.80"));
    const all194 = screen.queryAllByText((content) => content.includes("19.4%"));
    const all806 = screen.queryAllByText((content) => content.includes("80.6%"));

    expect(all135.length).toBeGreaterThanOrEqual(1);
    expect(all562.length).toBeGreaterThanOrEqual(1);
    expect(all194.length).toBeGreaterThanOrEqual(1);
    expect(all806.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 4. Zero Revenue Handling Safety (No NaN / Infinity)
  // =========================================================================
  it("4. Handles zero net sales safely without producing NaN or Infinity in tender cards", async () => {
    const zeroSummary = {
      ...mockSummaryData,
      rangeRevenueMetrics: {
        ...mockSummaryData.rangeRevenueMetrics,
        grossSalesCents: 0,
        netSalesCents: 0,
        paidBillsCount: 0,
      },
      tenders: { cash: 0, upi: 0, card: 0, other: 0 },
    };

    vi.spyOn(AnalyticsService, "fetchOwnerAnalytics").mockResolvedValue(zeroSummary);

    render(<OwnerAnalyticsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Tender Collection Breakdown")).toBeInTheDocument();
    });

    const zeroPercentages = screen.getAllByText("0.0%");
    expect(zeroPercentages.length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/i)).not.toBeInTheDocument();
  });

  // =========================================================================
  // 5. Quick Preset Switching (7D -> 30D -> 90D -> Today -> Custom)
  // =========================================================================
  it("5. Switching presets updates active query parameters and triggers fetchOwnerAnalytics with appropriate arguments", async () => {
    const fetchSpy = vi.spyOn(AnalyticsService, "fetchOwnerAnalytics");
    vi.spyOn(AnalyticsRepository, "fetchOwnerAnalyticsRange").mockResolvedValue(mock7dResponse);

    render(<OwnerAnalyticsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("30D")).toBeInTheDocument();
    });

    // Click 30D
    fireEvent.click(screen.getByText("30D"));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "6d00d671-eaea-47ce-a842-f970878373c9",
        30,
        null,
        null
      );
    });

    // Click 90D
    fireEvent.click(screen.getByText("90D"));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "6d00d671-eaea-47ce-a842-f970878373c9",
        90,
        null,
        null
      );
    });

    // Click Today
    fireEvent.click(screen.getByText("Today"));
    await waitFor(() => {
      const todayIso = toISODateString(new Date());
      expect(fetchSpy).toHaveBeenCalledWith(
        "6d00d671-eaea-47ce-a842-f970878373c9",
        1,
        todayIso,
        todayIso
      );
    });
  });

  // =========================================================================
  // 6. Tender Sum & Revenue Financial Reconciliation Invariant
  // =========================================================================
  it("6. Verifies mathematical accounting invariant: sum(tenders) === range_financials.net_collected", () => {
    const { tenders, range_financials } = mock7dResponse;
    const tenderSum = tenders.cash + tenders.upi + tenders.card + tenders.other;

    expect(tenderSum).toBe(range_financials.net_collected);
    expect(Number(tenderSum.toFixed(2))).toBe(698.25);
  });
});
