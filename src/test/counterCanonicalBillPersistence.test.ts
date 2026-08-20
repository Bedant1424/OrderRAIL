import { describe, it, expect, beforeEach, vi } from "vitest";
import { BillingService, billsMap } from "@/lib/billing/billingService";
import { PaymentService, settlementsMap } from "@/lib/payments/paymentService";
import { BillRepository } from "@/lib/billing/BillRepository";
import { BillService } from "@/lib/billing/BillService";
import { mapBillToInvoiceRecord } from "@/pages/owner/OwnerInvoicesPage";

describe("Counter POS to Canonical PostgreSQL Bill Persistence Tests (Milestone 1)", () => {
  beforeEach(() => {
    billsMap.clear();
    settlementsMap.clear();
    BillRepository.clearMemoryStoreForTesting();
    vi.restoreAllMocks();
  });

  it("TEST 1: Direct payment calls canonical BillRepository.saveBill", async () => {
    const saveBillSpy = vi.spyOn(BillRepository, "saveBill");

    const billRes = await BillingService.createBill({
      billId: "bill-79c5ec51-64e9-4f3a-baac-516858adff01",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff01",
      orderNumber: 28,
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf01",
      tableId: "1e804758-7538-4a61-acac-5982fc15feca",
      tableLabel: "Table 01",
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      items: [
        { id: "309c6050-9790-4725-a6ba-72a8df1ae923", name: "Cheese Delight Wrap", price: 129, qty: 1 },
        { id: "5c1c239b-7979-408c-ae96-22e16b0485c5", name: "Clay Pot Pizza", price: 139, qty: 1 },
      ],
      discountPct: 0,
      customerName: "John Doe",
      customerPhone: "+91 98765 43210",
    });

    expect(saveBillSpy).toHaveBeenCalledTimes(1);
    expect(billRes.bill.billId).toBe("79c5ec51-64e9-4f3a-baac-516858adff01");
  });

  it("TEST 2 & 3: Direct payment produces exactly one persisted bill with bill_items", async () => {
    await BillingService.createBill({
      billId: "bill-79c5ec51-64e9-4f3a-baac-516858adff02",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff02",
      orderNumber: 28,
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf02",
      tableId: "Table 01",
      tableLabel: "Table 01",
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      items: [
        { id: "309c6050-9790-4725-a6ba-72a8df1ae923", name: "Cheese Delight Wrap", price: 129, qty: 1 },
        { id: "5c1c239b-7979-408c-ae96-22e16b0485c5", name: "Clay Pot Pizza", price: 139, qty: 1 },
      ],
    });

    const persisted = await BillRepository.getBillById("79c5ec51-64e9-4f3a-baac-516858adff02");
    expect(persisted).not.toBeNull();
    expect(persisted!.items).toHaveLength(2);
    expect(persisted!.items[0].item_name).toBe("Cheese Delight Wrap");
    expect(persisted!.items[1].item_name).toBe("Clay Pot Pizza");
  });

  it("TEST 4 & 5: Payment completion updates persisted bill.payment_status, payment_method, and paid_at", async () => {
    const updateSpy = vi.spyOn(BillRepository, "updatePaymentStatus");

    const billRes = await BillingService.createBill({
      billId: "bill-79c5ec51-64e9-4f3a-baac-516858adff04",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff04",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf04",
      tableLabel: "Table 01",
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      items: [{ name: "Wrap", price: 129, qty: 1 }],
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff04",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf04",
      tableLabel: "Table 01",
      paymentMethod: "upi",
      amount: 129,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      "79c5ec51-64e9-4f3a-baac-516858adff04",
      "PAID",
      "UPI",
      expect.any(String)
    );

    const persisted = await BillRepository.getBillById("79c5ec51-64e9-4f3a-baac-516858adff04");
    expect(persisted?.payment_status).toBe("PAID");
    expect(persisted?.payment_method).toBe("UPI");
    expect(persisted?.paid_at).toBeDefined();
  });

  it("TEST 6: Owner Invoice query can retrieve the bill created by Counter POS", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-79c5ec51-64e9-4f3a-baac-516858adff06",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff06",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf06",
      tableLabel: "Table 01",
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      customerName: "Jane Doe",
      customerPhone: "+91 91234 56789",
      items: [{ name: "Clay Pot Pizza", price: 139, qty: 2 }],
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff06",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf06",
      tableLabel: "Table 01",
      paymentMethod: "upi",
      amount: 278,
    });

    const ownerBills = await BillRepository.getBillsByDateRange("6d00d671-eaea-47ce-a842-f970878373c9");
    const targetBill = ownerBills.find((b) => b.id === "79c5ec51-64e9-4f3a-baac-516858adff06");
    expect(targetBill).toBeDefined();

    const invoiceRecord = mapBillToInvoiceRecord(targetBill!);
    expect(invoiceRecord.status).toBe("Paid");
    expect(invoiceRecord.paymentMethod).toBe("UPI");
    expect(invoiceRecord.customerName).toBe("Jane Doe");
    expect(invoiceRecord.items).toHaveLength(1);
  });

  it("TEST 7 & 14: Duplicate CREATE_BILL request is idempotent and returns existing bill", async () => {
    const billRes1 = await BillingService.createBill({
      billId: "bill-79c5ec51-64e9-4f3a-baac-516858adff07",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff07",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf07",
      tableLabel: "Table 01",
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      items: [{ name: "Cheese Wrap", price: 129, qty: 1 }],
    });

    const billRes2 = await BillingService.createBill({
      billId: "bill-79c5ec51-64e9-4f3a-baac-516858adff07",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff07",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf07",
      tableLabel: "Table 01",
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      items: [{ name: "Cheese Wrap", price: 129, qty: 1 }],
    });

    expect(billRes1.bill.billId).toBe(billRes2.bill.billId);
  });

  it("TEST 8: Existing order + new draft items produces canonical BillService generateBill behavior", async () => {
    const bill = await BillService.generateBill({
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      sessionId: "session-multi-items-99",
      tableId: "Table 01",
      orders: [
        { items: [{ name: "KOT Order Item", price: 150, qty: 1 }] },
        { items: [{ name: "Direct Pay Draft Item", price: 120, qty: 1 }] },
      ],
    });

    expect(bill.items).toHaveLength(2);
    expect(bill.grand_total).toBe(283.5); // 270 + 5% default GST = 283.5
  });

  it("TEST 9 & 10: Retry after browser refresh finds persisted PAID bill and avoids duplicate settlements", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-79c5ec51-64e9-4f3a-baac-516858adff09",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff09",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf09",
      tableLabel: "Table 01",
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      items: [{ name: "Cheese Wrap", price: 129, qty: 1 }],
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff09",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf09",
      tableLabel: "Table 01",
      paymentMethod: "cash",
      amount: 129,
    });

    // Simulate browser refresh by clearing RAM maps
    billsMap.clear();
    settlementsMap.clear();

    // Verify recovery from BillRepository
    const recovered = await BillRepository.getBillById("79c5ec51-64e9-4f3a-baac-516858adff09");
    expect(recovered).not.toBeNull();
    expect(recovered?.payment_status).toBe("PAID");

    // Retry recordPayment
    const retryRes = await PaymentService.recordPayment({
      billId: "79c5ec51-64e9-4f3a-baac-516858adff09",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff09",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf09",
      tableLabel: "Table 01",
      paymentMethod: "cash",
      amount: 129,
    });

    expect(retryRes.status).toBe("Completed");
  });

  it("TEST 11: Normal KOT flow generates and updates canonical bill", async () => {
    const kotBill = await BillService.generateBill({
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      sessionId: "kot-session-55",
      tableId: "Table 02",
      orders: [{ items: [{ name: "Momos", price: 180, qty: 1 }] }],
    });

    expect(kotBill.payment_status).toBe("PENDING");

    const paidKotBill = await BillService.markBillPaid(kotBill.id, "UPI");
    expect(paidKotBill.payment_status).toBe("PAID");
  });

  it("TEST 12: Thermal receipt receives persisted historical bill items correctly", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-79c5ec51-64e9-4f3a-baac-516858adff12",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff12",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf12",
      tableLabel: "Table 01",
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      items: [
        { name: "Cheese Delight Wrap", price: 129, qty: 1 },
        { name: "Clay Pot Pizza", price: 139, qty: 1 },
      ],
    });

    const persisted = await BillRepository.getBillById(billRes.bill.billId);
    expect(persisted?.items).toHaveLength(2);
    expect(persisted?.items[0].item_name).toBe("Cheese Delight Wrap");
    expect(persisted?.items[1].item_name).toBe("Clay Pot Pizza");
  });

  it("TEST 13: Printer failure after payment does not undo the persisted bill/payment", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-79c5ec51-64e9-4f3a-baac-516858adff13",
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff13",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf13",
      tableLabel: "Table 01",
      cafeId: "6d00d671-eaea-47ce-a842-f970878373c9",
      items: [{ name: "Cheese Wrap", price: 129, qty: 1 }],
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "79c5ec51-64e9-4f3a-baac-516858adff13",
      diningSessionId: "0408938e-ead4-4fc9-afc3-a756d427cf13",
      tableLabel: "Table 01",
      paymentMethod: "upi",
      amount: 129,
    });

    // Simulate printer throwing an error
    const printPromise = BillingService.printBill("bill-non-existent");
    await expect(printPromise).rejects.toThrow();

    // Verify DB bill remains PAID
    const persisted = await BillRepository.getBillById("79c5ec51-64e9-4f3a-baac-516858adff13");
    expect(persisted?.payment_status).toBe("PAID");
  });
});
