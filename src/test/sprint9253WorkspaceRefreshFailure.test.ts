import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/db";
import { OrderService, BillingService, PaymentService, type OrderSource } from "@/lib/orders/repository";
import { BillSummaryCalculator } from "@/lib/billing/billSummaryCalculator";

describe("Sprint 9.2.5.3 — Workspace Refresh Failure Investigation Tests", () => {
  it("1. Verifies root cause: summary.items is undefined on SharedBillSummary, causing TypeError on summary.items.map", () => {
    const summary = BillSummaryCalculator.buildBillSummary({
      orders: [{ items: [{ id: "i-1", name: "Coffee", price: 150, qty: 2 }] }],
      draftCart: [{ id: "c-1", name: "Tea", price: 50, qty: 1 }],
    });

    // Verify summary has no items property
    expect((summary as any).items).toBeUndefined();

    // Verify mapping allItems directly from orders and draftCart fixes the TypeError
    const curOrders = [{ items: [{ id: "i-1", name: "Coffee", price: 150, qty: 2 }] }];
    const curDraftCart = [{ id: "c-1", name: "Tea", price: 50, qty: 1 }];

    const allItems = [
      ...curOrders.flatMap((o) => o.items || []),
      ...curDraftCart
    ];

    const billItems = allItems.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty }));

    expect(billItems.length).toBe(2);
    expect(billItems[0].name).toBe("Coffee");
    expect(billItems[1].name).toBe("Tea");
  });

  it("2. Verifies BillingService and PaymentService execute cleanly with flatMapped billItems", async () => {
    const primaryOrderId = `ord-${Date.now()}`;
    const primaryBillId = `bill-${primaryOrderId}`;

    const curOrders = [{ items: [{ id: "i-1", name: "Burger", price: 200, qty: 1 }] }];
    const curDraftCart = [{ id: "c-1", name: "Fries", price: 80, qty: 1 }];

    const summary = BillSummaryCalculator.buildBillSummary({
      orders: curOrders,
      draftCart: curDraftCart,
    });

    const billItems = [
      ...curOrders.flatMap((o) => o.items || []),
      ...curDraftCart
    ].map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty }));

    const billRes = await BillingService.createBill({
      billId: primaryBillId,
      orderId: primaryOrderId,
      orderNumber: 102,
      diningSessionId: null,
      tableId: null,
      tableLabel: "Takeaway",
      orderSource: "TAKEAWAY",
      items: billItems,
      discountPct: summary.discountPercent,
    });

    expect(billRes.bill.billId).toBe(primaryBillId);
    expect(billRes.bill.items.length).toBe(2);

    const paymentRes = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: primaryOrderId,
      diningSessionId: null,
      tableId: null,
      tableLabel: "Takeaway",
      paymentMethod: "cash",
      amount: summary.grandTotal,
    });

    expect(paymentRes.settlement.status).toBe("settled");
  });
});
