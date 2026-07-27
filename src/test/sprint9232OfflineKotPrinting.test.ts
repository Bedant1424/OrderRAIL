import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NetworkManager,
  OperationExecutor,
  SyncManager,
  ConflictDetector,
  OfflineEventBus,
  clearAllOperations,
} from "@/lib/offline";
import { OrderService, orderIdMapping } from "@/lib/orders/orderService";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";
import { renderKotText } from "@/lib/printing/kotRenderer";
import { PrintService, printService } from "@/lib/printing/PrintService";
import { MockProvider } from "@/lib/printing/providers/MockProvider";

describe("Sprint 9.2.3.2 — Offline KOT Printing Tests", () => {
  let mockProvider: MockProvider;

  beforeEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    ConflictDetector.clearConflicts();
    OfflineEventBus.removeAllListeners();
    orderIdMapping.clear();

    mockProvider = new MockProvider({ simulatedDelayMs: 10 });
    PrintService.resetInstanceForTesting(mockProvider);
    PrinterAdapter.setSimulatedState(null);
    await PrinterAdapter.connect();
  });

  afterEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    OfflineEventBus.removeAllListeners();
    orderIdMapping.clear();
    PrinterAdapter.setSimulatedState(null);
  });

  it("1. KOT Renderer: Formats 58mm and 80mm thermal receipts cleanly", () => {
    const payload = {
      orderId: "ord-101",
      orderNumber: 101,
      kotNumber: 101,
      tableLabel: "Table 4",
      timestamp: "12:30 PM",
      items: [
        { id: "i1", name: "Artisan Coffee", price: 180, qty: 2, notes: "Oat milk" },
        { id: "i2", name: "Croissant", price: 120, qty: 1 },
      ],
      notes: "Deliver together",
    };

    const text80 = renderKotText(payload, 80);
    expect(text80).toContain("*** KITCHEN ORDER TICKET ***");
    expect(text80).toContain("Table 4");
    expect(text80).toContain("2x   Artisan Coffee");
    expect(text80).toContain("* Note: Oat milk");
    expect(text80).toContain("SPECIAL INSTRUCTIONS: Deliver together");

    const text58 = renderKotText(payload, 58);
    expect(text58).toContain("*** KITCHEN ORDER TICKET ***");
    expect(text58).toContain("Table 4");
  });

  it("2. Printer Adapter: Manages status and supports simulation state overrides", async () => {
    expect(PrinterAdapter.getStatus().isOnline).toBe(true);

    PrinterAdapter.setSimulatedState("DISCONNECTED");
    expect(PrinterAdapter.getStatus().isOnline).toBe(false);
    expect(PrinterAdapter.getStatus().state).toBe("DISCONNECTED");

    PrinterAdapter.setSimulatedState("OUT_OF_PAPER");
    expect(PrinterAdapter.getStatus().state).toBe("OUT_OF_PAPER");

    PrinterAdapter.setSimulatedState(null); // Reset
    expect(PrinterAdapter.getStatus().isOnline).toBe(true);
  });

  it("3. PRINT_KOT Operation: Executes immediately when printer and network are online", async () => {
    const res = await OrderService.printKot({
      orderId: "ord-202",
      orderNumber: 202,
      kotNumber: 202,
      tableLabel: "Table 1",
      timestamp: "01:15 PM",
      items: [{ name: "Pasta", price: 350, qty: 1 }],
    });

    expect(res.queued).toBe(false);
    expect(res.status).toBe("Completed");

    const history = printService.getJobHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].type).toBe("KOT");
  });

  it("4. Offline Printing Queue: Queues PRINT_KOT operation in IndexedDB when printer is offline", async () => {
    PrinterAdapter.setSimulatedState("DISCONNECTED");

    const res = await OrderService.printKot({
      orderId: "ord-303",
      orderNumber: 303,
      kotNumber: 303,
      tableLabel: "Table 5",
      timestamp: "02:00 PM",
      items: [{ name: "Pizza", price: 500, qty: 1 }],
    });

    expect(res.queued).toBe(true);
    expect(res.status).toBe("Queued");

    const queuedJobs = await OrderService.getQueuedPrintJobs();
    expect(queuedJobs.length).toBe(1);
    expect(queuedJobs[0].payload.orderId).toBe("ord-303");
  });

  it("5. Automatic Retry: Replays queued KOT print jobs when printer comes online", async () => {
    PrinterAdapter.setSimulatedState("DISCONNECTED");

    await OrderService.printKot({
      orderId: "ord-404",
      orderNumber: 404,
      kotNumber: 404,
      tableLabel: "Table 2",
      timestamp: "02:30 PM",
      items: [{ name: "Tacos", price: 250, qty: 3 }],
    });

    const queuedBefore = await OrderService.getQueuedPrintJobs();
    expect(queuedBefore.length).toBe(1);

    // Printer reconnected
    PrinterAdapter.setSimulatedState("CONNECTED");
    const syncRes = await SyncManager.startSync();

    expect(syncRes.success).toBe(true);
    expect(syncRes.processed).toBe(1);

    const queuedAfter = await OrderService.getQueuedPrintJobs();
    expect(queuedAfter.length).toBe(0);
  });

  it("6. Reprint Support: Records reprint as distinct PRINT_KOT operation with audit tag", async () => {
    const res = await OrderService.reprintKot("ord-505", {
      orderNumber: 505,
      kotNumber: 505,
      tableLabel: "Table 3",
      timestamp: "03:00 PM",
      items: [{ name: "Ice Cream", price: 150, qty: 2 }],
    });

    expect(res.status).toBe("Completed");

    const text = renderKotText({
      orderId: "ord-505",
      orderNumber: 505,
      kotNumber: 505,
      tableLabel: "Table 3",
      timestamp: "03:00 PM",
      items: [{ name: "Ice Cream", price: 150, qty: 2 }],
      isReprint: true,
    });

    expect(text).toContain("** REPRINT **");
  });

  it("7. Failure Handling: Paper Out retains job in queue and permits manual retry", async () => {
    PrinterAdapter.setSimulatedState("OUT_OF_PAPER");

    const res = await OrderService.printKot({
      orderId: "ord-606",
      orderNumber: 606,
      kotNumber: 606,
      tableLabel: "Table 6",
      timestamp: "03:30 PM",
      items: [{ name: "Salad", price: 200, qty: 1 }],
    });

    expect(res.queued).toBe(true);

    const pending1 = await OrderService.getQueuedPrintJobs();
    expect(pending1.length).toBe(1);

    // Refill paper & retry
    PrinterAdapter.setSimulatedState("CONNECTED");
    const retrySync = await SyncManager.startSync();

    expect(retrySync.success).toBe(true);
    expect(retrySync.processed).toBe(1);

    const pending2 = await OrderService.getQueuedPrintJobs();
    expect(pending2.length).toBe(0);
  });

  it("8. Duplicate Prevention: Identical print call with same idempotency key prevents duplicates", async () => {
    PrinterAdapter.setSimulatedState("DISCONNECTED");

    const p1 = await OrderService.printKot({
      orderId: "ord-707",
      orderNumber: 707,
      kotNumber: 707,
      tableLabel: "Table 7",
      timestamp: "04:00 PM",
      items: [{ name: "Soup", price: 180, qty: 1 }],
    });

    const p2 = await OrderService.printKot({
      orderId: "ord-707",
      orderNumber: 707,
      kotNumber: 707,
      tableLabel: "Table 7",
      timestamp: "04:00 PM",
      items: [{ name: "Soup", price: 180, qty: 1 }],
    });

    expect(p1.operationId).toBe(p2.operationId);

    const queued = await OrderService.getQueuedPrintJobs();
    expect(queued.length).toBe(1);
  });
});
