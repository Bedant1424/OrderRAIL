import { describe, it, expect, beforeEach } from "vitest";
import { BillingService, billsMap } from "@/lib/billing/billingService";
import { PaymentService, settlementsMap } from "@/lib/payments/paymentService";
import { BillSummaryCalculator } from "@/lib/billing/billSummaryCalculator";
import { printService } from "@/lib/printing/PrintService";
import { MockProvider } from "@/lib/printing/providers/MockProvider";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";

describe("Sprint 14C — Counter Payment Scope & ReferenceError Resolution Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    billsMap.clear();
    settlementsMap.clear();
    printService.setProvider(new MockProvider({ simulatedDelayMs: 0 }));
    PrinterAdapter.setSimulatedState(null);
  });

  const mockCafe = {
    id: "cafe-cheese-corner-101",
    name: "Cheese Corner",
    address: "Shop 4, Food Street, City Center",
    phone: "+91 98765 43210",
  };

  const paymentMethods: ("cash" | "upi" | "card")[] = ["cash", "upi", "card"];

  for (const method of paymentMethods) {
    it(`1. Executes complete payment flow for ${method.toUpperCase()} with cafe scope metadata`, async () => {
      const orderId = `ord-${method}-${Date.now()}`;
      const billId = `bill-${orderId}`;

      const orders = [
        {
          id: orderId,
          orderNumber: 101,
          items: [
            { id: "i-1", name: "Cheese Garlic Bread", price: 160, qty: 1 },
            { id: "i-2", name: "Cold Coffee", price: 66.75, qty: 1 },
          ],
        },
      ];

      const draftCart: any[] = [];
      const summary = BillSummaryCalculator.buildBillSummary({
        orders,
        draftCart,
        discount: { percent: 0, amount: 0, reason: "" },
      });

      expect(summary.grandTotal).toBeCloseTo(244.89, 1);

      const allItems = [
        ...orders.flatMap((o) => o.items || []),
        ...draftCart,
      ];

      // Step 1: BillingService.createBill with cafe scope metadata
      const billRes = await BillingService.createBill({
        billId,
        orderId,
        orderNumber: orders[0]?.orderNumber,
        diningSessionId: "session-table-1",
        tableId: "table-uuid-1",
        tableLabel: "Table 1",
        orderSource: "DINE_IN",
        externalOrderRef: null,
        items: allItems.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        discountPct: summary.discountPercent,
        customerName: "Rahul Sharma",
        customerPhone: "9876543210",
        cafeName: mockCafe.name,
        address: mockCafe.address,
        phone: mockCafe.phone,
        cafeId: mockCafe.id,
      });

      expect(billRes.bill).toBeDefined();
      expect(billRes.bill.cafeName).toBe("Cheese Corner");
      expect(billRes.bill.address).toBe("Shop 4, Food Street, City Center");
      expect(billRes.bill.phone).toBe("+91 98765 43210");
      expect(billRes.bill.cafeId).toBe("cafe-cheese-corner-101");
      expect(billRes.bill.status).toBe("Finalized");

      // Step 2: PaymentService.recordPayment
      const payRes = await PaymentService.recordPayment({
        billId: billRes.bill.billId,
        orderId,
        diningSessionId: "session-table-1",
        tableId: "table-uuid-1",
        tableLabel: "Table 1",
        paymentMethod: method,
        amount: summary.grandTotal,
        operatorId: "Counter Staff",
      });

      expect(payRes.settlement).toBeDefined();
      expect(payRes.settlement.status).toBe("settled");
      expect(payRes.settlement.paymentMethod).toBe(method);

      // Verify Bill state is updated to Paid
      const savedBill = BillingService.getBill(billId);
      expect(savedBill?.paymentStatus).toBe("paid");
      expect(savedBill?.status).toBe("Paid");
    });
  }

  it("2. Prevents duplicate payment execution on already paid bill", async () => {
    const orderId = `ord-dup-${Date.now()}`;
    const billId = `bill-${orderId}`;

    const billRes = await BillingService.createBill({
      billId,
      orderId,
      orderNumber: 202,
      tableLabel: "Table 2",
      items: [{ id: "i-1", name: "Paneer Pizza", price: 250, qty: 1 }],
      cafeName: mockCafe.name,
      cafeId: mockCafe.id,
    });

    // First payment
    const p1 = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId,
      tableLabel: "Table 2",
      paymentMethod: "upi",
      amount: 262.5,
    });
    expect(p1.settlement.status).toBe("settled");

    // Second payment attempt must be rejected
    await expect(
      PaymentService.recordPayment({
        billId: billRes.bill.billId,
        orderId,
        tableLabel: "Table 2",
        paymentMethod: "upi",
        amount: 262.5,
      })
    ).rejects.toThrow(/already paid and locked/);
  });
});
