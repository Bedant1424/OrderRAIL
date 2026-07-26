import { describe, it, expect } from "vitest";
import {
  computeDailyOrderNumbers,
  formatOrderDisplayNumber,
  formatOrderLabelUnified,
  sortOrdersByLane
} from "@/lib/orders/orderUtils";
import { formatOrderLabel, type Order, type OrderItem } from "@/lib/db";
import { generateOrdersCSV } from "@/lib/orders/csvExporter";

describe("Sprint 9.2.2.7 — Unified Daily Order Numbering & Staff Console Ordering Audit", () => {
  const sampleOrders: (Order & { order_items: OrderItem[] })[] = [
    {
      id: "ord-001",
      cafe_id: "cafe-1",
      table_id: "tbl-1",
      session_id: "sess-1",
      order_number: 230,
      total_cents: 1000,
      status: "pending",
      created_at: "2026-07-26T10:00:00.000Z",
      updated_at: "2026-07-26T10:00:00.000Z",
      notes: null,
      order_items: [{ id: "i1", order_id: "ord-001", menu_item_id: "m1", name: "Latte", qty: 1, price_cents: 1000, notes: null }]
    },
    {
      id: "ord-002",
      cafe_id: "cafe-1",
      table_id: "tbl-2",
      session_id: "sess-2",
      order_number: 236,
      total_cents: 1500,
      status: "preparing",
      created_at: "2026-07-26T10:05:00.000Z",
      updated_at: "2026-07-26T10:05:00.000Z",
      notes: null,
      order_items: [{ id: "i2", order_id: "ord-002", menu_item_id: "m2", name: "Croissant", qty: 2, price_cents: 750, notes: null }]
    },
    {
      id: "ord-003",
      cafe_id: "cafe-1",
      table_id: "tbl-1",
      session_id: "sess-1",
      order_number: 239,
      total_cents: 800,
      status: "ready",
      created_at: "2026-07-26T10:10:00.000Z",
      updated_at: "2026-07-26T10:10:00.000Z",
      notes: null,
      order_items: [{ id: "i3", order_id: "ord-003", menu_item_id: "m3", name: "Espresso", qty: 2, price_cents: 400, notes: null }]
    },
    {
      id: "ord-004",
      cafe_id: "cafe-1",
      table_id: "tbl-3",
      session_id: "sess-3",
      order_number: 242,
      total_cents: 2000,
      status: "served",
      created_at: "2026-07-26T10:15:00.000Z",
      updated_at: "2026-07-26T10:30:00.000Z",
      notes: null,
      order_items: [{ id: "i4", order_id: "ord-004", menu_item_id: "m4", name: "Panini", qty: 1, price_cents: 2000, notes: null }]
    }
  ];

  it("Scenario 1: 10 sequential orders map to unified daily display numbers #1..#10 without skips", () => {
    const tenOrders: (Order & { order_items: OrderItem[] })[] = Array.from({ length: 10 }, (_, idx) => ({
      id: `ord-seq-${idx + 1}`,
      cafe_id: "cafe-1",
      table_id: "tbl-1",
      session_id: "sess-1",
      order_number: 200 + idx * 5, // DB sequence skips e.g. 200, 205, 210...
      total_cents: 500,
      status: "pending",
      created_at: new Date(1785000000000 + idx * 60000).toISOString(),
      updated_at: new Date(1785000000000 + idx * 60000).toISOString(),
      notes: null,
      order_items: []
    }));

    const dailyMap = computeDailyOrderNumbers(tenOrders);

    tenOrders.forEach((o, idx) => {
      const dailyNum = dailyMap.get(o.id);
      expect(dailyNum).toBe(idx + 1);
      expect(formatOrderDisplayNumber(dailyNum!)).toBe(`#${idx + 1}`);
      expect(formatOrderLabel(dailyNum!)).toBe(`Order #${idx + 1}`);
    });
  });

  it("Scenario 2: Cancelling order #4 maintains consistent daily display numbering without breaking UUIDs", () => {
    const dailyMap = computeDailyOrderNumbers(sampleOrders);

    expect(dailyMap.get("ord-001")).toBe(1);
    expect(dailyMap.get("ord-002")).toBe(2);
    expect(dailyMap.get("ord-003")).toBe(3);
    expect(dailyMap.get("ord-004")).toBe(4);

    // Cancel order 4
    const cancelledOrders = sampleOrders.map((o) => (o.id === "ord-004" ? { ...o, status: "cancelled" as const } : o));
    const recomputedMap = computeDailyOrderNumbers(cancelledOrders);

    expect(recomputedMap.get("ord-001")).toBe(1);
    expect(recomputedMap.get("ord-002")).toBe(2);
    expect(recomputedMap.get("ord-003")).toBe(3);
    expect(recomputedMap.get("ord-004")).toBe(4); // Remains stable
  });

  it("Scenario 3: Realtime updates generate zero order number drift across all modules", () => {
    const dailyMap = computeDailyOrderNumbers(sampleOrders);

    // CSV Exporter check
    const csv = generateOrdersCSV(sampleOrders, new Map([["tbl-1", "1"]]), dailyMap);
    expect(csv).toContain('"Order #1"');
    expect(csv).toContain('"Order #2"');
    expect(csv).toContain('"Order #3"');

    // Label formatting check
    expect(formatOrderLabelUnified(sampleOrders[0], dailyMap)).toBe("#1");
    expect(formatOrderLabelUnified(sampleOrders[1], dailyMap)).toBe("#2");
  });

  it("Scenario 4: Incoming, Preparing, and Ready lanes sort Oldest First (FIFO queue)", () => {
    const incomingSorted = sortOrdersByLane(sampleOrders, "incoming");
    expect(incomingSorted[0].id).toBe("ord-001"); // 10:00
    expect(incomingSorted[1].id).toBe("ord-002"); // 10:05
    expect(incomingSorted[2].id).toBe("ord-003"); // 10:10

    const preparingSorted = sortOrdersByLane(sampleOrders, "preparing");
    expect(preparingSorted[0].id).toBe("ord-001");

    const readySorted = sortOrdersByLane(sampleOrders, "ready");
    expect(readySorted[0].id).toBe("ord-001");
  });

  it("Scenario 5: Completed and History lanes sort Newest First (Sales ledger view)", () => {
    const historySorted = sortOrdersByLane(sampleOrders, "history");
    expect(historySorted[0].id).toBe("ord-004"); // 10:15
    expect(historySorted[1].id).toBe("ord-003"); // 10:10
    expect(historySorted[2].id).toBe("ord-002"); // 10:05
    expect(historySorted[3].id).toBe("ord-001"); // 10:00
  });
});
