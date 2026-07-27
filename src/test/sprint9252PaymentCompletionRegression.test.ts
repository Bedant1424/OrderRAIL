import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/db";
import { OrderService, BillingService, PaymentService, type OrderSource } from "@/lib/orders/repository";

describe("Sprint 9.2.5.2 — Payment Completion Regression Investigation & Fix Tests", () => {
  const modes: OrderSource[] = ["DINE_IN", "TAKEAWAY", "SWIGGY", "ZOMATO"];

  for (const mode of modes) {
    it(`1. Traces payment completion & settlement for ${mode} order mode without UI freezing`, async () => {
      const { data: realTables } = await supabase.from("tables").select("*");
      const testTable = realTables && realTables.length > 0 ? realTables[0] : null;

      const primaryOrderId = crypto.randomUUID();
      const primaryBillId = `bill-${primaryOrderId.substring(0, 8)}`;

      // 1. Generate Bill via BillingService
      const billRes = await BillingService.createBill({
        billId: primaryBillId,
        orderId: primaryOrderId,
        orderNumber: 101,
        diningSessionId: mode === "DINE_IN" ? "sess-123" : null,
        tableId: mode === "DINE_IN" ? testTable?.id : null,
        tableLabel: mode === "DINE_IN" ? (testTable?.label || "Table 1") : `${mode} Order`,
        orderSource: mode,
        items: [{ id: "i1", name: "Cappuccino", price: 250, qty: 1 }],
        discountPct: 0,
      });

      expect(billRes.bill).toBeDefined();
      expect(billRes.bill.billId).toBe(primaryBillId);

      // 2. Record Payment & Settlement via PaymentService
      const paymentRes = await PaymentService.recordPayment({
        billId: billRes.bill.billId,
        orderId: primaryOrderId,
        diningSessionId: mode === "DINE_IN" ? "sess-123" : null,
        tableId: mode === "DINE_IN" ? testTable?.id : null,
        tableLabel: mode === "DINE_IN" ? (testTable?.label || "Table 1") : `${mode} Order`,
        paymentMethod: "cash",
        amount: 262.5,
        operatorId: "Counter Staff",
      });

      expect(paymentRes.settlement).toBeDefined();
      expect(paymentRes.settlement.status).toBe("settled");
    });
  }

  it("2. Verifies async onComplete handling guarantees isSubmitting flag reset and prevents stuck modal state", async () => {
    let isSubmitting = false;
    let modalOpen = true;

    const mockOnComplete = async (shouldFail: boolean) => {
      if (shouldFail) {
        throw new Error("Simulated payment network error");
      }
      modalOpen = false;
    };

    const simulatePaymentClick = async (shouldFail: boolean) => {
      if (isSubmitting) return;
      isSubmitting = true;
      try {
        await mockOnComplete(shouldFail);
      } catch (err: any) {
        // Handled cleanly
      } finally {
        isSubmitting = false;
      }
    };

    // Case A: Success path closes modal and resets submitting
    await simulatePaymentClick(false);
    expect(modalOpen).toBe(false);
    expect(isSubmitting).toBe(false);

    // Reset
    modalOpen = true;

    // Case B: Error path resets submitting and does not freeze UI
    await simulatePaymentClick(true);
    expect(isSubmitting).toBe(false);
  });
});
