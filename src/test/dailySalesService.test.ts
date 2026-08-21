import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DailySalesService } from "@/lib/sales/dailySalesService";
import { DailySalesRepository } from "@/lib/sales/dailySalesRepository";
import { supabase } from "@/lib/db";

describe("Milestone 2B.1: DailySalesService & Repository Unit Tests", () => {
  const CAFE_ID = "6d00d671-eaea-47ce-a842-f970878373c9";
  const TARGET_DATE = "2026-08-21";

  const mockSuccessfulRpcResponse = {
    business_date: "2026-08-21",
    cafe_id: CAFE_ID,
    net_collected: 1463,
    gross_subtotal: 1500,
    total_discounts: 150,
    total_tax: 67.5,
    cgst: 33.75,
    sgst: 33.75,
    total_service_charge: 45,
    total_round_off: 0.5,
    paid_bills_count: 2,
    total_items_sold: 7,
    average_bill_value: 731.5,
    tenders: {
      cash: 473,
      upi: 990,
      card: 0,
      other: 0,
    },
    pipeline: {
      unsettled_orders_count: 3,
      unsettled_pipeline_cents: 85000,
      cancelled_orders_count: 2,
    },
  };

  const mockZeroSalesRpcResponse = {
    business_date: "2026-08-22",
    cafe_id: CAFE_ID,
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
    tenders: {
      cash: 0,
      upi: 0,
      card: 0,
      other: 0,
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

  // 1. Successful RPC response maps correctly to TypeScript result
  it("1. Successful RPC response maps correctly to TypeScript result", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
      data: mockSuccessfulRpcResponse,
      error: null,
    } as any);

    const report = await DailySalesRepository.fetchDailySalesReport(CAFE_ID, TARGET_DATE);

    expect(rpcSpy).toHaveBeenCalledWith("get_daily_sales_report", {
      p_cafe_id: CAFE_ID,
      p_business_date: TARGET_DATE,
    });

    expect(report.business_date).toBe("2026-08-21");
    expect(report.cafe_id).toBe(CAFE_ID);
    expect(report.net_collected).toBe(1463);
    expect(report.gross_subtotal).toBe(1500);
    expect(report.total_discounts).toBe(150);
    expect(report.total_tax).toBe(67.5);
    expect(report.paid_bills_count).toBe(2);
    expect(report.total_items_sold).toBe(7);
    expect(report.average_bill_value).toBe(731.5);
  });

  // 2. Zero-sales response works
  it("2. Zero-sales response cleanly maps all financial and pipeline fields without NaN", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
      data: mockZeroSalesRpcResponse,
      error: null,
    } as any);

    const report = await DailySalesRepository.fetchDailySalesReport(CAFE_ID, "2026-08-22");

    expect(report.net_collected).toBe(0);
    expect(report.paid_bills_count).toBe(0);
    expect(report.average_bill_value).toBe(0);
    expect(report.tenders.cash).toBe(0);
    expect(report.tenders.upi).toBe(0);
    expect(report.pipeline.unsettled_orders_count).toBe(0);
  });

  // 3 & 4. Tender and Pipeline mapping
  it("3 & 4. Correctly extracts nested tender and pipeline metrics", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
      data: mockSuccessfulRpcResponse,
      error: null,
    } as any);

    const report = await DailySalesService.getDailySalesReport(CAFE_ID);

    expect(report.tenders.cash).toBe(473);
    expect(report.tenders.upi).toBe(990);
    expect(report.tenders.card).toBe(0);
    expect(report.tenders.other).toBe(0);

    expect(report.pipeline.unsettled_orders_count).toBe(3);
    expect(report.pipeline.unsettled_pipeline_cents).toBe(85000);
    expect(report.pipeline.cancelled_orders_count).toBe(2);
  });

  // 5. RPC failure is surfaced cleanly without converting to zero
  it("5. RPC database error is thrown and not silently swallowed as zero", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
      data: null,
      error: { message: "Database connection timeout", code: "PGRST500" },
    } as any);

    await expect(DailySalesService.getDailySalesReport(CAFE_ID)).rejects.toThrow(
      /Database connection timeout/
    );
  });

  // 6. Missing cafeId validation
  it("6. Rejects empty or missing cafeId with clear validation error", async () => {
    await expect(DailySalesService.getDailySalesReport("")).rejects.toThrow(
      /cafeId is required/
    );
  });

  // 7. In-memory caching: Repeated calls within TTL do not re-invoke RPC
  it("7. In-memory cache returns cached result without duplicate RPC calls", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockSuccessfulRpcResponse,
      error: null,
    } as any);

    // First call -> hits RPC
    const rep1 = await DailySalesService.getDailySalesReport(CAFE_ID, TARGET_DATE);
    // Second call -> hits cache
    const rep2 = await DailySalesService.getDailySalesReport(CAFE_ID, TARGET_DATE);

    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(rep1).toEqual(rep2);
  });

  // 8. In-flight promise de-duplication: Concurrent calls share the same active promise
  it("8. Concurrent requests for same cafe/date de-duplicate to single RPC dispatch", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ data: mockSuccessfulRpcResponse, error: null } as any),
            50
          );
        })
    );

    const [res1, res2, res3] = await Promise.all([
      DailySalesService.getDailySalesReport(CAFE_ID, TARGET_DATE),
      DailySalesService.getDailySalesReport(CAFE_ID, TARGET_DATE),
      DailySalesService.getDailySalesReport(CAFE_ID, TARGET_DATE),
    ]);

    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(res1).toEqual(res2);
    expect(res2).toEqual(res3);
  });

  // 9. Manual invalidate forces fresh fetch
  it("9. Manual invalidate() evicts cached report and causes fresh RPC execution", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockSuccessfulRpcResponse,
      error: null,
    } as any);

    await DailySalesService.getDailySalesReport(CAFE_ID, TARGET_DATE);
    expect(rpcSpy).toHaveBeenCalledTimes(1);

    // Invalidate
    DailySalesService.invalidate(CAFE_ID, TARGET_DATE);

    // Fetch again
    await DailySalesService.getDailySalesReport(CAFE_ID, TARGET_DATE);
    expect(rpcSpy).toHaveBeenCalledTimes(2);
  });

  // 10. Realtime subscription debounced invalidation & update notification
  it("10. Realtime listener receives debounced notification when bill is settled", async () => {
    let capturedBillCallback: ((payload: any) => void) | null = null;

    const mockChannel = {
      on: vi.fn().mockImplementation((event: string, opts: any, cb: any) => {
        if (opts.table === "bills") {
          capturedBillCallback = cb;
        }
        return mockChannel;
      }),
      subscribe: vi.fn().mockReturnValue({}),
      unsubscribe: vi.fn().mockResolvedValue({}),
    };

    vi.spyOn(supabase, "channel").mockReturnValue(mockChannel as any);
    vi.spyOn(supabase, "removeChannel").mockResolvedValue({} as any);
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockSuccessfulRpcResponse,
      error: null,
    } as any);

    const updateListener = vi.fn();
    const unsubscribe = DailySalesService.subscribeToDailySales(CAFE_ID, updateListener, 50);

    expect(capturedBillCallback).toBeDefined();

    // Simulate bill payment settlement event
    capturedBillCallback!({
      eventType: "UPDATE",
      old: { id: "b-1", payment_status: "PENDING" },
      new: { id: "b-1", payment_status: "PAID", grand_total: 500 },
    });

    // Wait for debounce window (50ms)
    await new Promise((r) => setTimeout(r, 100));

    expect(updateListener).toHaveBeenCalledTimes(1);
    expect(updateListener).toHaveBeenCalledWith(
      expect.objectContaining({
        business_date: "2026-08-21",
        net_collected: 1463,
      })
    );

    unsubscribe();
  });

  // 11. Realtime selective filtering: Irrelevant metadata updates do not trigger refresh
  it("11. Irrelevant metadata updates (e.g. notes or customer attribution) do not trigger unnecessary refresh", async () => {
    let capturedBillCallback: ((payload: any) => void) | null = null;

    const mockChannel = {
      on: vi.fn().mockImplementation((event: string, opts: any, cb: any) => {
        if (opts.table === "bills") {
          capturedBillCallback = cb;
        }
        return mockChannel;
      }),
      subscribe: vi.fn().mockReturnValue({}),
      unsubscribe: vi.fn().mockResolvedValue({}),
    };

    vi.spyOn(supabase, "channel").mockReturnValue(mockChannel as any);
    vi.spyOn(supabase, "removeChannel").mockResolvedValue({} as any);
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockSuccessfulRpcResponse,
      error: null,
    } as any);

    const updateListener = vi.fn();
    const unsubscribe = DailySalesService.subscribeToDailySales(CAFE_ID, updateListener, 50);

    // Simulate non-financial metadata update (e.g. notes only)
    capturedBillCallback!({
      eventType: "UPDATE",
      old: {
        id: "b-1",
        payment_status: "PAID",
        grand_total: 500,
        subtotal: 500,
        discount: 0,
        paid_at: "2026-08-21T10:00:00Z",
        payment_method: "CASH",
        total_items: 2,
        notes: "Old Note",
      },
      new: {
        id: "b-1",
        payment_status: "PAID",
        grand_total: 500,
        subtotal: 500,
        discount: 0,
        paid_at: "2026-08-21T10:00:00Z",
        payment_method: "CASH",
        total_items: 2,
        notes: "Updated Note",
      },
    });

    await new Promise((r) => setTimeout(r, 100));

    // Should NOT trigger refresh because no financial or status field changed
    expect(updateListener).not.toHaveBeenCalled();

    unsubscribe();
  });
});
