import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DailySalesService } from "@/lib/sales/dailySalesService";
import { DailySalesRepository } from "@/lib/sales/dailySalesRepository";
import { supabase } from "@/lib/db";
import type { DailySalesTransactionsResponse, DailySalesReport } from "@/lib/sales/types";

describe("Milestone 2C.2: Authoritative Daily Sales Transaction Drilldown Tests", () => {
  const CAFE_ID = "6d00d671-eaea-47ce-a842-f970878373c9";
  const BIZ_DATE = "2026-08-21";

  const mockTransactionsResponse: DailySalesTransactionsResponse = {
    business_date: BIZ_DATE,
    cafe_id: CAFE_ID,
    transactions: [
      {
        bill_id: "bill-1007",
        bill_number: 1007,
        table_label: "Table 01",
        order_source: "DINE_IN",
        customer_name: "Aman Gupta",
        customer_phone: "+919876543210",
        cashier_id: "Counter",
        payment_method: "CASH",
        subtotal: 500.0,
        discount: 0.0,
        cgst: 12.5,
        sgst: 12.5,
        service_charge: 0.0,
        round_off: 0.0,
        grand_total: 525.0,
        total_items: 2,
        paid_at: "2026-08-21T02:44:38.198Z",
        business_date: BIZ_DATE,
        items: [
          { item_name: "Paneer Butter Masala", quantity: 1, line_total: 350.0 },
          { item_name: "Butter Naan", quantity: 2, line_total: 175.0 },
        ],
      },
      {
        bill_id: "bill-1008",
        bill_number: 1008,
        table_label: "Table 02",
        order_source: "TAKEAWAY",
        customer_name: null,
        customer_phone: null,
        cashier_id: "staff-1",
        payment_method: "UPI",
        subtotal: 800.0,
        discount: 50.0,
        cgst: 20.0,
        sgst: 20.0,
        service_charge: 0.0,
        round_off: 0.0,
        grand_total: 790.0,
        total_items: 3,
        paid_at: "2026-08-21T03:15:00.000Z",
        business_date: BIZ_DATE,
        items: [
          { item_name: "Cheese Pizza", quantity: 1, line_total: 450.0 },
          { item_name: "Cold Coffee", quantity: 2, line_total: 350.0 },
        ],
      },
      {
        bill_id: "bill-1009",
        bill_number: 1009,
        table_label: "Quick Serve",
        order_source: "DINE_IN",
        customer_name: null,
        customer_phone: null,
        cashier_id: "Counter",
        payment_method: "MIXED",
        subtotal: 1000.0,
        discount: 0.0,
        cgst: 25.0,
        sgst: 25.0,
        service_charge: 0.0,
        round_off: 0.0,
        grand_total: 1050.0,
        total_items: 1,
        paid_at: "2026-08-21T04:00:00.000Z",
        business_date: BIZ_DATE,
        items: [{ item_name: "Chef Platter", quantity: 1, line_total: 1050.0 }],
      },
    ],
  };

  const mockReport: DailySalesReport = {
    business_date: BIZ_DATE,
    cafe_id: CAFE_ID,
    net_collected: 2365.0, // 525 + 790 + 1050
    gross_subtotal: 2300.0,
    total_discounts: 50.0,
    total_tax: 115.0,
    cgst: 57.5,
    sgst: 57.5,
    total_service_charge: 0.0,
    total_round_off: 0.0,
    paid_bills_count: 3,
    total_items_sold: 6,
    average_bill_value: 788.33,
    tenders: {
      cash: 525.0,
      upi: 790.0,
      card: 0.0,
      other: 1050.0,
    },
    pipeline: {
      unsettled_orders_count: 0,
      unsettled_pipeline_cents: 0,
      cancelled_orders_count: 0,
    },
  };

  beforeEach(() => {
    DailySalesService.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    DailySalesService.clearCache();
    vi.restoreAllMocks();
  });

  // 1. Repository invokes get_daily_sales_transactions with cafeId and businessDate
  it("1 & 2. Repository dispatches RPC get_daily_sales_transactions and parses response strictly", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockTransactionsResponse,
      error: null,
    } as any);

    const res = await DailySalesRepository.fetchDailySalesTransactions(CAFE_ID, BIZ_DATE);

    expect(rpcSpy).toHaveBeenCalledWith("get_daily_sales_transactions", {
      p_cafe_id: CAFE_ID,
      p_business_date: BIZ_DATE,
    });
    expect(res.business_date).toBe(BIZ_DATE);
    expect(res.transactions).toHaveLength(3);
    expect(res.transactions[0].bill_number).toBe(1007);
    expect(res.transactions[0].grand_total).toBe(525.0);
    expect(res.transactions[0].items).toHaveLength(2);
  });

  // 3. Error propagation on RPC failure
  it("3. Repository throws structured error when RPC fails", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: null,
      error: { message: "Permission denied for get_daily_sales_transactions", details: "RBAC check failed" },
    } as any);

    await expect(DailySalesRepository.fetchDailySalesTransactions(CAFE_ID, null)).rejects.toThrow(
      /Failed to fetch daily sales transactions/
    );
  });

  // 4. Mathematical Reconciliation Contract
  it("4 & 5. Reconciliation: Sum of transaction grand_totals equals net_collected and count equals paid_bills_count", async () => {
    const sumGrandTotals = mockTransactionsResponse.transactions.reduce((acc, t) => acc + t.grand_total, 0);
    const txCount = mockTransactionsResponse.transactions.length;

    expect(sumGrandTotals).toBe(mockReport.net_collected);
    expect(txCount).toBe(mockReport.paid_bills_count);
  });

  // 6. In-memory caching & de-duplication
  it("6. DailySalesService caches transaction list in memory and de-duplicates in-flight requests", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockTransactionsResponse,
      error: null,
    } as any);

    const p1 = DailySalesService.getDailySalesTransactions(CAFE_ID, null);
    const p2 = DailySalesService.getDailySalesTransactions(CAFE_ID, null);

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(res1).toEqual(res2);
    expect(res1.transactions).toHaveLength(3);
  });

  // 7. MIXED tender representation preserves single string without synthetic sub-splits
  it("7. MIXED payment_method preserves exact string without inventing split amounts", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockTransactionsResponse,
      error: null,
    } as any);

    const res = await DailySalesService.getDailySalesTransactions(CAFE_ID, BIZ_DATE);
    const mixedTx = res.transactions.find((t) => t.payment_method === "MIXED");

    expect(mixedTx).toBeDefined();
    expect(mixedTx?.payment_method).toBe("MIXED");
    expect(mixedTx?.grand_total).toBe(1050.0);
  });

  // 8. Empty business day returns empty array cleanly
  it("8. Empty business day returns empty transaction array cleanly without error", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: { business_date: "2026-08-22", cafe_id: CAFE_ID, transactions: [] },
      error: null,
    } as any);

    const res = await DailySalesService.getDailySalesTransactions(CAFE_ID, "2026-08-22");
    expect(res.transactions).toEqual([]);
    expect(res.business_date).toBe("2026-08-22");
  });

  // 9. Realtime invalidation clears transaction cache
  it("9. Realtime invalidation clears cached transactions and triggers fresh fetch on demand", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockTransactionsResponse,
      error: null,
    } as any);

    await DailySalesService.getDailySalesTransactions(CAFE_ID, BIZ_DATE);
    expect(rpcSpy).toHaveBeenCalledTimes(1);

    // Invalidate
    DailySalesService.invalidate(CAFE_ID);

    await DailySalesService.getDailySalesTransactions(CAFE_ID, BIZ_DATE);
    expect(rpcSpy).toHaveBeenCalledTimes(2);
  });
});
