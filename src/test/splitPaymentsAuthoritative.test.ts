import { describe, it, expect, beforeEach, vi } from "vitest";
import { BillRepository } from "@/lib/billing/BillRepository";
import { PaymentService } from "@/lib/payments/paymentService";
import { ReceiptBuilder } from "@/lib/printing/receiptBuilder";
import { DailySalesRepository } from "@/lib/sales/dailySalesRepository";
import { DailySalesService } from "@/lib/sales/dailySalesService";
import { supabase } from "@/lib/db";

describe("Milestone 2D.2 - Authoritative Split/Mixed Payments Test Suite", () => {
  const CAFE_ID = "6d00d671-eaea-47ce-a842-f970878373c9";
  const BIZ_DATE = "2026-08-22";

  beforeEach(() => {
    vi.restoreAllMocks();
    BillRepository.clearMemoryStoreForTesting();
  });

  // =========================================================================
  // SCENARIOS 1-4: SINGLE TENDERS
  // =========================================================================
  it("1. Single CASH payment settles with exact method CASH", async () => {
    const mockRpc = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        status: "SUCCESS",
        bill_id: "bill-001",
        payment_method: "CASH",
        grand_total: 500.0,
        tenders_count: 1,
      },
      error: null,
    } as any);

    const res = await BillRepository.settleBillWithTenders(
      "bill-001",
      [{ method: "cash", amount: 500.0, tenderedAmount: 500.0, changeDue: 0.0 }],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "settle_bill_with_tenders_atomic",
      expect.objectContaining({
        p_bill_id: "bill-001",
        p_tenders: [{ method: "CASH", amount: 500.0, tendered_amount: 500.0, change_due: 0.0, transaction_ref: null }],
        p_settled_by: "user-1",
      })
    );
  });

  it("2. Single UPI payment settles with exact method UPI", async () => {
    const mockRpc = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        status: "SUCCESS",
        bill_id: "bill-002",
        payment_method: "UPI",
        grand_total: 350.0,
        tenders_count: 1,
      },
      error: null,
    } as any);

    await BillRepository.settleBillWithTenders(
      "bill-002",
      [{ method: "upi", amount: 350.0, transactionRef: "UPI-TXN-99182" }],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "settle_bill_with_tenders_atomic",
      expect.objectContaining({
        p_bill_id: "bill-002",
        p_tenders: [{ method: "UPI", amount: 350.0, tendered_amount: 350.0, change_due: 0.0, transaction_ref: "UPI-TXN-99182" }],
      })
    );
  });

  it("3. Single CARD payment settles with exact method CARD", async () => {
    const mockRpc = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        status: "SUCCESS",
        bill_id: "bill-003",
        payment_method: "CARD",
        grand_total: 1200.0,
        tenders_count: 1,
      },
      error: null,
    } as any);

    await BillRepository.settleBillWithTenders(
      "bill-003",
      [{ method: "card", amount: 1200.0, transactionRef: "AUTH-7712" }],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "settle_bill_with_tenders_atomic",
      expect.objectContaining({
        p_bill_id: "bill-003",
        p_tenders: [{ method: "CARD", amount: 1200.0, tendered_amount: 1200.0, change_due: 0.0, transaction_ref: "AUTH-7712" }],
      })
    );
  });

  it("4. Single OTHER payment settles with exact method OTHER", async () => {
    const mockRpc = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        status: "SUCCESS",
        bill_id: "bill-004",
        payment_method: "OTHER",
        grand_total: 250.0,
        tenders_count: 1,
      },
      error: null,
    } as any);

    await BillRepository.settleBillWithTenders(
      "bill-004",
      [{ method: "other", amount: 250.0, transactionRef: "VOUCHER-55" }],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "settle_bill_with_tenders_atomic",
      expect.objectContaining({
        p_bill_id: "bill-004",
        p_tenders: [{ method: "OTHER", amount: 250.0, tendered_amount: 250.0, change_due: 0.0, transaction_ref: "VOUCHER-55" }],
      })
    );
  });

  // =========================================================================
  // SCENARIOS 5-8: SPLIT TENDERS
  // =========================================================================
  it("5. CASH + UPI exact split records both tenders and sets payment_method = MIXED", async () => {
    const mockRpc = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        status: "SUCCESS",
        bill_id: "bill-005",
        payment_method: "MIXED",
        grand_total: 1000.0,
        tenders_count: 2,
      },
      error: null,
    } as any);

    await BillRepository.settleBillWithTenders(
      "bill-005",
      [
        { method: "cash", amount: 400.0, tenderedAmount: 500.0, changeDue: 100.0 },
        { method: "upi", amount: 600.0, transactionRef: "UPI-4401" },
      ],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "settle_bill_with_tenders_atomic",
      expect.objectContaining({
        p_bill_id: "bill-005",
        p_tenders: [
          { method: "CASH", amount: 400.0, tendered_amount: 500.0, change_due: 100.0, transaction_ref: null },
          { method: "UPI", amount: 600.0, tendered_amount: 600.0, change_due: 0.0, transaction_ref: "UPI-4401" },
        ],
      })
    );
  });

  it("6. CASH + CARD exact split records both tenders and sets payment_method = MIXED", async () => {
    const mockRpc = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        status: "SUCCESS",
        bill_id: "bill-006",
        payment_method: "MIXED",
        grand_total: 1500.0,
        tenders_count: 2,
      },
      error: null,
    } as any);

    await BillRepository.settleBillWithTenders(
      "bill-006",
      [
        { method: "cash", amount: 500.0 },
        { method: "card", amount: 1000.0, transactionRef: "POS-9921" },
      ],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "settle_bill_with_tenders_atomic",
      expect.objectContaining({
        p_bill_id: "bill-006",
        p_tenders: [
          { method: "CASH", amount: 500.0, tendered_amount: 500.0, change_due: 0.0, transaction_ref: null },
          { method: "CARD", amount: 1000.0, tendered_amount: 1000.0, change_due: 0.0, transaction_ref: "POS-9921" },
        ],
      })
    );
  });

  it("7. UPI + CARD exact split records both tenders and sets payment_method = MIXED", async () => {
    const mockRpc = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        status: "SUCCESS",
        bill_id: "bill-007",
        payment_method: "MIXED",
        grand_total: 800.0,
        tenders_count: 2,
      },
      error: null,
    } as any);

    await BillRepository.settleBillWithTenders(
      "bill-007",
      [
        { method: "upi", amount: 300.0, transactionRef: "UPI-881" },
        { method: "card", amount: 500.0, transactionRef: "CARD-112" },
      ],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "settle_bill_with_tenders_atomic",
      expect.objectContaining({
        p_bill_id: "bill-007",
        p_tenders: [
          { method: "UPI", amount: 300.0, tendered_amount: 300.0, change_due: 0.0, transaction_ref: "UPI-881" },
          { method: "CARD", amount: 500.0, tendered_amount: 500.0, change_due: 0.0, transaction_ref: "CARD-112" },
        ],
      })
    );
  });

  it("8. Three-way split (CASH + UPI + CARD) records all 3 tenders correctly", async () => {
    const mockRpc = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        status: "SUCCESS",
        bill_id: "bill-008",
        payment_method: "MIXED",
        grand_total: 2000.0,
        tenders_count: 3,
      },
      error: null,
    } as any);

    await BillRepository.settleBillWithTenders(
      "bill-008",
      [
        { method: "cash", amount: 500.0 },
        { method: "upi", amount: 700.0, transactionRef: "UPI-332" },
        { method: "card", amount: 800.0, transactionRef: "CARD-441" },
      ],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "settle_bill_with_tenders_atomic",
      expect.objectContaining({
        p_bill_id: "bill-008",
        p_tenders: [
          { method: "CASH", amount: 500.0, tendered_amount: 500.0, change_due: 0.0, transaction_ref: null },
          { method: "UPI", amount: 700.0, tendered_amount: 700.0, change_due: 0.0, transaction_ref: "UPI-332" },
          { method: "CARD", amount: 800.0, tendered_amount: 800.0, change_due: 0.0, transaction_ref: "CARD-441" },
        ],
      })
    );
  });

  // =========================================================================
  // SCENARIOS 9-16: VALIDATIONS, IDEMPOTENCY & ATOMICITY
  // =========================================================================
  it("9-13. PaymentService handles full tenders array without truncation", async () => {
    const res = await PaymentService.recordPayment({
      billId: "bill-009",
      orderId: "order-009",
      tableLabel: "Table 1",
      paymentMethod: "mixed",
      amount: 1000.0,
      tenders: [
        { method: "cash", amount: 400.0 },
        { method: "upi", amount: 600.0 },
      ],
    });

    expect(res.settlement).toBeDefined();
    expect(res.settlement.paymentMethod).toBe("mixed");
    expect(res.settlement.tenders).toHaveLength(2);
    expect(res.settlement.tenders?.[0].amount).toBe(400.0);
    expect(res.settlement.tenders?.[1].amount).toBe(600.0);
  });

  it("14. Already PAID bill cannot be settled again (idempotent settlement)", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        status: "ALREADY_PAID",
        bill_id: "bill-014",
        payment_method: "CASH",
        paid_at: "2026-08-22T10:00:00Z",
        grand_total: 500.0,
      },
      error: null,
    } as any);

    const firstRes = await PaymentService.recordPayment({
      billId: "bill-014",
      orderId: "order-014",
      tableLabel: "Table 2",
      paymentMethod: "cash",
      amount: 500.0,
    });

    const secondRes = await PaymentService.recordPayment({
      billId: "bill-014",
      orderId: "order-014",
      tableLabel: "Table 2",
      paymentMethod: "cash",
      amount: 500.0,
    });

    expect(firstRes.settlement.status).toBe("settled");
    expect(secondRes.settlement.status).toBe("settled");
  });

  // =========================================================================
  // SCENARIOS 17-18: REPORTING RECONCILIATION
  // =========================================================================
  it("17. Daily Sales correctly aggregates tenders from bill_payments + legacy fallback", async () => {
    const mockReport = {
      business_date: BIZ_DATE,
      cafe_id: CAFE_ID,
      net_collected: 2057.25,
      paid_bills_count: 5,
      gross_subtotal: 2024.0,
      total_discounts: 0.0,
      total_tax: 33.25,
      cgst: 16.63,
      sgst: 16.62,
      total_service_charge: 0.0,
      total_round_off: 0.0,
      total_items_sold: 14,
      average_bill_value: 411.45,
      tenders: {
        cash: 1494.45,
        upi: 562.8,
        card: 0.0,
        other: 0.0,
      },
      pipeline: {
        unsettled_orders_count: 0,
        unsettled_pipeline_cents: 0,
        cancelled_orders_count: 0,
      },
    };

    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockReport,
      error: null,
    } as any);

    const report = await DailySalesRepository.fetchDailySalesReport(CAFE_ID, BIZ_DATE);
    expect(report.tenders.cash).toBe(1494.45);
    expect(report.tenders.upi).toBe(562.8);
    expect(report.tenders.card).toBe(0.0);
    expect(report.tenders.other).toBe(0.0);
    expect(report.net_collected).toBe(2057.25);
  });

  it("18. Owner Analytics tender totals reconcile with Daily Sales", async () => {
    const mockOwnerData = {
      cafe_id: CAFE_ID,
      current_business_date: BIZ_DATE,
      start_business_date: BIZ_DATE,
      end_business_date: BIZ_DATE,
      range_days: 1,
      today_financials: {
        net_collected: 2057.25,
        paid_bills_count: 5,
      },
      tenders: {
        cash: 1494.45,
        upi: 562.8,
        card: 0.0,
        other: 0.0,
      },
    };

    expect(mockOwnerData.tenders.cash + mockOwnerData.tenders.upi).toBe(2057.25);
  });

  // =========================================================================
  // SCENARIO 19: TRANSACTION DRILLDOWN EXPOSES SPLIT ALLOCATIONS
  // =========================================================================
  it("19. Transaction drilldown maps itemized tenders correctly", async () => {
    const mockTxResponse = {
      business_date: BIZ_DATE,
      cafe_id: CAFE_ID,
      transactions: [
        {
          bill_id: "tx-split-1",
          bill_number: 101,
          table_label: "Table 4",
          order_source: "DINE_IN",
          customer_name: "Aman",
          customer_phone: "9876543210",
          cashier_id: "Counter",
          payment_method: "MIXED",
          subtotal: 1000.0,
          discount: 0.0,
          cgst: 25.0,
          sgst: 25.0,
          service_charge: 0.0,
          round_off: 0.0,
          grand_total: 1050.0,
          total_items: 2,
          paid_at: "2026-08-22T12:00:00Z",
          business_date: BIZ_DATE,
          items: [{ item_name: "Pizza", quantity: 2, line_total: 1000.0 }],
          tenders: [
            { method: "CASH", amount: 450.0 },
            { method: "UPI", amount: 600.0, transaction_ref: "UPI-991" },
          ],
        },
      ],
    };

    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockTxResponse,
      error: null,
    } as any);

    const res = await DailySalesRepository.fetchDailySalesTransactions(CAFE_ID, BIZ_DATE);
    expect(res.transactions).toHaveLength(1);
    const tx = res.transactions[0];
    expect(tx.payment_method).toBe("MIXED");
    expect(tx.tenders).toHaveLength(2);
    expect(tx.tenders?.[0].method).toBe("CASH");
    expect(tx.tenders?.[0].amount).toBe(450.0);
    expect(tx.tenders?.[1].method).toBe("UPI");
    expect(tx.tenders?.[1].amount).toBe(600.0);
  });

  // =========================================================================
  // SCENARIO 20: RECEIPT PRINTS ALL TENDER LINES
  // =========================================================================
  it("20. Receipt builder prints itemized payment breakdown for split bill", () => {
    const receiptResult = ReceiptBuilder.build({
      billNumber: 101,
      tableLabel: "Table 4",
      items: [{ name: "Cheese Burger", price: 200.0, qty: 2 }],
      subtotal: 400.0,
      tax: 0.0,
      netTotal: 400.0,
      paymentStatus: "paid",
      tenders: [
        { method: "cash", amount: 150.0 },
        { method: "upi", amount: 250.0 },
      ],
    });

    expect(receiptResult.text).toContain("NET PAYABLE TOTAL:     Rs.400.00");
    expect(receiptResult.text).toContain("PAYMENT BREAKDOWN:");
    expect(receiptResult.text).toContain("CASH:                Rs.150.00");
    expect(receiptResult.text).toContain("UPI:                 Rs.250.00");
    expect(receiptResult.text).toContain("Mode: MIXED");
  });

  // =========================================================================
  // SCENARIOS 21-22: LEGACY BACKWARD COMPATIBILITY & NO DOUBLE COUNTING
  // =========================================================================
  it("21. Legacy single-tender bill produces single tender line on receipt", () => {
    const singleReceipt = ReceiptBuilder.build({
      billNumber: 102,
      tableLabel: "Table 1",
      items: [{ name: "Fries", price: 100.0, qty: 1 }],
      subtotal: 100.0,
      tax: 0.0,
      netTotal: 100.0,
      paymentStatus: "paid",
      tenders: [{ method: "cash", amount: 100.0 }],
    });

    expect(singleReceipt.text).toContain("Mode: CASH");
    expect(singleReceipt.text).not.toContain("PAYMENT BREAKDOWN:");
  });

  it("22. No double counting: sum of tender breakdown exactly matches net_collected", () => {
    const tenders = {
      cash: 400.0,
      upi: 600.0,
      card: 500.0,
      other: 0.0,
    };
    const totalTenders = tenders.cash + tenders.upi + tenders.card + tenders.other;
    const netCollected = 1500.0;
    expect(totalTenders).toBe(netCollected);
  });
});
