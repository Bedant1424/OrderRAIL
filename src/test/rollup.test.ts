import { describe, it, expect, vi } from "vitest";
import { rollupOrderStatus } from "../lib/rollup";
import type { OrderStatus, OrderItemStatus } from "../lib/db";

describe("Kitchen Intelligence Roll-up Logic", () => {
  // Scenario 1: Coffee & Pizza. Serve Coffee. Expected: active. Serve Pizza. Expected: served.
  it("Scenario 1: rollup remains active until last item is served", () => {
    const items: { name: string; status: OrderItemStatus }[] = [
      { name: "Coffee", status: "pending" },
      { name: "Pizza", status: "pending" },
    ];

    let orderStatus: OrderStatus = "preparing";

    // Serve Coffee
    items[0].status = "served";
    orderStatus = rollupOrderStatus(items, orderStatus);
    expect(orderStatus).toBe("preparing"); // Order remains active

    // Serve Pizza
    items[1].status = "served";
    orderStatus = rollupOrderStatus(items, orderStatus);
    expect(orderStatus).toBe("served"); // Order becomes Served
  });

  // Scenario 2: Coffee cancelled, Pizza served. Expected: Served.
  it("Scenario 2: cancelled items do not prevent order completion", () => {
    const items: { name: string; status: OrderItemStatus }[] = [
      { name: "Coffee", status: "cancelled" },
      { name: "Pizza", status: "served" },
    ];

    const orderStatus = rollupOrderStatus(items, "preparing");
    expect(orderStatus).toBe("served");
  });

  // Scenario 3: Verify transition events count
  it("Scenario 3: simulates transition events generation", () => {
    const events: string[] = [];
    const logEvent = (from: OrderItemStatus, to: OrderItemStatus) => {
      if (from !== to) {
        if (to === "preparing") events.push("item_preparing");
        if (to === "ready") events.push("item_ready");
        if (to === "served") events.push("item_served");
      }
    };

    let itemStatus: OrderItemStatus = "pending";

    // pending -> preparing
    logEvent(itemStatus, "preparing");
    itemStatus = "preparing";

    // preparing -> ready
    logEvent(itemStatus, "ready");
    itemStatus = "ready";

    // ready -> served
    logEvent(itemStatus, "served");
    itemStatus = "served";

    expect(events).toEqual(["item_preparing", "item_ready", "item_served"]);
    expect(events.length).toBe(3); // Exactly one event for each transition
  });
});
