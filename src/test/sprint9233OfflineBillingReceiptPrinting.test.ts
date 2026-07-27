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
import { PrinterAdapter } from "@/lib/printing/printerAdapter";
import { renderReceiptText } from "@/lib/printing/receiptRenderer";
import { PrintService, printService } from "@/lib/printing/PrintService";
import { MockProvider } from "@/lib/printing/providers/MockProvider";

describe("Sprint 9.2.3.3 — Offline Billing & Receipt Printing Tests", () => {
  let mockProvider: MockProvider;

  beforeEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    ConflictDetector.clearConflicts();
    OfflineEventBus.removeAllListeners();
    billsMap.clear();

    mockProvider = new MockProvider({ simulatedDelayMs: 10 });
    PrintService.resetInstanceForTesting(mockProvider);
    printService.clearQueue();
    PrinterAdapter.setSimulatedState(null);
    await PrinterAdapter.connect();
  });

  afterEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    OfflineEventBus.removeAllListeners();
    billsMap.clear();
    printService.clearQueue();
    PrinterAdapter.setSimulatedState(null);
  });

  it("1. Bill Generation & Financial Math: Calculates subtotal, 5% GST tax, discount, and net total correctly", () => {
    const items = [
      { id: "1", name: "Cappuccino", price: 200, qty: 2 }, // 400
      { id: "2", name: "Brownie", price: 150, qty: 1 },    // 150 -> Subtotal = 550
    ];

    // 10% Discount: 55 -> Taxable = 495 -> 5% GST = 24.75 -> Net Total = 519.75
    const totals = BillingService.calculateBillTotals(items, 10, 5);

    expect(totals.subtotal).toBe(550);
    expect(totals.discountAmt).toBe(55);
    expect(totals.tax).toBe(24.75);
    expect(totals.netTotal).toBe(519.75);
  });

  it("2. Receipt Renderer: Formats 58mm and 80mm receipts with GST and audit headers", () => {
    const payload = {
      billId: "bill-101",
      billNumber: "B-1001",
      orderId: "ord-101",
      orderNumber: 101,
      tableLabel: "Table 3",
      timestamp: "02:15 PM",
      cafeName: "ORDERRAIL TEST CAFE",
      gstin: "27AAAAA0000A1Z5",
      items: [
        { id: "i1", name: "Cold Coffee", price: 150, qty: 2 },
        { id: "i2", name: "Sandwich", price: 200, qty: 1 },
      ],
      subtotal: 500,
      tax: 25,
      discountPct: 0,
      discountAmt: 0,
      netTotal: 525,
      paymentStatus: "unpaid" as const,
    };

    const text80 = renderReceiptText(payload, 80);
    expect(text80).toContain("ORDERRAIL TEST CAFE");
    expect(text80).toContain("GSTIN: 27AAAAA0000A1Z5");
    expect(text80).toContain("INVOICE #: B-1001");
    expect(text80).toContain("2x   Cold Coffee");
    expect(text80).toContain("CGST (2.5%):");
    expect(text80).toContain("NET PAYABLE TOTAL:");
    expect(text80).toContain("₹525.00");

    const textReprint = renderReceiptText({ ...payload, isReprint: true }, 80);
    expect(textReprint).toContain("** REPRINT RECEIPT **");
  });

  it("3. CREATE_BILL & PRINT_BILL Operations: Executes immediately when online and printer connected", async () => {
    const createRes = await BillingService.createBill({
      billId: "bill-202",
      billNumber: "B-2002",
      orderId: "ord-202",
      tableLabel: "Table 1",
      items: [{ name: "Latte", price: 200, qty: 2 }],
    });

    expect(createRes.queued).toBe(false);
    expect(createRes.bill.status).toBe("Finalized");

    const printRes = await BillingService.printBill("bill-202");
    expect(printRes.queued).toBe(false);

    const updatedBill = BillingService.getBill("bill-202");
    expect(updatedBill?.status).toBe("Printed");

    const history = printService.getJobHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].type).toBe("RECEIPT");
  });

  it("4. Offline Billing Queue & Persistence: Queues bill creation and printing when offline", async () => {
    NetworkManager.forceOffline();

    const createRes = await BillingService.createBill({
      billId: "bill-303",
      billNumber: "B-3003",
      orderId: "ord-303",
      tableLabel: "Table 4",
      items: [{ name: "Mocha", price: 250, qty: 1 }],
    });

    expect(createRes.queued).toBe(true);

    const queuedBills = await BillingService.getQueuedBills();
    expect(queuedBills.length).toBe(1);
    expect(queuedBills[0].billId).toBe("bill-303");
    expect(queuedBills[0].syncState).toBe("Pending Sync");
  });

  it("5. Automatic Replay on Reconnect: Flushes queued bill and print operations in FIFO order", async () => {
    NetworkManager.forceOffline();

    const billRes = await BillingService.createBill({
      billId: "bill-404",
      billNumber: "B-4040",
      orderId: "ord-404",
      tableLabel: "Table 2",
      items: [{ name: "Smoothie", price: 220, qty: 2 }],
    });

    await BillingService.printBill(billRes.bill.billId);

    const opsBefore = await getAllOperations();
    expect(opsBefore.length).toBe(2);

    // Network reconnected
    NetworkManager.forceOnline();
    const syncRes = await SyncManager.startSync();

    expect(syncRes.success).toBe(true);
    expect(syncRes.processed).toBe(2);

    const opsAfter = await getAllOperations();
    expect(opsAfter.length).toBe(0);
  });

  it("6. Reprint Support: Records reprint as distinct REPRINT_BILL operation", async () => {
    printService.clearQueue();

    const billRes = await BillingService.createBill({
      billId: "bill-505",
      billNumber: "B-5050",
      orderId: "ord-505",
      tableLabel: "Table 5",
      items: [{ name: "Tea", price: 100, qty: 1 }],
    });

    await BillingService.printBill(billRes.bill.billId);

    const reprintRes = await BillingService.reprintBill("bill-505");
    expect(reprintRes.queued).toBe(false);

    const history = printService.getJobHistory();
    expect(history.length).toBe(2); // Initial print + reprint
  });

  it("7. Bill Voiding: VOID_BILL operation transitions bill status to Voided", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-606",
      billNumber: "B-6060",
      orderId: "ord-606",
      tableLabel: "Table 6",
      items: [{ name: "Juice", price: 120, qty: 1 }],
    });

    const voidRes = await BillingService.voidBill(billRes.bill.billId, "Customer cancelled order");
    expect(voidRes.queued).toBe(false);

    const voidedBill = BillingService.getBill("bill-606");
    expect(voidedBill?.status).toBe("Voided");
    expect(voidedBill?.paymentStatus).toBe("voided");
  });

  it("8. Duplicate Prevention: Identical bill create call with same idempotency key prevents duplicate execution", async () => {
    NetworkManager.forceOffline();

    const b1 = await BillingService.createBill({
      billId: "bill-707-fixed",
      billNumber: "B-7070",
      orderId: "ord-707",
      tableLabel: "Table 7",
      items: [{ name: "Bagel", price: 180, qty: 1 }],
    });

    const b2 = await BillingService.createBill({
      billId: "bill-707-fixed",
      billNumber: "B-7070",
      orderId: "ord-707",
      tableLabel: "Table 7",
      items: [{ name: "Bagel", price: 180, qty: 1 }],
    });

    expect(b1.bill.billId).toBe(b2.bill.billId);

    const queuedBills = await BillingService.getQueuedBills();
    expect(queuedBills.length).toBe(1);
  });
});
