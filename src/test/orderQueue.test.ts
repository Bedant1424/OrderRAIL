import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitOrder, flushQueue } from "../lib/orderQueue";
import { supabase } from "../integrations/supabase/client";
import { clearAllOperations } from "@/lib/offline";

// Mock supabase client
vi.mock("../integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe("Offline Order Queue & Sync", () => {
  let originalOnLine: boolean;
  const KEY = "orderrail.order_queue";

  beforeEach(async () => {
    originalOnLine = navigator.onLine;
    localStorage.clear();
    await clearAllOperations();
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      configurable: true,
    });
  });

  const testOrder = {
    id: "test-order-id-1",
    cafe_id: "test-cafe-1",
    table_id: "test-table-1",
    session_id: "test-session-1",
    dining_session_id: "test-dining-session-1",
    note: "No ice",
    total_cents: 1500,
    items: [
      {
        menu_item_id: "item-1",
        name: "Iced Latte",
        price_cents: 500,
        qty: 3,
      },
    ],
  };

  function setOnline(online: boolean) {
    Object.defineProperty(navigator, "onLine", {
      value: online,
      configurable: true,
    });
  }

  function setupMockSupabase(overrides?: {
    orderExists?: boolean;
    itemsExist?: boolean;
    insertOrderError?: unknown;
    insertItemsError?: unknown;
    selectOrderError?: unknown;
  }) {
    const mockFrom = supabase.from as unknown as {
      mockImplementation: (fn: (table: string) => unknown) => void;
    };

    mockFrom.mockImplementation((table: string) => {
      const chain = {
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
      };

      chain.insert.mockImplementation(async () => {
        if (table === "orders") {
          return { error: overrides?.insertOrderError ?? null };
        }
        if (table === "order_items") {
          return { error: overrides?.insertItemsError ?? null };
        }
        return { error: null };
      });

      chain.select.mockImplementation(() => {
        const selectChain = {
          eq: vi.fn(),
        };
        selectChain.eq.mockImplementation((eqCol: string, eqVal: string) => {
          interface EqResult {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            then?: (onfulfilled: (res: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
          }
          const eqChain: EqResult = {
            maybeSingle: vi.fn().mockImplementation(async () => {
              if (table === "orders") {
                if (overrides?.orderExists) {
                  return { data: { id: testOrder.id }, error: null };
                }
                return { data: null, error: null };
              }
              if (table === "dining_sessions") {
                return { data: { status: "browsing" }, error: null };
              }
              return { data: null, error: null };
            }),
          };

          eqChain.then = (onfulfilled: (res: { data: unknown; error: unknown }) => unknown) => {
            if (table === "order_items") {
              const data = overrides?.itemsExist ? [{ id: "existing-item-uuid-1" }] : [];
              return Promise.resolve(onfulfilled({ data, error: null }));
            }
            return Promise.resolve(onfulfilled({ data: null, error: null }));
          };

          return eqChain;
        });
        return selectChain;
      });

      chain.update.mockImplementation(() => {
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      return chain;
    });
  }

  it("should queue order in localStorage if offline", async () => {
    setOnline(false);

    const res = await submitOrder(testOrder);
    expect(res.queued).toBe(true);
    expect(res.orderId).toBe(testOrder.id);

    const queued = JSON.parse(localStorage.getItem(KEY) || "[]");
    expect(queued).toHaveLength(1);
    expect(queued[0].id).toBe(testOrder.id);
  });

  it("should push order directly to supabase if online", async () => {
    setOnline(true);
    setupMockSupabase({ orderExists: false, itemsExist: false });

    const res = await submitOrder(testOrder);
    expect(res.queued).toBe(false);
    expect(res.orderId).toBe(testOrder.id);

    const queued = JSON.parse(localStorage.getItem(KEY) || "[]");
    expect(queued).toHaveLength(0);

    expect(supabase.from).toHaveBeenCalledWith("orders");
  });

  it("should fallback to queue if online but push fails", async () => {
    setOnline(true);
    setupMockSupabase({ orderExists: false, itemsExist: false, insertOrderError: { message: "DB Error" } });

    const res = await submitOrder(testOrder);
    expect(res.queued).toBe(true);
    expect(res.orderId).toBe(testOrder.id);

    const queued = JSON.parse(localStorage.getItem(KEY) || "[]");
    expect(queued).toHaveLength(1);
  });

  it("should flush queue when flushQueue is called", async () => {
    setOnline(true);
    localStorage.setItem(KEY, JSON.stringify([testOrder]));
    setupMockSupabase({ orderExists: false, itemsExist: false });

    await flushQueue();

    const queued = JSON.parse(localStorage.getItem(KEY) || "[]");
    expect(queued).toHaveLength(0);
  });

  it("should handle interrupted sync: partial sync (order header exists, items missing) succeeds on next flush", async () => {
    setOnline(true);
    localStorage.setItem(KEY, JSON.stringify([testOrder]));
    setupMockSupabase({ orderExists: true, itemsExist: false });

    await flushQueue();

    const queued = JSON.parse(localStorage.getItem(KEY) || "[]");
    expect(queued).toHaveLength(0);
  });

  it("should handle interrupted sync: full sync (order header and items exist) clears queue on next flush without duplicates", async () => {
    setOnline(true);
    localStorage.setItem(KEY, JSON.stringify([testOrder]));
    setupMockSupabase({ orderExists: true, itemsExist: true });

    await flushQueue();

    const queued = JSON.parse(localStorage.getItem(KEY) || "[]");
    expect(queued).toHaveLength(0);
  });
});
