import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import OwnerAnalyticsPage from "@/pages/owner/OwnerAnalyticsPage";
import { AnalyticsService, type OwnerAnalyticsSummaryData } from "@/lib/analytics/AnalyticsService";
import type { OwnerAnalyticsRangeResponse } from "@/lib/analytics/analyticsTypes";
import {
  generateOwnerAnalyticsCsv,
  downloadOwnerAnalyticsCsv,
  generateOwnerAnalyticsPrintHtml,
  printOwnerAnalyticsPdf,
  type CafeExportInfo,
} from "@/lib/analytics/ownerAnalyticsExporter";

// Mock dependencies
vi.mock("@/lib/cafe", () => ({
  useCafe: () => ({
    cafe: {
      id: "6d00d671-eaea-47ce-a842-f970878373c9",
      name: "Cheese Corner",
      address: "123 Gourmet St, Foodville",
      phone: "+91 98765 43210",
      gstin: "27AAAAA0000A1Z5",
      currency: "INR",
    },
  }),
}));

vi.mock("@/components/owner/GlobalNotificationControls", () => ({
  GlobalNotificationControls: () => <div data-testid="global-notification-controls" />,
}));

describe("Milestone 3A.3 - Authoritative Owner Analytics CSV & PDF Export Tests", () => {
  const mockCafe: CafeExportInfo = {
    id: "6d00d671-eaea-47ce-a842-f970878373c9",
    name: "Cheese Corner",
    address: "123 Gourmet St, Foodville",
    phone: "+91 98765 43210",
    gstin: "27AAAAA0000A1Z5",
    currency: "INR",
  };

  const mockRpcResponse: OwnerAnalyticsRangeResponse = {
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

  const mockSummaryData: OwnerAnalyticsSummaryData = {
    rangeRevenueMetrics: {
      grossSalesCents: 66500,
      discountsCents: 0,
      taxCents: 3325,
      cgstCents: 1664,
      sgstCents: 1661,
      serviceChargeCents: 0,
      roundOffCents: 0,
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
      cgstCents: 1664,
      sgstCents: 1661,
      serviceChargeCents: 0,
      roundOffCents: 0,
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
    pendingOrdersCount: 2,
    readyOrdersCount: 1,
    activeTableCount: 1,
    totalTables: 5,
    occupancyPercentage: 20,
    byDay: mockRpcResponse.by_day.map((d) => ({
      business_date: d.business_date,
      day: d.day,
      revenue: d.revenue,
      gross_subtotal: d.gross_subtotal,
      orders: d.paid_bills,
      paid_bills: d.paid_bills,
      items_sold: d.items_sold,
    })),
    byHour: Array.from({ length: 24 }, (_, h) => ({ hour: `${h.toString().padStart(2, "0")}:00`, orders: 0 })),
    peakHour: { hour: "11:00", count: 4 },
    topItems: mockRpcResponse.top_items,
    tenders: mockRpcResponse.tenders,
    recentOrders: [],
    avgRating: 4.9,
    reviewsCount: 10,
    staffCount: 2,
    tables: [],
    rawRpc: mockRpcResponse,
    operationalSummary: mockRpcResponse.operational_summary,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    if (typeof global.URL.createObjectURL !== "function") {
      global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    }
    if (typeof global.URL.revokeObjectURL !== "function") {
      global.URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
  // 1-3. CSV Format, RFC 4180 Compliance & Six Sections Existence
  // =========================================================================
  it("1. CSV contains all 6 required logical sections and is RFC 4180 compliant", () => {
    const csv = generateOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days");

    expect(csv).toContain('"OWNER ANALYTICS MANAGEMENT REPORT - CHEESE CORNER"');
    expect(csv).toContain('"SECTION 1: FINANCIAL & TAX SUMMARY"');
    expect(csv).toContain('"SECTION 2: TENDER COLLECTION BREAKDOWN"');
    expect(csv).toContain('"SECTION 3: DAILY SALES TREND"');
    expect(csv).toContain('"SECTION 4: TOP SELLING MENU ITEMS"');
    expect(csv).toContain('"SECTION 5: OPERATIONAL SUMMARY & PIPELINE"');
  });

  it("2. Section 1 contains cafe metadata, date range, timezone and IST timestamp", () => {
    const csv = generateOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "16/08/2026 – 22/08/2026 (Last 7 Days)");

    expect(csv).toContain('Cafe Name,"Cheese Corner"');
    expect(csv).toContain('Address,"123 Gourmet St, Foodville"');
    expect(csv).toContain('GSTIN,"27AAAAA0000A1Z5"');
    expect(csv).toContain('Selected Business Date Range,"16/08/2026 – 22/08/2026 (Last 7 Days)"');
    expect(csv).toContain('Timezone,"Asia/Kolkata"');
    expect(csv).toContain('Currency,"INR"');
  });

  it("3. Section 2 contains authoritative financial and tax summary metrics", () => {
    const csv = generateOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days");

    expect(csv).toContain("Gross Subtotal,665.00");
    expect(csv).toContain("Total Discounts,0.00");
    expect(csv).toContain("CGST,16.64");
    expect(csv).toContain("SGST,16.61");
    expect(csv).toContain("Total Tax Collected,33.25");
    expect(csv).toContain("Service Charge,0.00");
    expect(csv).toContain("Round Off,0.00");
    expect(csv).toContain("Net Collected Sales,698.25");
    expect(csv).toContain("Paid Bills Count,4");
    expect(csv).toContain("Total Items Sold,5");
    expect(csv).toContain("Average Bill Value,174.56");
  });

  it("4. Section 3 contains accurate tender breakdown amounts and exact share percentages", () => {
    const csv = generateOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days");

    expect(csv).toContain("Cash,135.45,19.40%");
    expect(csv).toContain("UPI,562.80,80.60%");
    expect(csv).toContain("Card,0.00,0.00%");
    expect(csv).toContain("Other / Split,0.00,0.00%");
    expect(csv).toContain("Total Realized Tenders,698.25,100.00%");
  });

  it("5. Section 4 contains multi-day daily sales trend records for all by_day entries", () => {
    const csv = generateOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days");

    expect(csv).toContain('"2026-08-16","Aug 16",0.00,0.00,0,0');
    expect(csv).toContain('"2026-08-22","Aug 22",698.25,665.00,4,5');
  });

  it("6. Section 5 contains top selling items ranking and revenue", () => {
    const csv = generateOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days");

    expect(csv).toContain('1,"Clay Pot Pizza",2,278.00,"100%"');
    expect(csv).toContain('2,"Cheese Wrap",2,258.00,"100%"');
    expect(csv).toContain('3,"Wrap",1,129.00,"50%"');
  });

  it("7. Section 6 contains operational summary and pipeline metrics", () => {
    const csv = generateOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days");

    expect(csv).toContain("Total Orders Placed,16");
    expect(csv).toContain("Cancelled Orders,7");
    expect(csv).toContain("Unsettled Orders in Pipeline,9");
    expect(csv).toContain("Unsettled Pipeline Value,612.00");
  });

  // =========================================================================
  // 8-11. Strict Product Boundary: No Transaction-Level Leakage & No PII
  // =========================================================================
  it("8. Does NOT leak individual order IDs, bill IDs, transaction rows, or customer PII", () => {
    const csv = generateOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days");

    expect(csv).not.toContain("Order #");
    expect(csv).not.toContain("Customer Phone");
    expect(csv).not.toContain("Special Notes");
    expect(csv).not.toContain("Walk-in Customer");
    expect(csv).not.toContain("Table 1");
    expect(csv).not.toContain("order_items");
  });

  // =========================================================================
  // 12-15. Mathematical Invariants
  // =========================================================================
  it("9. Invariant: sum(by_day.revenue) === range_financials.net_collected", () => {
    const sumDailyRevenue = mockRpcResponse.by_day.reduce((acc, d) => acc + d.revenue, 0);
    expect(sumDailyRevenue).toBe(mockRpcResponse.range_financials.net_collected);
  });

  it("10. Invariant: sum(by_day.paid_bills) === range_financials.paid_bills_count", () => {
    const sumDailyBills = mockRpcResponse.by_day.reduce((acc, d) => acc + d.paid_bills, 0);
    expect(sumDailyBills).toBe(mockRpcResponse.range_financials.paid_bills_count);
  });

  it("11. Invariant: sum(by_day.items_sold) === range_financials.total_items_sold", () => {
    const sumDailyItems = mockRpcResponse.by_day.reduce((acc, d) => acc + d.items_sold, 0);
    expect(sumDailyItems).toBe(mockRpcResponse.range_financials.total_items_sold);
  });

  it("12. Invariant: cash + upi + card + other === range_financials.net_collected", () => {
    const tenderSum =
      mockRpcResponse.tenders.cash +
      mockRpcResponse.tenders.upi +
      mockRpcResponse.tenders.card +
      mockRpcResponse.tenders.other;
    expect(tenderSum).toBe(mockRpcResponse.range_financials.net_collected);
  });

  // =========================================================================
  // 16-18. Filename Generation Verification
  // =========================================================================
  it("13. downloadOwnerAnalyticsCsv creates correct filenames for single-day, multi-day, and custom ranges", () => {
    let capturedDownload = "";
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") {
        const origSetAttribute = el.setAttribute.bind(el);
        el.setAttribute = (name: string, val: string) => {
          if (name === "download") capturedDownload = val;
          origSetAttribute(name, val);
        };
        el.click = vi.fn();
      }
      return el;
    });

    // Multi-day 7D range
    downloadOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days", "2026-08-16", "2026-08-22");
    expect(capturedDownload).toBe("OwnerAnalytics_cheese-corner_2026-08-16_to_2026-08-22.csv");

    // Single-day Today range
    downloadOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Today", "2026-08-22", "2026-08-22");
    expect(capturedDownload).toBe("OwnerAnalytics_cheese-corner_2026-08-22.csv");

    // Custom 30D range
    downloadOwnerAnalyticsCsv(mockSummaryData, mockRpcResponse, mockCafe, "Custom", "2026-07-01", "2026-07-31");
    expect(capturedDownload).toBe("OwnerAnalytics_cheese-corner_2026-07-01_to_2026-07-31.csv");
  });

  // =========================================================================
  // 19-22. PDF Print HTML Generation & Iframe Execution
  // =========================================================================
  it("14. generateOwnerAnalyticsPrintHtml generates clean A4 HTML containing all report sections", () => {
    const html = generateOwnerAnalyticsPrintHtml(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days");

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Owner Analytics Performance Statement");
    expect(html).toContain("Financial & Tax Summary");
    expect(html).toContain("Tender Collection Breakdown");
    expect(html).toContain("Daily Sales Trend");
    expect(html).toContain("Top Selling Menu Items");
    expect(html).toContain("Operational Summary & Pipeline");
    expect(html).toContain("Manager / Owner Signature");
    expect(html).toContain("size: A4 portrait");
  });

  it("15. printOwnerAnalyticsPdf creates an isolated iframe, triggers print, and cleans up DOM", () => {
    vi.useFakeTimers();
    try {
      const appendChildSpy = vi.spyOn(document.body, "appendChild");
      const removeChildSpy = vi.spyOn(document.body, "removeChild");

      printOwnerAnalyticsPdf(mockSummaryData, mockRpcResponse, mockCafe, "Last 7 Days");

      expect(appendChildSpy).toHaveBeenCalled();
      const createdIframe = appendChildSpy.mock.calls[0][0] as HTMLIFrameElement;
      expect(createdIframe.tagName.toLowerCase()).toBe("iframe");
      expect(createdIframe.style.position).toBe("fixed");

      // Advance timer for print trigger
      vi.advanceTimersByTime(300);

      // Advance timer for iframe cleanup
      vi.advanceTimersByTime(1200);

      expect(removeChildSpy).toHaveBeenCalledWith(createdIframe);
    } finally {
      vi.useRealTimers();
    }
  });

  // =========================================================================
  // 23-24. Null/Fallback Safety
  // =========================================================================
  it("16. Handles null rawRpc gracefully without producing NaN, undefined, or failing", () => {
    const fallbackSummary: OwnerAnalyticsSummaryData = {
      ...mockSummaryData,
      rawRpc: null,
    };

    const csv = generateOwnerAnalyticsCsv(fallbackSummary, null, mockCafe, "Last 7 Days");
    expect(csv).toContain("Net Collected Sales,698.25");
    expect(csv).toContain("Paid Bills Count,4");
    expect(csv).not.toContain("NaN");
    expect(csv).not.toContain("undefined");

    const html = generateOwnerAnalyticsPrintHtml(fallbackSummary, null, mockCafe, "Last 7 Days");
    expect(html).toContain("Net Realized Sales");
    expect(html).not.toContain("NaN");
  });

  // =========================================================================
  // 25. OwnerAnalyticsPage UI Integration
  // =========================================================================
  it("17. OwnerAnalyticsPage renders Export CSV and Print PDF buttons in header toolbar", async () => {
    vi.spyOn(AnalyticsService, "fetchOwnerAnalytics").mockResolvedValue(mockSummaryData);

    render(<OwnerAnalyticsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("owner-analytics-export-csv-button")).toBeInTheDocument();
      expect(screen.getByTestId("owner-analytics-print-pdf-button")).toBeInTheDocument();
      expect(screen.getByTestId("owner-analytics-export-csv-button")).not.toBeDisabled();
      expect(screen.getByTestId("owner-analytics-print-pdf-button")).not.toBeDisabled();
    });

    const csvBtn = screen.getByTestId("owner-analytics-export-csv-button");
    const pdfBtn = screen.getByTestId("owner-analytics-print-pdf-button");

    expect(csvBtn).toHaveTextContent("Export CSV");
    expect(pdfBtn).toHaveTextContent("Print PDF");
  });

  it("18. Clicking Export CSV and Print PDF triggers the appropriate exporter actions", async () => {
    vi.spyOn(AnalyticsService, "fetchOwnerAnalytics").mockResolvedValue(mockSummaryData);

    render(<OwnerAnalyticsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("owner-analytics-export-csv-button")).not.toBeDisabled();
    });

    // Click Export CSV
    fireEvent.click(screen.getByTestId("owner-analytics-export-csv-button"));

    // Click Print PDF
    fireEvent.click(screen.getByTestId("owner-analytics-print-pdf-button"));
  });
});
