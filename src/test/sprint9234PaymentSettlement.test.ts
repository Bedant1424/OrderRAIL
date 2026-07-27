import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  NetworkManager,
  OperationExecutor,
  SyncManager,
  ConflictDetector,
  OfflineEventBus,
  clearAllOperations,
  getAllOperations,
} from "@/lib/offline";
import { BillingService, billsMap } from "@/lib/billing/billingService";
import { PaymentService, settlementsMap } from "@/lib/payments/paymentService";
import { OrderService } from "@/lib/orders/orderService";

describe("Sprint 9.2.3.4 — Payment Recording, Settlement & Bill Finalization Tests", () => {
  beforeEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    ConflictDetector.clearConflicts();
    OfflineEventBus.removeAllListeners();
    billsMap.clear();
    settlementsMap.clear();
  });

  afterEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    OfflineEventBus.removeAllListeners();
    billsMap.clear();
    settlementsMap.clear();
  });

  it("1. Cash Payment Recording: Records payment, creates settlement record, and locks bill as Paid", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-cash-101",
      billNumber: "B-1001",
      orderId: "ord-101",
      tableLabel: "Table 1",
      items: [{ name: "Cold Brew", price: 150, qty: 2 }],
    });

    const payRes = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-101",
      tableLabel: "Table 1",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
      operatorId: "Cashier Sarah",
    });

    expect(payRes.queued).toBe(false);
    expect(payRes.settlement.status).toBe("settled");
    expect(payRes.settlement.paymentMethod).toBe("cash");

    const bill = BillingService.getBill("bill-cash-101");
    expect(bill?.status).toBe("Paid");
    expect(bill?.paymentStatus).toBe("paid");

    const settlement = PaymentService.getSettlementByBillId("bill-cash-101");
    expect(settlement).toBeDefined();
    expect(settlement?.amount).toBe(billRes.bill.netTotal);
  });

  it("2. UPI & Card Payments: Records UPI and Card payment methods cleanly", async () => {
    const bUpi = await BillingService.createBill({
      billId: "bill-upi-202",
      orderId: "ord-202",
      tableLabel: "Table 2",
      items: [{ name: "Pizza", price: 400, qty: 1 }],
    });

    const pUpi = await PaymentService.recordPayment({
      billId: bUpi.bill.billId,
      orderId: "ord-202",
      tableLabel: "Table 2",
      paymentMethod: "upi",
      amount: bUpi.bill.netTotal,
    });

    expect(pUpi.settlement.paymentMethod).toBe("upi");

    const bCard = await BillingService.createBill({
      billId: "bill-card-303",
      orderId: "ord-303",
      tableLabel: "Table 3",
      items: [{ name: "Burger", price: 250, qty: 1 }],
    });

    const pCard = await PaymentService.recordPayment({
      billId: bCard.bill.billId,
      orderId: "ord-303",
      tableLabel: "Table 3",
      paymentMethod: "card",
      amount: bCard.bill.netTotal,
    });

    expect(pCard.settlement.paymentMethod).toBe("card");
  });

  it("3. Offline Payment Recording: Records payment locally and enqueues operation when offline", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-off-404",
      orderId: "ord-404",
      tableLabel: "Table 4",
      items: [{ name: "Pasta", price: 300, qty: 1 }],
    });

    NetworkManager.forceOffline();

    const payRes = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-404",
      tableLabel: "Table 4",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
    });

    expect(payRes.queued).toBe(true);

    const bill = BillingService.getBill("bill-off-404");
    expect(bill?.status).toBe("Paid");

    const queuedSettlements = await PaymentService.getQueuedSettlements();
    expect(queuedSettlements.length).toBe(1);
    expect(queuedSettlements[0].billId).toBe("bill-off-404");
    expect(queuedSettlements[0].syncState).toBe("Pending Sync");
  });

  it("4. Automatic Synchronization: Replays queued payment operations upon network reconnection", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-sync-505",
      orderId: "ord-505",
      tableLabel: "Table 5",
      items: [{ name: "Fries", price: 120, qty: 2 }],
    });

    NetworkManager.forceOffline();

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-505",
      tableLabel: "Table 5",
      paymentMethod: "upi",
      amount: billRes.bill.netTotal,
    });

    const opsBefore = await getAllOperations();
    expect(opsBefore.length).toBe(1);

    // Network reconnected
    NetworkManager.forceOnline();
    const syncRes = await SyncManager.startSync();

    expect(syncRes.success).toBe(true);
    expect(syncRes.processed).toBe(1);

    const opsAfter = await getAllOperations();
    expect(opsAfter.length).toBe(0);
  });

  it("5. Bill Locking & Immutability: Rejects order edits or cancellations on paid bills", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-lock-606",
      orderId: "ord-606",
      tableLabel: "Table 6",
      items: [{ name: "Steak", price: 800, qty: 1 }],
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-606",
      tableLabel: "Table 6",
      paymentMethod: "card",
      amount: billRes.bill.netTotal,
    });

    // Attempting edit on paid order should throw immutability error
    await expect(
      OrderService.editOrder({
        orderId: "ord-606",
        items: [{ name: "Steak", price_cents: 80000, qty: 2 }],
      })
    ).rejects.toThrow("immutable");

    // Attempting cancellation on paid order should throw immutability error
    await expect(OrderService.cancelOrder("ord-606")).rejects.toThrow("immutable");
  });

  it("6. Duplicate Payment Prevention: Rejects second payment attempt on paid bill", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-dup-707",
      orderId: "ord-707",
      tableLabel: "Table 7",
      items: [{ name: "Soup", price: 180, qty: 1 }],
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-707",
      tableLabel: "Table 7",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
    });

    // Second payment attempt must be rejected
    await expect(
      PaymentService.recordPayment({
        billId: billRes.bill.billId,
        orderId: "ord-707",
        tableLabel: "Table 7",
        paymentMethod: "cash",
        amount: billRes.bill.netTotal,
      })
    ).rejects.toThrow("already paid and locked");
  });

  it("7. Settlement Audit History: Tracks all completed settlements accurately", async () => {
    const b1 = await BillingService.createBill({
      billId: "bill-aud-1",
      orderId: "ord-aud-1",
      tableLabel: "Table A",
      items: [{ name: "Tea", price: 50, qty: 1 }],
    });
    await PaymentService.recordPayment({
      billId: b1.bill.billId,
      orderId: "ord-aud-1",
      tableLabel: "Table A",
      paymentMethod: "cash",
      amount: b1.bill.netTotal,
      operatorId: "Operator Alex",
    });

    const b2 = await BillingService.createBill({
      billId: "bill-aud-2",
      orderId: "ord-aud-2",
      tableLabel: "Table B",
      items: [{ name: "Coffee", price: 100, qty: 1 }],
    });
    await PaymentService.recordPayment({
      billId: b2.bill.billId,
      orderId: "ord-aud-2",
      tableLabel: "Table B",
      paymentMethod: "upi",
      amount: b2.bill.netTotal,
      operatorId: "Operator Sam",
    });

    const allSettlements = PaymentService.getAllSettlements();
    expect(allSettlements.length).toBe(2);
    expect(allSettlements[0].operatorId).toBe("Operator Alex");
    expect(allSettlements[1].operatorId).toBe("Operator Sam");
  });
});
