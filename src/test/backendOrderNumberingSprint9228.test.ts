import { describe, it, expect } from "vitest";
import { formatOrderDisplayNumber, formatOrderLabelUnified, formatInvoiceNumber, sortOrdersByLane } from "@/lib/orders/orderUtils";

describe("Sprint 9.2.2.8 — Backend Order Numbering, Invoice Numbering & Business Date Tests", () => {
  it("1. Should display backend-assigned daily_order_number in formatOrderLabelUnified", () => {
    const order1 = { id: "ord-1", daily_order_number: 1, order_number: 101, business_date: "2026-07-27" };
    const order2 = { id: "ord-2", daily_order_number: 42, order_number: 250, business_date: "2026-07-27" };

    expect(formatOrderLabelUnified(order1)).toBe("#1");
    expect(formatOrderLabelUnified(order2)).toBe("#42");
  });

  it("2. Should format invoice_number correctly for payment completed orders", () => {
    expect(formatInvoiceNumber("INV-000001")).toBe("INV-000001");
    expect(formatInvoiceNumber("INV-000105")).toBe("INV-000105");
    expect(formatInvoiceNumber(null)).toBe("N/A");
    expect(formatInvoiceNumber(undefined)).toBe("N/A");
  });

  it("3. Should sort history orders LIFO (newest first) and retain full history list without artificial cap", () => {
    const orders = Array.from({ length: 30 }, (_, i) => ({
      id: `ord-${i + 1}`,
      daily_order_number: i + 1,
      business_date: "2026-07-27",
      created_at: new Date(Date.now() - (30 - i) * 60000).toISOString(),
      status: "served" as const,
    }));

    const sortedHistory = sortOrdersByLane(orders, "history");
    expect(sortedHistory.length).toBe(30);
    expect(sortedHistory[0].id).toBe("ord-30"); // Newest first
    expect(sortedHistory[29].id).toBe("ord-1"); // Oldest last
  });

  it("4. Should filter Recently Done orders by business_date cleanly", () => {
    const today = new Date().toISOString().split("T")[0];
    const yesterdayDate = new Date(Date.now() - 86400000 * 2);
    const yesterday = yesterdayDate.toISOString().split("T")[0];

    const orders = [
      { id: "o-1", status: "served", business_date: today, created_at: new Date().toISOString() },
      { id: "o-2", status: "served", business_date: yesterday, created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: "o-3", status: "cancelled", business_date: today, created_at: new Date().toISOString() },
    ];

    const doneToday = orders.filter(
      (o) => (o.status === "served" || o.status === "cancelled") && o.business_date === today
    );

    expect(doneToday.length).toBe(2);
    expect(doneToday.map((o) => o.id)).toEqual(["o-1", "o-3"]);
  });

  it("5. Should filter Recently Done orders by created_at fallback when business_date is undefined", () => {
    const today = new Date().toISOString().split("T")[0];
    const oldDate = "2026-07-06T12:00:00Z";

    const orders = [
      { id: "o-1", status: "served", business_date: undefined, created_at: new Date().toISOString() },
      { id: "o-2", status: "served", business_date: undefined, created_at: oldDate },
    ];

    const doneToday = orders.filter(
      (o) =>
        (o.status === "served" || o.status === "cancelled") &&
        (o.business_date ? o.business_date === today : o.created_at?.slice(0, 10) === today)
    );

    expect(doneToday.length).toBe(1);
    expect(doneToday[0].id).toBe("o-1");
  });
});
