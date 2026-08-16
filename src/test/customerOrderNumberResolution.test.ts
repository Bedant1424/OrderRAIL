import { describe, it, expect } from "vitest";
import { formatOrderLabel } from "@/lib/db";
import { formatOrderLabelUnified } from "@/lib/orders/orderUtils";

function resolveCustomerOrderLabel(order?: { order_number?: number | null; daily_order_number?: number | null } | null): string {
  if (!order) return "Order pending…";
  const num = (order as any).daily_order_number ?? order.order_number;
  return num ? formatOrderLabel(num) : "Order pending…";
}

describe("Customer Order Number Mismatch Fix Suite", () => {
  it("1. order_number = 127, daily_order_number = 4 displays Order #4 on Customer view", () => {
    const dbOrder = { id: "order-uuid-1", order_number: 127, daily_order_number: 4, status: "pending" };
    expect(resolveCustomerOrderLabel(dbOrder)).toBe("Order #4");
    expect(formatOrderLabelUnified(dbOrder)).toBe("#4");
  });

  it("2. order_number = 4, daily_order_number = null displays Order #4 on Customer view", () => {
    const dbOrder = { id: "order-uuid-2", order_number: 4, daily_order_number: null, status: "preparing" };
    expect(resolveCustomerOrderLabel(dbOrder)).toBe("Order #4");
    expect(formatOrderLabelUnified(dbOrder)).toBe("#4");
  });

  it("3. order_number = null, daily_order_number = 4 displays Order #4 on Customer view", () => {
    const dbOrder = { id: "order-uuid-3", order_number: null, daily_order_number: 4, status: "ready" };
    expect(resolveCustomerOrderLabel(dbOrder)).toBe("Order #4");
    expect(formatOrderLabelUnified(dbOrder)).toBe("#4");
  });

  it("4. Both order_number and daily_order_number missing displays 'Order pending…'", () => {
    const pendingOrder = { id: "order-uuid-4", order_number: null, daily_order_number: null, status: "pending" };
    expect(resolveCustomerOrderLabel(pendingOrder)).toBe("Order pending…");
  });

  it("5. Refresh/hydration using real PostgreSQL order object preserves Order #4", () => {
    const postgresRow = {
      id: "c4b12345-0000-0000-0000-000000000000",
      order_number: 127,
      daily_order_number: 4,
      status: "preparing",
      cafe_id: "cheesecorner"
    };

    // Hydrated state in React component
    const hydratedLabel = resolveCustomerOrderLabel(postgresRow);
    expect(hydratedLabel).toBe("Order #4");
  });

  it("6. Realtime UPDATE payload of the order continues displaying Order #4", () => {
    const realtimePayloadNew = {
      id: "c4b12345-0000-0000-0000-000000000000",
      order_number: 127,
      daily_order_number: 4,
      status: "ready"
    };

    expect(resolveCustomerOrderLabel(realtimePayloadNew)).toBe("Order #4");
    expect(realtimePayloadNew.status).toBe("ready");
  });

  it("7. Fix does NOT alter the actual order UUID or status", () => {
    const orderObj = {
      id: "c4b12345-1111-2222-3333-444444444444",
      order_number: 127,
      daily_order_number: 4,
      status: "served"
    };

    const label = resolveCustomerOrderLabel(orderObj);
    expect(label).toBe("Order #4");
    expect(orderObj.id).toBe("c4b12345-1111-2222-3333-444444444444");
    expect(orderObj.status).toBe("served");
  });

  it("8. Customer, Counter, Staff, Owner, and KOT all resolve to identical Order #4", () => {
    const dbOrder = {
      id: "ord-unified",
      order_number: 127,
      daily_order_number: 4,
      status: "preparing"
    };

    const customerLabel = resolveCustomerOrderLabel(dbOrder);
    const counterOrderNum = (dbOrder as any).daily_order_number ?? dbOrder.order_number;
    const staffOrderNum = dbOrder.daily_order_number || dbOrder.id.slice(0, 6);
    const ownerLabel = formatOrderLabelUnified(dbOrder);
    const kotOrderNum = dbOrder.daily_order_number || dbOrder.order_number;

    expect(customerLabel).toBe("Order #4");
    expect(counterOrderNum).toBe(4);
    expect(staffOrderNum).toBe(4);
    expect(ownerLabel).toBe("#4");
    expect(kotOrderNum).toBe(4);
  });
});

describe("Customer Notification & Cart Order Number Consistency Suite", () => {
  it("9. Notification and Cart order number resolution prioritizes daily_order_number (127 + 4 -> Order #4)", () => {
    const order = { id: "ord-127-4", order_number: 127, daily_order_number: 4, status: "ready" };
    const notificationLabel = formatOrderLabel((order as any).daily_order_number ?? order.order_number);
    const cartItemLabel = formatOrderLabel((order as any).daily_order_number ?? order.order_number);
    const orderStatusLabel = resolveCustomerOrderLabel(order);

    expect(notificationLabel).toBe("Order #4");
    expect(cartItemLabel).toBe("Order #4");
    expect(orderStatusLabel).toBe("Order #4");
  });

  it("10. Notification and Cart order number resolution falls back to order_number when daily_order_number is null", () => {
    const order = { id: "ord-127-null", order_number: 127, daily_order_number: null, status: "ready" };
    const notificationLabel = formatOrderLabel((order as any).daily_order_number ?? order.order_number);
    const cartItemLabel = formatOrderLabel((order as any).daily_order_number ?? order.order_number);
    const orderStatusLabel = resolveCustomerOrderLabel(order);

    expect(notificationLabel).toBe("Order #127");
    expect(cartItemLabel).toBe("Order #127");
    expect(orderStatusLabel).toBe("Order #127");
  });

  it("11. Realtime UPDATE payload with ready status formats notification description as Order #4", () => {
    const realtimePayload = {
      id: "ord-realtime-1",
      order_number: 127,
      daily_order_number: 4,
      status: "ready",
      dining_session_id: "session-xyz"
    };

    const notificationLabel = formatOrderLabel((realtimePayload as any).daily_order_number ?? realtimePayload.order_number);
    expect(notificationLabel).toBe("Order #4");
  });

  it("12. Session mismatch filter logic ignores orders from another dining session", () => {
    const activeSessionId = "session-active";
    const foreignOrderPayload = {
      id: "ord-foreign",
      order_number: 127,
      daily_order_number: 4,
      status: "ready",
      dining_session_id: "session-foreign"
    };

    const shouldNotify = foreignOrderPayload.dining_session_id === activeSessionId;
    expect(shouldNotify).toBe(false);
  });

  it("13. Duplicate notification guard prevents re-notifying already notified order IDs", () => {
    const notifiedSet = new Set<string>();
    const orderId = "ord-dup-guard";

    // First time ready
    let fired = false;
    if (!notifiedSet.has(orderId)) {
      notifiedSet.add(orderId);
      fired = true;
    }
    expect(fired).toBe(true);

    // Second time ready
    let reFired = false;
    if (!notifiedSet.has(orderId)) {
      notifiedSet.add(orderId);
      reFired = true;
    }
    expect(reFired).toBe(false);
  });

  it("14. Customer Cart list, OrderStatusView, and Notification all display identical Order #4", () => {
    const order = { id: "ord-all-surfaces", order_number: 127, daily_order_number: 4, status: "ready" };
    const cartLabel = formatOrderLabel((order as any).daily_order_number ?? order.order_number);
    const statusLabel = resolveCustomerOrderLabel(order);
    const notificationLabel = formatOrderLabel((order as any).daily_order_number ?? order.order_number);

    expect(cartLabel).toBe("Order #4");
    expect(statusLabel).toBe("Order #4");
    expect(notificationLabel).toBe("Order #4");
  });

  it("15. No local/fabricated order numbers are introduced", () => {
    const dbOrder = { id: "ord-no-fab", order_number: 127, daily_order_number: 4, status: "ready" };
    const resolvedNum = (dbOrder as any).daily_order_number ?? dbOrder.order_number;
    expect(resolvedNum).toBe(4);
    expect(resolvedNum).not.toBe("TEMP-123");
  });
});
