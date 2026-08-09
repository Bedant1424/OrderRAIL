import { describe, it, expect } from "vitest";
import { renderKotText } from "@/lib/printing/kotRenderer";
import { renderReceiptText } from "@/lib/printing/receiptRenderer";
import { BillingService } from "@/lib/billing/billingService";
import { OrderService } from "@/lib/orders/orderService";

describe("Sprint 9.2.5.0 — Unified Order Source Modes Unit & Integration Tests", () => {
  it("1. DINE_IN Mode: Generates standard Dine-In KOT and Customer Receipt headers", () => {
    const kotPayload = {
      orderId: "ord-dine-1",
      orderNumber: 101,
      kotNumber: 1,
      tableLabel: "4",
      timestamp: "12:00 PM",
      orderSource: "DINE_IN" as const,
      items: [{ name: "Cappuccino", price: 180, qty: 1 }],
    };

    const kotText = renderKotText(kotPayload, 80);
    expect(kotText).toContain("TABLE 4");

    const receiptPayload = {
      billNumber: "B-101",
      orderId: "ord-dine-1",
      tableLabel: "4",
      timestamp: "12:05 PM",
      subtotal: 180,
      tax: 9,
      netTotal: 189,
      orderSource: "DINE_IN" as const,
      items: [{ name: "Cappuccino", price: 180, qty: 1 }],
    };

    const receiptText = renderReceiptText(receiptPayload, 80);
    expect(receiptText).toContain("Ref: Table 4");
  });

  it("2. TAKEAWAY Mode: Generates bold TAKEAWAY KOT header and TAKEAWAY RECEIPT label", () => {
    const kotPayload = {
      orderId: "ord-takeaway-1",
      orderNumber: 102,
      kotNumber: 2,
      tableLabel: "Takeaway",
      timestamp: "12:10 PM",
      orderSource: "TAKEAWAY" as const,
      items: [{ name: "Artisan Burger", price: 350, qty: 2 }],
    };

    const kotText = renderKotText(kotPayload, 80);
    expect(kotText).toContain("TAKEAWAY");

    const receiptPayload = {
      billNumber: "B-102",
      orderId: "ord-takeaway-1",
      tableLabel: "Takeaway",
      timestamp: "12:15 PM",
      subtotal: 700,
      tax: 35,
      netTotal: 735,
      orderSource: "TAKEAWAY" as const,
      items: [{ name: "Artisan Burger", price: 350, qty: 2 }],
    };

    const receiptText = renderReceiptText(receiptPayload, 80);
    expect(receiptText).toContain("Ref: Takeaway");
  });

  it("3. SWIGGY Mode: Generates SWIGGY KOT with External Order ID (#1492)", () => {
    const kotPayload = {
      orderId: "ord-swiggy-1",
      orderNumber: 103,
      kotNumber: 3,
      tableLabel: "Swiggy #1492",
      timestamp: "12:20 PM",
      orderSource: "SWIGGY" as const,
      externalOrderRef: "1492",
      items: [{ name: "Cold Brew Coffee", price: 220, qty: 1 }],
    };

    const kotText = renderKotText(kotPayload, 80);
    expect(kotText).toContain("SWIGGY #1492");

    const receiptPayload = {
      billNumber: "B-103",
      orderId: "ord-swiggy-1",
      tableLabel: "Swiggy #1492",
      timestamp: "12:25 PM",
      subtotal: 220,
      tax: 11,
      netTotal: 231,
      orderSource: "SWIGGY" as const,
      externalOrderRef: "1492",
      items: [{ name: "Cold Brew Coffee", price: 220, qty: 1 }],
    };

    const receiptText = renderReceiptText(receiptPayload, 80);
    expect(receiptText).toContain("Ref: Swiggy #1492");
  });

  it("4. ZOMATO Mode: Generates ZOMATO KOT with External Order ID (#8821)", () => {
    const kotPayload = {
      orderId: "ord-zomato-1",
      orderNumber: 104,
      kotNumber: 4,
      tableLabel: "Zomato #8821",
      timestamp: "12:30 PM",
      orderSource: "ZOMATO" as const,
      externalOrderRef: "8821",
      items: [{ name: "Matcha Latte", price: 260, qty: 2 }],
    };

    const kotText = renderKotText(kotPayload, 80);
    expect(kotText).toContain("ZOMATO #8821");

    const receiptPayload = {
      billNumber: "B-104",
      orderId: "ord-zomato-1",
      tableLabel: "Zomato #8821",
      timestamp: "12:35 PM",
      subtotal: 520,
      tax: 26,
      netTotal: 546,
      orderSource: "ZOMATO" as const,
      externalOrderRef: "8821",
      items: [{ name: "Matcha Latte", price: 260, qty: 2 }],
    };

    const receiptText = renderReceiptText(receiptPayload, 80);
    expect(receiptText).toContain("Ref: Zomato #8821");
  });

  it("5. Backward Compatibility: Defaults to DINE_IN if orderSource is omitted", () => {
    const legacyKot = renderKotText({
      orderId: "ord-legacy-1",
      orderNumber: 99,
      kotNumber: 99,
      tableLabel: "2",
      timestamp: "11:00 AM",
      items: [{ name: "Tea", price: 50, qty: 1 }],
    }, 80);

    expect(legacyKot).toContain("TABLE 2");
  });

  it("6. BillingService Integration: Preserves orderSource and externalOrderRef on generated bills", async () => {
    const billRes = await BillingService.createBill({
      orderId: "ord-swiggy-billing-1",
      orderNumber: 105,
      tableLabel: "Swiggy #999",
      items: [{ name: "Pizza", price: 400, qty: 1 }],
      orderSource: "SWIGGY",
      externalOrderRef: "999",
    });

    expect(billRes.bill).toBeDefined();
    expect(billRes.bill.orderSource).toBe("SWIGGY");
    expect(billRes.bill.externalOrderRef).toBe("999");
  });
});
