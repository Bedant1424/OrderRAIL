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
        const selectChain: any = {
          eq: vi.fn(),
          neq: vi.fn(),
          is: vi.fn(),
          in: vi.fn(),
        };

        const createQueryChain = (data: any, error: any) => {
          const queryChain: any = {
            eq: vi.fn().mockImplementation(() => queryChain),
            neq: vi.fn().mockImplementation(() => queryChain),
            is: vi.fn().mockImplementation(() => queryChain),
            in: vi.fn().mockImplementation(() => queryChain),
            order: vi.fn().mockImplementation(() => queryChain),
            limit: vi.fn().mockImplementation(() => queryChain),
            maybeSingle: vi.fn().mockResolvedValue({ data, error }),
            then: (onfulfilled: any) => Promise.resolve({ data, error }).then(onfulfilled),
          };
          return queryChain;
        };

        selectChain.eq.mockImplementation((eqCol: string, eqVal: string) => {
          let data: any = null;
          let error: any = overrides?.selectOrderError ?? null;
          if (table === "orders") {
            data = overrides?.orderExists ? { id: testOrder.id } : { id: testOrder.id, order_items: [] };
          } else if (table === "order_items") {
            data = overrides?.itemsExist ? [{ id: "existing-item-1" }] : [];
          } else if (table === "tables") {
            data = { active_session_id: "test-dining-session-1" };
          } else if (table === "dining_sessions") {
            data = { id: "test-dining-session-1", status: "active" };
          }
          return createQueryChain(data, error);
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
