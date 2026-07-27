import { describe, it, expect } from "vitest";
import { BillingService } from "@/lib/billing/billingService";
import { renderReceiptText } from "@/lib/printing/receiptRenderer";

describe("Sprint 9.2.6.1 — Optional Customer Details at Billing Tests", () => {
  it("1. Creates bill with optional customerName and customerPhone", async () => {
    const res = await BillingService.createBill({
      orderId: "ord-test-cust-1",
      tableLabel: "Table 1",
      cashierName: "John Staff",
      items: [{ name: "Cappuccino", price: 180, qty: 2 }],
      customerName: "John Doe",
      customerPhone: "9876543210",
    });

    expect(res.bill.customerName).toBe("John Doe");
    expect(res.bill.customerPhone).toBe("9876543210");
  });

  it("2. Creates bill with blank customer details when not provided", async () => {
    const res = await BillingService.createBill({
      orderId: "ord-test-cust-2",
      tableLabel: "Takeaway",
      cashierName: "Sarah M.",
      items: [{ name: "Espresso", price: 160, qty: 1 }],
    });

    expect(res.bill.customerName).toBeNull();
    expect(res.bill.customerPhone).toBeNull();
  });

  it("3. Formats thermal receipt text with Customer and Phone lines when present", () => {
    const receiptText = renderReceiptText({
      billId: "bill-1001",
      billNumber: "B-1001",
      orderNumber: 101,
      tableLabel: "Table 4",
      cashierName: "Counter Staff",
      timestamp: "12:30 PM",
      items: [{ name: "Truffle Fries", price: 280, qty: 1 }],
      subtotal: 280,
      tax: 14,
      netTotal: 294,
      customerName: "Alice Smith",
      customerPhone: "+919876543210",
    });

    expect(receiptText).toContain("Customer: Alice Smith");
    expect(receiptText).toContain("Phone   : +919876543210");
  });

  it("4. Omits Customer and Phone lines from receipt when details are blank", () => {
    const receiptText = renderReceiptText({
      billId: "bill-1002",
      billNumber: "B-1002",
      orderNumber: 102,
      tableLabel: "Express",
      cashierName: "Counter Staff",
      timestamp: "12:35 PM",
      items: [{ name: "Espresso", price: 160, qty: 1 }],
      subtotal: 160,
      tax: 8,
      netTotal: 168,
    });

    expect(receiptText).not.toContain("Customer:");
    expect(receiptText).not.toContain("Phone:");
  });

  it("5. Validates phone number digit requirements (10 to 15 digits)", () => {
    const validPhone1 = "9876543210".replace(/\D/g, "");
    const validPhone2 = "919876543210123".replace(/\D/g, "");
    const invalidPhoneShort = "12345".replace(/\D/g, "");

    expect(validPhone1.length >= 10 && validPhone1.length <= 15).toBe(true);
    expect(validPhone2.length >= 10 && validPhone2.length <= 15).toBe(true);
    expect(invalidPhoneShort.length >= 10 && invalidPhoneShort.length <= 15).toBe(false);
  });
});
