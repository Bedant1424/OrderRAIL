import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/lib/db";
import {
  CounterOrderBuilderService,
  type BuildCounterOrderParams,
} from "@/windows-pos/services/counterOrderBuilderService";
import { MockCounterPrinter } from "@/windows-pos/services/printer/counterPrinter";
import type { OrderSource } from "@/windows-pos/types/counterTypes";

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    supabase: {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});

describe("Milestone 3 — Four-Channel Counter Ordering & KOT Dispatch Tests", () => {
  const testCafeId = "8c418a5a-7cd4-4054-8a88-f412c1762f7d";
  const capturedOrderInserts: any[] = [];
  const capturedItemInserts: any[] = [];
  let mockPrinter: MockCounterPrinter;

  const sampleItems = [
    {
      id: "cart-item-1",
      menuItemId: "item-pizza-uuid",
      name: "Cheese Burst Pizza",
      priceCents: 35000,
      qty: 1,
      note: "Extra oregano",
    },
    {
      id: "cart-item-2",
      menuItemId: "item-coke-uuid",
      name: "Chilled Coke",
      priceCents: 6000,
      qty: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOrderInserts.length = 0;
    capturedItemInserts.length = 0;
    mockPrinter = new MockCounterPrinter();

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => {
          if (table === "orders") {
            const lastOrder = capturedOrderInserts[capturedOrderInserts.length - 1];
            if (!lastOrder) {
              // Duplicate check prior to insert: null indicates no duplicate exists
              return { data: null, error: null };
            }
            // Verified order readback after insert
            return {
              data: {
                id: lastOrder.id,
                order_number: 108,
                daily_order_number: 108,
                table_id: lastOrder.table_id,
                dining_session_id: lastOrder.dining_session_id,
                order_source: lastOrder.order_source,
                external_order_ref: lastOrder.external_order_ref,
                total_cents: lastOrder.total_cents,
                status: lastOrder.status || "preparing",
                created_at: new Date().toISOString(),
                customer_name: lastOrder.customer_name,
                customer_phone: lastOrder.customer_phone,
                note: lastOrder.note,
                order_items: capturedItemInserts.map((ci) => ({
                  id: ci.id || crypto.randomUUID(),
                  order_id: lastOrder.id,
                  menu_item_id: ci.menu_item_id,
                  name: ci.name,
                  price_cents: ci.price_cents,
                  qty: ci.qty,
                  note: ci.note,
                })),
              },
              error: null,
            };
          }
          if (table === "dining_sessions") {
            return { data: { status: "active" }, error: null };
          }
          return { data: null, error: null };
        }),
        insert: vi.fn().mockImplementation(async (payload: any) => {
          if (table === "orders") {
            capturedOrderInserts.push(payload);
          } else if (table === "order_items") {
            if (Array.isArray(payload)) {
              capturedItemInserts.push(...payload);
            } else {
              capturedItemInserts.push(payload);
            }
          }
          return { data: payload, error: null };
        }),
        update: vi.fn().mockReturnThis(),
      };
      return builder;
    });
  });

  it("1. DINE_IN order creation produces order_source: 'DINE_IN' and preserves table_id", async () => {
    const tableUuid = "table-12-uuid";
    const params: BuildCounterOrderParams = {
      cafeId: testCafeId,
      orderSource: "DINE_IN",
      items: sampleItems,
      tableId: tableUuid,
      tableLabel: "Table 12",
      diningSessionId: "c0ffee12-1212-4000-8000-121212121212",
      customerName: "Ananya",
      printer: mockPrinter,
    };

    const payload = CounterOrderBuilderService.buildPayload(params);
    expect(payload.order_source).toBe("DINE_IN");
    expect(payload.table_id).toBe(tableUuid);
    expect(payload.dining_session_id).toBe("c0ffee12-1212-4000-8000-121212121212");
    expect(payload.total_cents).toBe(47000); // 35000 + 6000*2

    const result = await CounterOrderBuilderService.submitOrder(params, "Cheese Corner");
    expect(result.success).toBe(true);
    expect(result.orderSource).toBe("DINE_IN");
    expect(result.tableId).toBe(tableUuid);
    expect(result.diningSessionId).toBe("c0ffee12-1212-4000-8000-121212121212");
    expect(result.totalCents).toBe(47000);

    const inserted = capturedOrderInserts[0];
    expect(inserted).toBeDefined();
    expect(inserted.order_source).toBe("DINE_IN");
    expect(inserted.table_id).toBe(tableUuid);
  });

  it("2. TAKEAWAY order creation produces order_source: 'TAKEAWAY', table_id: null, dining_session_id: null", async () => {
    const params: BuildCounterOrderParams = {
      cafeId: testCafeId,
      orderSource: "TAKEAWAY",
      items: sampleItems,
      customerName: "Vikram",
      customerPhone: "+919123456780",
      printer: mockPrinter,
    };

    const payload = CounterOrderBuilderService.buildPayload(params);
    expect(payload.order_source).toBe("TAKEAWAY");
    expect(payload.table_id).toBeNull();
    expect(payload.dining_session_id).toBeNull();

    const result = await CounterOrderBuilderService.submitOrder(params, "Cheese Corner");
    expect(result.success).toBe(true);
    expect(result.orderSource).toBe("TAKEAWAY");
    expect(result.tableId).toBeNull();
    expect(result.diningSessionId).toBeNull();

    const inserted = capturedOrderInserts[0];
    expect(inserted.order_source).toBe("TAKEAWAY");
    expect(inserted.table_id).toBeNull();
    expect(inserted.dining_session_id).toBeNull();
  });

  it("3. SWIGGY order creation produces order_source: 'SWIGGY', table_id: null, dining_session_id: null", async () => {
    const params: BuildCounterOrderParams = {
      cafeId: testCafeId,
      orderSource: "SWIGGY",
      items: sampleItems,
      externalOrderRef: "SWG-8821",
      printer: mockPrinter,
    };

    const payload = CounterOrderBuilderService.buildPayload(params);
    expect(payload.order_source).toBe("SWIGGY");
    expect(payload.table_id).toBeNull();
    expect(payload.dining_session_id).toBeNull();
    expect(payload.external_order_ref).toBe("SWG-8821");

    const result = await CounterOrderBuilderService.submitOrder(params, "Cheese Corner");
    expect(result.success).toBe(true);
    expect(result.orderSource).toBe("SWIGGY");
    expect(result.tableId).toBeNull();
    expect(result.diningSessionId).toBeNull();
    expect(result.externalOrderRef).toBe("SWG-8821");

    const inserted = capturedOrderInserts[0];
    expect(inserted.order_source).toBe("SWIGGY");
    expect(inserted.table_id).toBeNull();
    expect(inserted.external_order_ref).toBe("SWG-8821");
  });

  it("4. ZOMATO order creation produces order_source: 'ZOMATO', table_id: null, dining_session_id: null", async () => {
    const params: BuildCounterOrderParams = {
      cafeId: testCafeId,
      orderSource: "ZOMATO",
      items: sampleItems,
      externalOrderRef: "ZOM-4419",
      printer: mockPrinter,
    };

    const payload = CounterOrderBuilderService.buildPayload(params);
    expect(payload.order_source).toBe("ZOMATO");
    expect(payload.table_id).toBeNull();
    expect(payload.dining_session_id).toBeNull();
    expect(payload.external_order_ref).toBe("ZOM-4419");

    const result = await CounterOrderBuilderService.submitOrder(params, "Cheese Corner");
    expect(result.success).toBe(true);
    expect(result.orderSource).toBe("ZOMATO");
    expect(result.tableId).toBeNull();
    expect(result.diningSessionId).toBeNull();
    expect(result.externalOrderRef).toBe("ZOM-4419");

    const inserted = capturedOrderInserts[0];
    expect(inserted.order_source).toBe("ZOMATO");
    expect(inserted.table_id).toBeNull();
    expect(inserted.external_order_ref).toBe("ZOM-4419");
  });

  it("5. Non-Dine-In orders reject/strip table and dining session IDs even if passed in params", () => {
    const nonDineInChannels: OrderSource[] = ["TAKEAWAY", "SWIGGY", "ZOMATO"];

    for (const channel of nonDineInChannels) {
      const payload = CounterOrderBuilderService.buildPayload({
        cafeId: testCafeId,
        orderSource: channel,
        items: sampleItems,
        tableId: "accidental-table-uuid",
        diningSessionId: "accidental-session-uuid",
      });

      expect(payload.table_id).toBeNull();
      expect(payload.dining_session_id).toBeNull();
    }
  });

  it("6. DINE_IN rejects missing or empty tableId", async () => {
    // Missing tableId
    expect(() =>
      CounterOrderBuilderService.buildPayload({
        cafeId: testCafeId,
        orderSource: "DINE_IN",
        items: sampleItems,
        tableId: undefined,
      })
    ).toThrow("Dine-In orders require a valid table selection.");

    // Empty string tableId
    expect(() =>
      CounterOrderBuilderService.buildPayload({
        cafeId: testCafeId,
        orderSource: "DINE_IN",
        items: sampleItems,
        tableId: "   ",
      })
    ).toThrow("Dine-In orders require a valid table selection.");

    // "express" tableId (used for counter quick checkout, not dine-in)
    expect(() =>
      CounterOrderBuilderService.buildPayload({
        cafeId: testCafeId,
        orderSource: "DINE_IN",
        items: sampleItems,
        tableId: "express",
      })
    ).toThrow("Dine-In orders require a valid table selection.");

    // submitOrder reports error gracefully
    const res = await CounterOrderActionServiceAccept({
      cafeId: testCafeId,
      orderSource: "DINE_IN",
      items: sampleItems,
      tableId: null,
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Dine-In orders require a valid table selection.");
  });

  async function CounterOrderActionServiceAccept(params: any) {
    return CounterOrderBuilderService.submitOrder(params);
  }

  it("7. Swiggy preserves external_order_ref and includes ref in order notes", async () => {
    const params: BuildCounterOrderParams = {
      cafeId: testCafeId,
      orderSource: "SWIGGY",
      items: sampleItems,
      externalOrderRef: "SWIGGY-991",
      orderNote: "Call customer on arrival",
      printer: mockPrinter,
    };

    const payload = CounterOrderBuilderService.buildPayload(params);
    expect(payload.external_order_ref).toBe("SWIGGY-991");
    expect(payload.note).toContain("Swiggy Ref: SWIGGY-991");
    expect(payload.note).toContain("Call customer on arrival");

    const result = await CounterOrderBuilderService.submitOrder(params);
    expect(result.success).toBe(true);
    expect(result.externalOrderRef).toBe("SWIGGY-991");
    expect(capturedOrderInserts[0].external_order_ref).toBe("SWIGGY-991");
  });

  it("8. Zomato preserves external_order_ref and includes ref in order notes", async () => {
    const params: BuildCounterOrderParams = {
      cafeId: testCafeId,
      orderSource: "ZOMATO",
      items: sampleItems,
      externalOrderRef: "ZOM-773",
      orderNote: "No disposable cutlery requested",
      printer: mockPrinter,
    };

    const payload = CounterOrderBuilderService.buildPayload(params);
    expect(payload.external_order_ref).toBe("ZOM-773");
    expect(payload.note).toContain("Zomato Ref: ZOM-773");
    expect(payload.note).toContain("No disposable cutlery requested");

    const result = await CounterOrderBuilderService.submitOrder(params);
    expect(result.success).toBe(true);
    expect(result.externalOrderRef).toBe("ZOM-773");
    expect(capturedOrderInserts[0].external_order_ref).toBe("ZOM-773");
  });

  it("9. KOT generated for each channel correctly identifies channel and table/external ref in output", async () => {
    // 9a: DINE_IN
    const dineInRes = await CounterOrderBuilderService.submitOrder({
      cafeId: testCafeId,
      orderSource: "DINE_IN",
      items: sampleItems,
      tableId: "table-5-uuid",
      tableLabel: "Table 5",
      printer: mockPrinter,
    });
    expect(dineInRes.kot).toBeDefined();
    expect(dineInRes.kot!.text).toContain("TABLE 5");
    expect(dineInRes.kot!.text).toContain("DINE IN");

    // 9b: TAKEAWAY
    const takeawayRes = await CounterOrderBuilderService.submitOrder({
      cafeId: testCafeId,
      orderSource: "TAKEAWAY",
      items: sampleItems,
      printer: mockPrinter,
    });
    expect(takeawayRes.kot).toBeDefined();
    expect(takeawayRes.kot!.text).toContain("TAKEAWAY");

    // 9c: SWIGGY
    const swiggyRes = await CounterOrderBuilderService.submitOrder({
      cafeId: testCafeId,
      orderSource: "SWIGGY",
      items: sampleItems,
      externalOrderRef: "9912",
      printer: mockPrinter,
    });
    expect(swiggyRes.kot).toBeDefined();
    expect(swiggyRes.kot!.text).toContain("SWIGGY");
    expect(swiggyRes.kot!.text).toContain("9912");

    // 9d: ZOMATO
    const zomatoRes = await CounterOrderBuilderService.submitOrder({
      cafeId: testCafeId,
      orderSource: "ZOMATO",
      items: sampleItems,
      externalOrderRef: "5541",
      printer: mockPrinter,
    });
    expect(zomatoRes.kot).toBeDefined();
    expect(zomatoRes.kot!.text).toContain("ZOMATO");
    expect(zomatoRes.kot!.text).toContain("5541");
  });

  it("10. Mock printer captures raw KOT bytes for all 4 channels without physical hardware", async () => {
    const channels: Array<{ source: OrderSource; ref?: string; tableId?: string; label?: string }> = [
      { source: "DINE_IN", tableId: "table-1-uuid", label: "Table 1" },
      { source: "TAKEAWAY" },
      { source: "SWIGGY", ref: "SW-01" },
      { source: "ZOMATO", ref: "ZM-02" },
    ];

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const res = await CounterOrderBuilderService.submitOrder({
        cafeId: testCafeId,
        orderSource: ch.source,
        items: sampleItems,
        tableId: ch.tableId || null,
        tableLabel: ch.label || null,
        externalOrderRef: ch.ref || null,
        printer: mockPrinter,
      });

      expect(res.success).toBe(true);
      expect(res.printResult?.status).toBe("ACCEPTED_FOR_TEST_PRINT");
      expect(res.printResult?.bytesPrinted).toBeGreaterThan(50);
      expect(mockPrinter.getLastPayload()).toBe(res.kot!.rawBytes);
      expect(mockPrinter.getHistory()).toHaveLength(i + 1);
    }
  });
});
