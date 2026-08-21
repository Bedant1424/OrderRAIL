import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DailySalesService } from "@/lib/sales/dailySalesService";
import { DailySalesRepository } from "@/lib/sales/dailySalesRepository";
import { supabase } from "@/lib/db";

describe("Milestone 2B.3: DailySalesService & Repository Rollover & Freshness Tests", () => {
  const CAFE_ID = "6d00d671-eaea-47ce-a842-f970878373c9";
  const DAY_1 = "2026-08-21";
  const DAY_2 = "2026-08-22";

  const mockDay1Report = {
    business_date: DAY_1,
    cafe_id: CAFE_ID,
    net_collected: 14850,
    gross_subtotal: 14200,
    total_discounts: 450,
    total_tax: 710,
    cgst: 355,
    sgst: 355,
    total_service_charge: 390,
    total_round_off: 0,
    paid_bills_count: 32,
    total_items_sold: 84,
    average_bill_value: 464.06,
    tenders: {
      cash: 5200,
      upi: 8450,
      card: 1200,
      other: 0,
    },
    pipeline: {
      unsettled_orders_count: 2,
      unsettled_pipeline_cents: 113100,
      cancelled_orders_count: 1,
    },
  };

  const mockDay2ZeroReport = {
    business_date: DAY_2,
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
    vi.useRealTimers();
  });

  // 1. Same-day caching: Within same day, repeated calls hit in-memory cache
  it("1. Current cached report is returned without duplicate RPC during the same business date", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockDay1Report,
      error: null,
    } as any);

    const r1 = await DailySalesService.getDailySalesReport(CAFE_ID, null);
    const r2 = await DailySalesService.getDailySalesReport(CAFE_ID, null);

    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  // 2. Rollover cache freshness: When local calendar date advances past fetched date, CURRENT cache is invalidated
  it("2. Stale CURRENT report is automatically invalidated and refetched when date boundary rolls over", async () => {
    // Lock time to Day 1 (Aug 21, 23:55)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T23:55:00.000Z"));

    const rpcSpy = vi.spyOn(supabase, "rpc")
      .mockResolvedValueOnce({ data: mockDay1Report, error: null } as any)
      .mockResolvedValueOnce({ data: mockDay2ZeroReport, error: null } as any);

    // Initial fetch on Day 1
    const report1 = await DailySalesService.getDailySalesReport(CAFE_ID, null);
    expect(report1.business_date).toBe(DAY_1);
    expect(report1.net_collected).toBe(14850);
    expect(rpcSpy).toHaveBeenCalledTimes(1);

    // Advance clock past midnight to Day 2 (Aug 22, 00:05)
    vi.setSystemTime(new Date("2026-08-22T00:05:00.000Z"));

    // Next fetch without forceRefresh detects date rollover and triggers fresh authoritative RPC
    const report2 = await DailySalesService.getDailySalesReport(CAFE_ID, null);
    expect(rpcSpy).toHaveBeenCalledTimes(2);
    expect(report2.business_date).toBe(DAY_2);
    expect(report2.net_collected).toBe(0);
    expect(report2.paid_bills_count).toBe(0);
  });

  // 3. De-duplication across concurrent rollover requests
  it("3. Multiple concurrent requests after rollover de-duplicate to single RPC dispatch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T23:55:00.000Z"));

    const rpcSpy = vi.spyOn(supabase, "rpc")
      .mockResolvedValueOnce({ data: mockDay1Report, error: null } as any)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockDay2ZeroReport, error: null } as any), 50);
          })
      );

    await DailySalesService.getDailySalesReport(CAFE_ID, null);
    expect(rpcSpy).toHaveBeenCalledTimes(1);

    // Advance to next day
    vi.setSystemTime(new Date("2026-08-22T00:05:00.000Z"));

    // 3 concurrent fetches
    const p1 = DailySalesService.getDailySalesReport(CAFE_ID, null);
    const p2 = DailySalesService.getDailySalesReport(CAFE_ID, null);
    const p3 = DailySalesService.getDailySalesReport(CAFE_ID, null);

    vi.advanceTimersByTime(60);

    const [res1, res2, res3] = await Promise.all([p1, p2, p3]);

    expect(rpcSpy).toHaveBeenCalledTimes(2);
    expect(res1.business_date).toBe(DAY_2);
    expect(res2.business_date).toBe(DAY_2);
    expect(res3.business_date).toBe(DAY_2);
  });

  // 4. Explicit historical date queries are unaffected by CURRENT rollover
  it("4. Explicit historical date queries remain strictly cached and unaffected by CURRENT rollover logic", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: mockDay1Report,
      error: null,
    } as any);

    // Fetch historical day explicitly
    const hist1 = await DailySalesService.getDailySalesReport(CAFE_ID, DAY_1);
    const hist2 = await DailySalesService.getDailySalesReport(CAFE_ID, DAY_1);

    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(hist1.business_date).toBe(DAY_1);
    expect(hist2.business_date).toBe(DAY_1);
  });

  // 5. Realtime invalidation triggers debounced update callback
  it("5. Realtime bill update invalidates cache and delivers fresh report", async () => {
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
      data: mockDay1Report,
      error: null,
    } as any);

    const updateListener = vi.fn();
    const unsubscribe = DailySalesService.subscribeToDailySales(CAFE_ID, updateListener, 50);

    expect(capturedBillCallback).toBeDefined();

    // Trigger realtime bill paid event
    capturedBillCallback!({
      eventType: "UPDATE",
      old: { id: "b-1", payment_status: "PENDING" },
      new: { id: "b-1", payment_status: "PAID", grand_total: 500 },
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(updateListener).toHaveBeenCalledWith(
      expect.objectContaining({
        business_date: DAY_1,
        net_collected: 14850,
      })
    );

    unsubscribe();
  });
});
