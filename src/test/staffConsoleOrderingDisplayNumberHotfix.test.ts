import { describe, it, expect } from "vitest";
import { computeDailyOrderNumbers, sortOrdersByLane } from "@/lib/orders/orderUtils";
import { formatOrderLabel, type Order, type OrderItem } from "@/lib/db";

describe("Hotfix — Staff Console Ordering & Display Number Audit", () => {
  const productionReproOrders: (Order & { order_items: OrderItem[] })[] = [
    {
      id: "ord-269",
      cafe_id: "cafe-1",
      table_id: "tbl-1",
      session_id: "sess-1",
      order_number: 269,
      total_cents: 1200,
      status: "served",
      created_at: "2026-07-26T14:07:00.000Z", // 2:07 PM
      updated_at: "2026-07-26T14:07:15.000Z",
      notes: null,
      order_items: []
    },
    {
      id: "ord-267",
      cafe_id: "cafe-1",
      table_id: "tbl-2",
      session_id: "sess-2",
      order_number: 267,
      total_cents: 1800,
      status: "served",
      created_at: "2026-07-26T14:06:00.000Z", // 2:06 PM
      updated_at: "2026-07-26T14:06:30.000Z",
      notes: null,
      order_items: []
    },
    {
      id: "ord-245",
      cafe_id: "cafe-1",
      table_id: "tbl-3",
      session_id: "sess-3",
      order_number: 245,
      total_cents: 2500,
      status: "served",
      created_at: "2026-07-26T12:05:00.000Z", // 12:05 PM
      updated_at: "2026-07-26T14:06:45.000Z", // Touch/Edit at 2:06:45 PM
      notes: "Extra napkins",
      order_items: []
    },
    {
      id: "ord-266",
      cafe_id: "cafe-1",
      table_id: "tbl-4",
      session_id: "sess-4",
      order_number: 266,
      total_cents: 1400,
      status: "served",
      created_at: "2026-07-26T14:06:00.000Z", // 2:06 PM
      updated_at: "2026-07-26T14:06:10.000Z",
      notes: null,
      order_items: []
    }
  ];

  it("Reproduction Verification 1: Historical 'Recently Done' lane sorts strictly Newest First using created_at", () => {
    const sortedDone = sortOrdersByLane(productionReproOrders, "history");

    // Order 269 (2:07 PM) must come first
    expect(sortedDone[0].id).toBe("ord-269");

    // Orders 267 & 266 (2:06 PM) must come second and third
    expect(sortedDone[1].created_at).toBe("2026-07-26T14:06:00.000Z");
    expect(sortedDone[2].created_at).toBe("2026-07-26T14:06:00.000Z");

    // Order 245 (12:05 PM) MUST come LAST in history, NEVER between 2 PM orders!
    expect(sortedDone[3].id).toBe("ord-245");
  });

  it("Reproduction Verification 2: Staff Console maps raw DB order numbers to unified daily display numbers #1..#4", () => {
    const dailyMap = computeDailyOrderNumbers(productionReproOrders);

    // 12:05 PM order is #1 for today
    expect(dailyMap.get("ord-245")).toBe(1);
    expect(formatOrderLabel(dailyMap.get("ord-245")!)).toBe("Order #1");

    // 2:06 PM orders are #2 and #3
    expect(dailyMap.get("ord-266")).toBe(2);
    expect(dailyMap.get("ord-267")).toBe(3);

    // 2:07 PM order is #4
    expect(dailyMap.get("ord-269")).toBe(4);
  });

  it("Reproduction Verification 3: Active kitchen lanes (Incoming, Preparing, Ready) sort Oldest First (FIFO)", () => {
    const activeOrders = [
      { id: "o2", created_at: "2026-07-26T12:05:00.000Z" },
      { id: "o1", created_at: "2026-07-26T12:00:00.000Z" }
    ];

    const sortedActive = sortOrdersByLane(activeOrders, "incoming");
    expect(sortedActive[0].id).toBe("o1"); // 12:00 PM comes before 12:05 PM
    expect(sortedActive[1].id).toBe("o2");
  });
});
