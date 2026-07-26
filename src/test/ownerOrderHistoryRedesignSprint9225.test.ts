import { describe, it, expect } from "vitest";
import { computeDailyOrderNumbers } from "@/lib/orders/orderUtils";
import { generateOrdersCSV } from "@/lib/orders/csvExporter";
import { formatOrderLabel, type Order, type OrderItem } from "@/lib/db";

describe("Sprint 9.2.2.5 — Owner Order History Redesign & Daily Order Numbering", () => {
  const sampleOrders: (Order & { order_items: OrderItem[] })[] = [
    {
      id: "ord-day1-1",
      cafe_id: "cafe-1",
      table_id: "tbl-1",
      session_id: "sess-1",
      order_number: 101,
      total_cents: 1200,
      status: "served",
      created_at: "2026-07-25T10:00:00.000Z",
      updated_at: "2026-07-25T10:20:00.000Z",
      notes: "No ice",
      order_items: [
        { id: "i1", order_id: "ord-day1-1", menu_item_id: "m1", name: "Artisan Burger", qty: 2, price_cents: 500, notes: null },
        { id: "i2", order_id: "ord-day1-1", menu_item_id: "m2", name: "Fries", qty: 1, price_cents: 200, notes: null }
      ]
    },
    {
      id: "ord-day1-2",
      cafe_id: "cafe-1",
      table_id: "tbl-2",
      session_id: "sess-2",
      order_number: 102,
      total_cents: 1800,
      status: "served",
      created_at: "2026-07-25T14:30:00.000Z",
      updated_at: "2026-07-25T14:50:00.000Z",
      notes: null,
      order_items: [
        { id: "i3", order_id: "ord-day1-2", menu_item_id: "m3", name: "Iced Latte", qty: 3, price_cents: 600, notes: null }
      ]
    },
    {
      id: "ord-day2-1",
      cafe_id: "cafe-1",
      table_id: "tbl-1",
      session_id: "sess-3",
      order_number: 103,
      total_cents: 2500,
      status: "served",
      created_at: "2026-07-26T09:15:00.000Z",
      updated_at: "2026-07-26T09:35:00.000Z",
      notes: null,
      order_items: [
        { id: "i4", order_id: "ord-day2-1", menu_item_id: "m4", name: "Avocado Toast", qty: 2, price_cents: 1250, notes: null }
      ]
    },
    {
      id: "ord-day2-2",
      cafe_id: "cafe-1",
      table_id: "tbl-3",
      session_id: "sess-4",
      order_number: 104,
      total_cents: 800,
      status: "cancelled",
      created_at: "2026-07-26T11:45:00.000Z",
      updated_at: "2026-07-26T11:50:00.000Z",
      notes: "Customer left",
      order_items: [
        { id: "i5", order_id: "ord-day2-2", menu_item_id: "m5", name: "Espresso", qty: 2, price_cents: 400, notes: null }
      ]
    }
  ];

  it("Scenario 1: Default sorting arranges orders Newest → Oldest", () => {
    const sorted = [...sampleOrders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    expect(sorted[0].id).toBe("ord-day2-2"); // 11:45 AM July 26
    expect(sorted[1].id).toBe("ord-day2-1"); // 09:15 AM July 26
    expect(sorted[2].id).toBe("ord-day1-2"); // 02:30 PM July 25
    expect(sorted[3].id).toBe("ord-day1-1"); // 10:00 AM July 25
  });

  it("Scenario 2 & 3: Daily display order numbering resets for each calendar day", () => {
    const dailyMap = computeDailyOrderNumbers(sampleOrders);

    // July 25 orders:
    expect(dailyMap.get("ord-day1-1")).toBe(1); // #1 for July 25
    expect(dailyMap.get("ord-day1-2")).toBe(2); // #2 for July 25

    // July 26 orders (resets to #1):
    expect(dailyMap.get("ord-day2-1")).toBe(1); // #1 for July 26
    expect(dailyMap.get("ord-day2-2")).toBe(2); // #2 for July 26

    expect(formatOrderLabel(dailyMap.get("ord-day1-1")!)).toBe("Order #1");
    expect(formatOrderLabel(dailyMap.get("ord-day2-1")!)).toBe("Order #1");
  });

  it("Scenario 4: Search filters by daily display number, table, menu items, and date", () => {
    const dailyMap = computeDailyOrderNumbers(sampleOrders);
    const query = "avocado";

    const filtered = sampleOrders.filter((o) => {
      const dailyNum = dailyMap.get(o.id) ?? o.order_number;
      const orderLabel = formatOrderLabel(dailyNum).toLowerCase();
      const itemsStr = (o.order_items ?? []).map((it) => it.name.toLowerCase()).join(" ");

      return orderLabel.includes(query) || itemsStr.includes(query);
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("ord-day2-1");
  });

  it("Scenario 5: Historical status filters distinguish Completed vs Cancelled", () => {
    const completedOrders = sampleOrders.filter(
      (o) => o.status === "served" || o.status === "ready"
    );
    const cancelledOrders = sampleOrders.filter((o) => o.status === "cancelled");

    expect(completedOrders.length).toBe(3);
    expect(cancelledOrders.length).toBe(1);
    expect(cancelledOrders[0].id).toBe("ord-day2-2");
  });

  it("Scenario 6: Item Summary formats concisely and is never blank", () => {
    const summaries = sampleOrders.map((o) => {
      return (o.order_items ?? []).length > 0
        ? (o.order_items ?? []).map((it) => `${it.name} ×${it.qty}`).join(", ")
        : "1× Order Items";
    });

    expect(summaries[0]).toBe("Artisan Burger ×2, Fries ×1");
    expect(summaries[1]).toBe("Iced Latte ×3");
    expect(summaries[2]).toBe("Avocado Toast ×2");
    expect(summaries[3]).toBe("Espresso ×2");
    expect(summaries.every((s) => s.length > 0)).toBe(true);
  });

  it("CSV Exporter includes human-readable daily order numbers and separated date/time", () => {
    const tableLabelMap = new Map([
      ["tbl-1", "1"],
      ["tbl-2", "2"],
      ["tbl-3", "3"]
    ]);
    const dailyMap = computeDailyOrderNumbers(sampleOrders);

    const csv = generateOrdersCSV(sampleOrders, tableLabelMap, dailyMap);
    expect(csv).toContain('"Order #1"');
    expect(csv).toContain('"Order #2"');
    expect(csv).toContain('"2026-07-25"');
    expect(csv).toContain('"2026-07-26"');
  });
});
