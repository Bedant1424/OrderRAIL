import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/lib/db";
import { createOrderInDb, type CreateOrderPayload } from "@/lib/orders/repository";

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

describe("Order Source Persistence Regression Tests (createOrderInDb)", () => {
  const capturedInserts: { table: string; payload: any }[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    capturedInserts.length = 0;

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => {
          if (table === "orders") {
            const hasInserted = capturedInserts.some((ci) => ci.table === "orders");
            if (!hasInserted) {
              // Existing order check: return null to trigger insert
              return { data: null, error: null };
            }
            // Verified order check: return verified order
            return {
              data: {
                id: "test-order-uuid",
                order_number: 101,
                status: "pending",
                order_items: [],
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
          capturedInserts.push({ table, payload });
          return { data: payload, error: null };
        }),
        update: vi.fn().mockReturnThis(),
      };
      return builder;
    });
  });

  const channels: Array<"DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO"> = [
    "DINE_IN",
    "TAKEAWAY",
    "SWIGGY",
    "ZOMATO",
  ];

  for (const channel of channels) {
    it(`persists explicit order_source: '${channel}' to public.orders insert`, async () => {
      const orderId = crypto.randomUUID();
      const payload: CreateOrderPayload = {
        id: orderId,
        cafe_id: "8c418a5a-7cd4-4054-8a88-f412c1762f7d",
        table_id: channel === "DINE_IN" ? crypto.randomUUID() : null,
        order_source: channel,
        total_cents: 3500,
        note: `Test ${channel} order`,
        items: [
          {
            name: "Cheese Garlic Bread",
            price_cents: 3500,
            qty: 1,
          },
        ],
      };

      await createOrderInDb(payload);

      const orderInsert = capturedInserts.find((ci) => ci.table === "orders");
      expect(orderInsert).toBeDefined();
      expect(orderInsert!.payload.order_source).toBe(channel);
      expect(orderInsert!.payload.total_cents).toBe(3500);
    });
  }

  it("defaults omitted order_source to DINE_IN when table_id is present", async () => {
    const tableId = crypto.randomUUID();
    const payload: CreateOrderPayload = {
      id: crypto.randomUUID(),
      cafe_id: "8c418a5a-7cd4-4054-8a88-f412c1762f7d",
      table_id: tableId,
      total_cents: 1200,
      items: [
        {
          name: "Masala Chai",
          price_cents: 1200,
          qty: 1,
        },
      ],
    };

    await createOrderInDb(payload);

    const orderInsert = capturedInserts.find((ci) => ci.table === "orders");
    expect(orderInsert).toBeDefined();
    expect(orderInsert!.payload.order_source).toBe("DINE_IN");
  });

  it("defaults omitted order_source to TAKEAWAY when table_id is null or express", async () => {
    const payload: CreateOrderPayload = {
      id: crypto.randomUUID(),
      cafe_id: "8c418a5a-7cd4-4054-8a88-f412c1762f7d",
      table_id: "express",
      total_cents: 1200,
      items: [
        {
          name: "Espresso",
          price_cents: 1200,
          qty: 1,
        },
      ],
    };

    await createOrderInDb(payload);

    const orderInsert = capturedInserts.find((ci) => ci.table === "orders");
    expect(orderInsert).toBeDefined();
    expect(orderInsert!.payload.order_source).toBe("TAKEAWAY");
  });
});
