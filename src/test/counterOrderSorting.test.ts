import { describe, it, expect } from "vitest";
import { sortCounterOrders } from "@/lib/orders/sortCounterOrders";

describe("Counter Order Sorting Utility", () => {
  it("sorts orders by createdAt timestamp in descending order (newest first)", () => {
    const orders = [
      { id: "1", orderNumber: 101, createdAt: "2026-07-24T10:00:00.000Z" },
      { id: "3", orderNumber: 103, createdAt: "2026-07-24T12:00:00.000Z" },
      { id: "2", orderNumber: 102, createdAt: "2026-07-24T11:00:00.000Z" },
    ];

    const sorted = sortCounterOrders(orders);

    expect(sorted.map((o) => o.id)).toEqual(["3", "2", "1"]);
  });

  it("does not mutate the original orders array", () => {
    const orders = [
      { id: "1", createdAt: "2026-07-24T10:00:00.000Z" },
      { id: "2", createdAt: "2026-07-24T12:00:00.000Z" },
    ];

    const sorted = sortCounterOrders(orders);

    expect(orders[0].id).toBe("1");
    expect(sorted[0].id).toBe("2");
  });

  it("falls back to orderNumber descending when timestamps are equal or missing", () => {
    const orders = [
      { id: "a", orderNumber: 101 },
      { id: "c", orderNumber: 105 },
      { id: "b", orderNumber: 103 },
    ];

    const sorted = sortCounterOrders(orders);

    expect(sorted.map((o) => o.orderNumber)).toEqual([105, 103, 101]);
  });

  it("falls back to ID descending when timestamps and orderNumbers are equal", () => {
    const orders = [
      { id: "order-100", orderNumber: 100 },
      { id: "order-300", orderNumber: 100 },
      { id: "order-200", orderNumber: 100 },
    ];

    const sorted = sortCounterOrders(orders);

    expect(sorted.map((o) => o.id)).toEqual(["order-300", "order-200", "order-100"]);
  });
});
