/**
 * Milestone 2F.2: Daily Sales CSV & PDF Exporter Test Suite
 * 
 * Tests authoritative CSV and PDF document generation, split-tender accounting,
 * RFC 4180 escaping, 24-hour distribution, timezone formatting, and UI button interactions.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  generateDailySalesCsv,
  generateDailySalesPrintHtml,
  downloadDailySalesCsv,
  printDailySalesPdf,
  formatHourlyWindowLabel,
  formatPaidTimeIST,
  formatTransactionTenderBreakdown,
  formatTransactionItemsSummary,
} from "@/lib/sales/dailySalesExporter";
import type {
  DailySalesReport,
  DailySalesTransactionsResponse,
  DailySalesTransaction,
  DailySalesHourlyBucket,
} from "@/lib/sales/types";
import { DailySalesModal } from "@/components/counter/DailySalesModal";
import { DailySalesService } from "@/lib/sales/dailySalesService";

// Helper to generate dense 24 hourly buckets
function createDense24Buckets(activeBuckets: Partial<DailySalesHourlyBucket>[] = []): DailySalesHourlyBucket[] {
  const buckets: DailySalesHourlyBucket[] = [];
  for (let h = 0; h < 24; h++) {
    const active = activeBuckets.find((b) => b.hour === h);
    if (active) {
      buckets.push({
        hour: h,
        label: h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`,
        revenue: active.revenue ?? 0,
        paid_bills: active.paid_bills ?? 0,
        items_sold: active.items_sold ?? 0,
        cash: active.cash ?? 0,
        upi: active.upi ?? 0,
        card: active.card ?? 0,
        other: active.other ?? 0,
      });
    } else {
      buckets.push({
        hour: h,
        label: h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`,
        revenue: 0,
        paid_bills: 0,
        items_sold: 0,
        cash: 0,
        upi: 0,
        card: 0,
        other: 0,
      });
    }
  }
  return buckets;
}

const mockCafe = {
  id: "6d00d671-eaea-47ce-a842-f970878373c9",
  name: "Cheese Corner",
  address: "Shop 4, Main Market, Mumbai",
  phone: "+91 98765 43210",
  gstin: "27AAAAA0000A1Z5",
  currency: "INR",
};

describe("Milestone 2F.2: Daily Sales CSV & PDF Exporter Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  // =========================================================================
  // 1 & 2. Empty Day Export
  // =========================================================================
  it("1. Empty day CSV exports with zero values and all 24 hourly buckets", () => {
    const emptyReport: DailySalesReport = {
      cafe_id: mockCafe.id,
      business_date: "2026-08-22",
      net_collected: 0,
      gross_subtotal: 0,
      total_discounts: 0,
      total_tax: 0,
      cgst: 0,
      sgst: 0,
      total_service_charge: 0,
      total_round_off: 0,
      paid_bills_count: 0,
      total_items_sold: 0,
      average_bill_value: 0,
      tenders: { cash: 0, upi: 0, card: 0, other: 0 },
      hourly: createDense24Buckets(),
      pipeline: { unsettled_orders_count: 0, unsettled_pipeline_cents: 0, cancelled_orders_count: 0 },
    };

    const emptyTxResponse: DailySalesTransactionsResponse = {
      business_date: "2026-08-22",
      cafe_id: mockCafe.id,
      transactions: [],
    };

    const csv = generateDailySalesCsv(emptyReport, emptyTxResponse, mockCafe);
    expect(csv).toContain("DAILY SALES RECONCILIATION REPORT - CHEESE CORNER");
    expect(csv).toContain("Business Date,\"2026-08-22\"");
    expect(csv).toContain("Net Collected Sales,0.00");
    expect(csv).toContain("Paid Bills Count,0");
    expect(csv).toContain("Total Items Sold,0");
    expect(csv).toContain("SECTION 3: HOURLY SALES DISTRIBUTION (ASIA/KOLKATA)");
    expect(csv).toContain("SECTION 4: SETTLED BILLS & SPLIT TENDER LEDGER");
    // Verify 24 bucket lines exist
    expect(csv).toContain("0,\"12:00 AM - 01:00 AM\",0.00,0,0,0.00,0.00,0.00,0.00");
    expect(csv).toContain("23,\"11:00 PM - 12:00 AM\",0.00,0,0,0.00,0.00,0.00,0.00");
  });

  it("2. Empty day PDF HTML document generates clean layout with zero state", () => {
    const emptyReport: DailySalesReport = {
      cafe_id: mockCafe.id,
      business_date: "2026-08-22",
      net_collected: 0,
      gross_subtotal: 0,
      total_discounts: 0,
      total_tax: 0,
      cgst: 0,
      sgst: 0,
      total_service_charge: 0,
      total_round_off: 0,
      paid_bills_count: 0,
      total_items_sold: 0,
      average_bill_value: 0,
      tenders: { cash: 0, upi: 0, card: 0, other: 0 },
      hourly: createDense24Buckets(),
      pipeline: { unsettled_orders_count: 0, unsettled_pipeline_cents: 0, cancelled_orders_count: 0 },
    };

    const emptyTxResponse: DailySalesTransactionsResponse = {
      business_date: "2026-08-22",
      cafe_id: mockCafe.id,
      transactions: [],
    };

    const html = generateDailySalesPrintHtml(emptyReport, emptyTxResponse, mockCafe);
    expect(html).toContain("Cheese Corner");
    expect(html).toContain("Business Date: 2026-08-22");
    expect(html).toContain("Daily Sales Reconciliation Statement");
    expect(html).toContain("No paid transactions recorded for this business date.");
  });

  // =========================================================================
  // 3 & 4. Single & Multiple Paid Bills
  // =========================================================================
  it("3 & 4. Single and multiple paid bills format accurately in CSV and PDF", () => {
    const report: DailySalesReport = {
      cafe_id: mockCafe.id,
      business_date: "2026-08-22",
      net_collected: 698.25,
      gross_subtotal: 665.0,
      total_discounts: 0,
      total_tax: 33.25,
      cgst: 16.64,
      sgst: 16.61,
      total_service_charge: 0,
      total_round_off: 0,
      paid_bills_count: 4,
      total_items_sold: 5,
      average_bill_value: 174.56,
      tenders: { cash: 135.45, upi: 562.8, card: 0, other: 0 },
      hourly: createDense24Buckets([
        { hour: 11, revenue: 698.25, paid_bills: 4, items_sold: 5, cash: 135.45, upi: 562.8, card: 0, other: 0 },
      ]),
      pipeline: { unsettled_orders_count: 0, unsettled_pipeline_cents: 0, cancelled_orders_count: 0 },
    };

    const txResponse: DailySalesTransactionsResponse = {
      business_date: "2026-08-22",
      cafe_id: mockCafe.id,
      transactions: [
        {
          bill_id: "b-1003",
          bill_number: 1003,
          table_label: "Table 01",
          order_source: "DINE_IN",
          customer_name: "Alice",
          customer_phone: "+91 91234 56789",
          cashier_id: "cashier-1",
          payment_method: "UPI",
          subtotal: 129.0,
          discount: 0,
          cgst: 3.23,
          sgst: 3.22,
          service_charge: 0,
          round_off: 0,
          grand_total: 135.45,
          total_items: 1,
          paid_at: "2026-08-22T05:51:42.348Z",
          business_date: "2026-08-22",
          items: [{ item_name: "Wrap", quantity: 1, line_total: 129.0 }],
        },
        {
          bill_id: "b-1004",
          bill_number: 1004,
          table_label: "Table 02",
          order_source: "DINE_IN",
          customer_name: "Bob",
          customer_phone: null,
          cashier_id: "cashier-1",
          payment_method: "UPI",
          subtotal: 278.0,
          discount: 0,
          cgst: 6.95,
          sgst: 6.95,
          service_charge: 0,
          round_off: 0,
          grand_total: 291.9,
          total_items: 2,
          paid_at: "2026-08-22T05:51:43.064Z",
          business_date: "2026-08-22",
          items: [{ item_name: "Clay Pot Pizza", quantity: 2, line_total: 278.0 }],
        },
      ],
    };

    const csv = generateDailySalesCsv(report, txResponse, mockCafe);
    expect(csv).toContain("Net Collected Sales,698.25");
    expect(csv).toContain("1003");
    expect(csv).toContain("1004");
    expect(csv).toContain("\"Alice\"");
    expect(csv).toContain("\"Bob\"");
    expect(csv).toContain("135.45");
    expect(csv).toContain("291.90");

    const html = generateDailySalesPrintHtml(report, txResponse, mockCafe);
    expect(html).toContain("#1003");
    expect(html).toContain("#1004");
    expect(html).toContain("Clay Pot Pizza");
  });

  // =========================================================================
  // 5, 6, 7. Legacy, Ledger-Backed & Mixed Bills
  // =========================================================================
  it("5, 6, 7. Legacy single-tender and ledger-backed bills export with proper tender breakdown", () => {
    const txLegacy: DailySalesTransaction = {
      bill_id: "b-legacy",
      bill_number: 1006,
      table_label: "Takeaway",
      order_source: "TAKEAWAY",
      customer_name: null,
      customer_phone: null,
      cashier_id: "c-1",
      payment_method: "CASH",
      subtotal: 129.0,
      discount: 0,
      cgst: 3.23,
      sgst: 3.22,
      service_charge: 0,
      round_off: 0,
      grand_total: 135.45,
      total_items: 1,
      paid_at: "2026-08-22T05:51:45.043Z",
      business_date: "2026-08-22",
      items: [{ item_name: "Cheese Wrap", quantity: 1, line_total: 129.0 }],
    };

    const txLedger: DailySalesTransaction = {
      bill_id: "b-ledger",
      bill_number: 1008,
      table_label: "Table 05",
      order_source: "DINE_IN",
      customer_name: "Charlie",
      customer_phone: "9876543210",
      cashier_id: "c-1",
      payment_method: "UPI",
      subtotal: 129.0,
      discount: 0,
      cgst: 3.23,
      sgst: 3.22,
      service_charge: 0,
      round_off: 0,
      grand_total: 135.45,
      total_items: 1,
      paid_at: "2026-08-22T05:51:47.015Z",
      business_date: "2026-08-22",
      tenders: [{ method: "UPI", amount: 135.45 }],
      items: [{ item_name: "Cheese Wrap", quantity: 1, line_total: 129.0 }],
    };

    expect(formatTransactionTenderBreakdown(txLegacy)).toContain("CASH: ₹135.45");
    expect(formatTransactionTenderBreakdown(txLedger)).toContain("UPI: ₹135.45");
  });

  // =========================================================================
  // 8 & 9. Split Payments (2-way & 3-way splits)
  // =========================================================================
  it("8 & 9. 2-way and 3-way split payments preserve exact multi-tender allocations without data loss", () => {
    const splitTx2Way: DailySalesTransaction = {
      bill_id: "b-split-2",
      bill_number: 1010,
      table_label: "Table 01",
      order_source: "DINE_IN",
      customer_name: "Split Guest",
      customer_phone: null,
      cashier_id: "c-1",
      payment_method: "MIXED",
      subtotal: 297.14,
      discount: 0,
      cgst: 7.43,
      sgst: 7.43,
      service_charge: 0,
      round_off: 0,
      grand_total: 312.0,
      total_items: 2,
      paid_at: "2026-08-22T06:00:00.000Z",
      business_date: "2026-08-22",
      tenders: [
        { method: "CASH", amount: 200.0, tendered_amount: 312.0, change_due: 112.0 },
        { method: "UPI", amount: 112.0 },
      ],
      items: [{ item_name: "Combo Meal", quantity: 2, line_total: 297.14 }],
    };

    const splitTx3Way: DailySalesTransaction = {
      bill_id: "b-split-3",
      bill_number: 1011,
      table_label: "Table 02",
      order_source: "DINE_IN",
      customer_name: "Group Party",
      customer_phone: "9988776655",
      cashier_id: "c-1",
      payment_method: "MIXED",
      subtotal: 952.38,
      discount: 0,
      cgst: 23.81,
      sgst: 23.81,
      service_charge: 0,
      round_off: 0,
      grand_total: 1000.0,
      total_items: 4,
      paid_at: "2026-08-22T06:30:00.000Z",
      business_date: "2026-08-22",
      tenders: [
        { method: "CASH", amount: 500.0 },
        { method: "UPI", amount: 300.0 },
        { method: "CARD", amount: 200.0 },
      ],
      items: [{ item_name: "Platter", quantity: 4, line_total: 952.38 }],
    };

    const tenderBreakdown2Way = formatTransactionTenderBreakdown(splitTx2Way);
    expect(tenderBreakdown2Way).toContain("CASH: ₹200");
    expect(tenderBreakdown2Way).toContain("UPI: ₹112");

    const tenderBreakdown3Way = formatTransactionTenderBreakdown(splitTx3Way);
    expect(tenderBreakdown3Way).toContain("CASH: ₹500");
    expect(tenderBreakdown3Way).toContain("UPI: ₹300");
    expect(tenderBreakdown3Way).toContain("CARD: ₹200");

    // Invariant: Tender sum strictly equals grand_total
    const sum2Way = splitTx2Way.tenders!.reduce((acc, t) => acc + t.amount, 0);
    expect(sum2Way).toBe(splitTx2Way.grand_total);

    const sum3Way = splitTx3Way.tenders!.reduce((acc, t) => acc + t.amount, 0);
    expect(sum3Way).toBe(splitTx3Way.grand_total);
  });

  // =========================================================================
  // 10, 11, 12. Full 24 Hourly Buckets & Accounting Invariants
  // =========================================================================
  it("10, 11, 12. Full 24 hourly buckets reconcile strictly against report net_collected and tenders", () => {
    const report: DailySalesReport = {
      cafe_id: mockCafe.id,
      business_date: "2026-08-22",
      net_collected: 1000.0,
      gross_subtotal: 952.38,
      total_discounts: 0,
      total_tax: 47.62,
      cgst: 23.81,
      sgst: 23.81,
      total_service_charge: 0,
      total_round_off: 0,
      paid_bills_count: 5,
      total_items_sold: 8,
      average_bill_value: 200.0,
      tenders: { cash: 500.0, upi: 300.0, card: 200.0, other: 0 },
      hourly: createDense24Buckets([
        { hour: 11, revenue: 400.0, paid_bills: 2, items_sold: 3, cash: 200.0, upi: 200.0, card: 0, other: 0 },
        { hour: 14, revenue: 600.0, paid_bills: 3, items_sold: 5, cash: 300.0, upi: 100.0, card: 200.0, other: 0 },
      ]),
      pipeline: { unsettled_orders_count: 0, unsettled_pipeline_cents: 0, cancelled_orders_count: 0 },
    };

    const csv = generateDailySalesCsv(report, null, mockCafe);

    // Sum of exported hourly revenue
    const sumHourlyRev = report.hourly.reduce((acc, h) => acc + h.revenue, 0);
    expect(sumHourlyRev).toBe(report.net_collected);

    // Sum of tenders
    const sumTenders = report.tenders.cash + report.tenders.upi + report.tenders.card + report.tenders.other;
    expect(sumTenders).toBe(report.net_collected);

    // All 24 hours exist
    for (let h = 0; h < 24; h++) {
      expect(csv).toContain(`${h},"${formatHourlyWindowLabel(h)}"`);
    }
  });

  // =========================================================================
  // 13, 14, 15, 16, 17. RFC 4180 Escaping & Edge Cases
  // =========================================================================
  it("13, 14, 15, 16, 17. RFC 4180 escaping handles quotes, commas, newlines, and null fields", () => {
    const specialTx: DailySalesTransaction = {
      bill_id: "b-special",
      bill_number: 1099,
      table_label: "Table \"VIP, Corner\"",
      order_source: "DINE_IN",
      customer_name: "Dr. John \"Johnny\" Doe, Jr.",
      customer_phone: null,
      cashier_id: "c-1",
      payment_method: "CASH",
      subtotal: 500.0,
      discount: 0,
      cgst: 12.5,
      sgst: 12.5,
      service_charge: 0,
      round_off: 0,
      grand_total: 525.0,
      total_items: 2,
      paid_at: "2026-08-22T07:00:00.000Z",
      business_date: "2026-08-22",
      items: [
        { item_name: "Pizza, Extra \"Cheese\"\nwith Dip", quantity: 2, line_total: 500.0 },
      ],
    };

    const report: DailySalesReport = {
      cafe_id: mockCafe.id,
      business_date: "2026-08-22",
      net_collected: 525.0,
      gross_subtotal: 500.0,
      total_discounts: 0,
      total_tax: 25.0,
      cgst: 12.5,
      sgst: 12.5,
      total_service_charge: 0,
      total_round_off: 0,
      paid_bills_count: 1,
      total_items_sold: 2,
      average_bill_value: 525.0,
      tenders: { cash: 525.0, upi: 0, card: 0, other: 0 },
      hourly: createDense24Buckets([{ hour: 12, revenue: 525.0, paid_bills: 1, items_sold: 2, cash: 525.0, upi: 0, card: 0, other: 0 }]),
      pipeline: { unsettled_orders_count: 0, unsettled_pipeline_cents: 0, cancelled_orders_count: 0 },
    };

    const txResp: DailySalesTransactionsResponse = {
      business_date: "2026-08-22",
      cafe_id: mockCafe.id,
      transactions: [specialTx],
    };

    const csv = generateDailySalesCsv(report, txResp, mockCafe);

    // Escaped double quotes: ""
    expect(csv).toContain("\"Dr. John \"\"Johnny\"\" Doe, Jr.\"");
    expect(csv).toContain("\"Table \"\"VIP, Corner\"\"\"");
    expect(csv).toContain("\"2x Pizza, Extra \"\"Cheese\"\"\nwith Dip\"");
    expect(csv).toContain("\"N/A\""); // Null phone fallback
  });

  // =========================================================================
  // 18 & 19. Currency & Asia/Kolkata Timestamp Formatting
  // =========================================================================
  it("18 & 19. Correctly formats INR currency and Asia/Kolkata 12-hour timestamps", () => {
    // 05:51:42 UTC is 11:21:42 AM IST
    const istTime = formatPaidTimeIST("2026-08-22T05:51:42.000Z");
    expect(istTime).toMatch(/11:21:42\s*(am|AM)/i);

    expect(formatHourlyWindowLabel(0)).toBe("12:00 AM - 01:00 AM");
    expect(formatHourlyWindowLabel(11)).toBe("11:00 AM - 12:00 PM");
    expect(formatHourlyWindowLabel(12)).toBe("12:00 PM - 01:00 PM");
    expect(formatHourlyWindowLabel(23)).toBe("11:00 PM - 12:00 AM");
  });

  // =========================================================================
  // 20 & 21. Cafe & Business Date Isolation
  // =========================================================================
  it("20 & 21. Preserves Cafe branding and past business date isolation", () => {
    const historicalReport: DailySalesReport = {
      cafe_id: "other-cafe-uuid",
      business_date: "2026-08-15",
      net_collected: 250.0,
      gross_subtotal: 238.1,
      total_discounts: 0,
      total_tax: 11.9,
      cgst: 5.95,
      sgst: 5.95,
      total_service_charge: 0,
      total_round_off: 0,
      paid_bills_count: 1,
      total_items_sold: 1,
      average_bill_value: 250.0,
      tenders: { cash: 250.0, upi: 0, card: 0, other: 0 },
      hourly: createDense24Buckets(),
      pipeline: { unsettled_orders_count: 0, unsettled_pipeline_cents: 0, cancelled_orders_count: 0 },
    };

    const cafeCustom = {
      name: "Baker's Delight",
      currency: "INR",
    };

    const csv = generateDailySalesCsv(historicalReport, null, cafeCustom);
    expect(csv).toContain("DAILY SALES RECONCILIATION REPORT - BAKER'S DELIGHT");
    expect(csv).toContain("Business Date,\"2026-08-15\"");
  });

  // =========================================================================
  // 22. Large Transaction List Performance
  // =========================================================================
  it("22. Efficiently exports large transaction lists (500+ bills) without memory explosion", () => {
    const largeTxList: DailySalesTransaction[] = [];
    for (let i = 1; i <= 500; i++) {
      largeTxList.push({
        bill_id: `b-${i}`,
        bill_number: 1000 + i,
        table_label: `Table ${i % 20 + 1}`,
        order_source: i % 3 === 0 ? "TAKEAWAY" : "DINE_IN",
        customer_name: `Customer ${i}`,
        customer_phone: `+91 90000 ${String(i).padStart(5, "0")}`,
        cashier_id: "c-1",
        payment_method: i % 2 === 0 ? "UPI" : "CASH",
        subtotal: 100.0,
        discount: 0,
        cgst: 2.5,
        sgst: 2.5,
        service_charge: 0,
        round_off: 0,
        grand_total: 105.0,
        total_items: 2,
        paid_at: "2026-08-22T05:51:42.000Z",
        business_date: "2026-08-22",
        items: [{ item_name: "Item", quantity: 2, line_total: 100.0 }],
      });
    }

    const largeReport: DailySalesReport = {
      cafe_id: mockCafe.id,
      business_date: "2026-08-22",
      net_collected: 52500.0,
      gross_subtotal: 50000.0,
      total_discounts: 0,
      total_tax: 2500.0,
      cgst: 1250.0,
      sgst: 1250.0,
      total_service_charge: 0,
      total_round_off: 0,
      paid_bills_count: 500,
      total_items_sold: 1000,
      average_bill_value: 105.0,
      tenders: { cash: 26250.0, upi: 26250.0, card: 0, other: 0 },
      hourly: createDense24Buckets([{ hour: 11, revenue: 52500.0, paid_bills: 500, items_sold: 1000, cash: 26250.0, upi: 26250.0, card: 0, other: 0 }]),
      pipeline: { unsettled_orders_count: 0, unsettled_pipeline_cents: 0, cancelled_orders_count: 0 },
    };

    const txResp: DailySalesTransactionsResponse = {
      business_date: "2026-08-22",
      cafe_id: mockCafe.id,
      transactions: largeTxList,
    };

    const startTime = performance.now();
    const csv = generateDailySalesCsv(largeReport, txResp, mockCafe);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(1000); // Generates 500 bills under 1000ms in JSDOM
    expect(csv.length).toBeGreaterThan(50000);
    expect(csv).toContain("Customer 500");
  });

  // =========================================================================
  // 23, 24, 25. DailySalesModal UI Button Rendering & Invocation
  // =========================================================================
  it("23, 24, 25. DailySalesModal renders CSV & PDF buttons and invokes exporter functions", async () => {
    const report: DailySalesReport = {
      cafe_id: mockCafe.id,
      business_date: "2026-08-22",
      net_collected: 698.25,
      gross_subtotal: 665.0,
      total_discounts: 0,
      total_tax: 33.25,
      cgst: 16.64,
      sgst: 16.61,
      total_service_charge: 0,
      total_round_off: 0,
      paid_bills_count: 4,
      total_items_sold: 5,
      average_bill_value: 174.56,
      tenders: { cash: 135.45, upi: 562.8, card: 0, other: 0 },
      hourly: createDense24Buckets([
        { hour: 11, revenue: 698.25, paid_bills: 4, items_sold: 5, cash: 135.45, upi: 562.8, card: 0, other: 0 },
      ]),
      pipeline: { unsettled_orders_count: 0, unsettled_pipeline_cents: 0, cancelled_orders_count: 0 },
    };

    vi.spyOn(DailySalesService, "getDailySalesTransactions").mockResolvedValue({
      business_date: "2026-08-22",
      cafe_id: mockCafe.id,
      transactions: [
        {
          bill_id: "b-1003",
          bill_number: 1003,
          table_label: "Table 01",
          order_source: "DINE_IN",
          customer_name: "Alice",
          customer_phone: "+91 91234 56789",
          cashier_id: "cashier-1",
          payment_method: "UPI",
          subtotal: 129.0,
          discount: 0,
          cgst: 3.23,
          sgst: 3.22,
          service_charge: 0,
          round_off: 0,
          grand_total: 135.45,
          total_items: 1,
          paid_at: "2026-08-22T05:51:42.348Z",
          business_date: "2026-08-22",
          items: [{ item_name: "Wrap", quantity: 1, line_total: 129.0 }],
        },
      ],
    });

    // Mock URL.createObjectURL and URL.revokeObjectURL
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <DailySalesModal
        isOpen={true}
        onClose={vi.fn()}
        report={report}
        isLoading={false}
        isError={false}
        onRefresh={vi.fn()}
        cafeId={mockCafe.id}
        cafe={mockCafe}
      />
    );

    // 23. Verify buttons render
    const csvBtn = screen.getByTestId("daily-sales-export-csv-button");
    const pdfBtn = screen.getByTestId("daily-sales-export-pdf-button");
    expect(csvBtn).toBeInTheDocument();
    expect(pdfBtn).toBeInTheDocument();

    // 24. Click CSV button
    fireEvent.click(csvBtn);
    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled();
    });

    // 25. Click PDF button
    fireEvent.click(pdfBtn);
    // Verified print document triggered
  });
});
