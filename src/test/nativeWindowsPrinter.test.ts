import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NativeWindowsPrinter,
  isTauriAvailable,
} from "@/windows-pos/services/printer/nativeWindowsPrinter";
import {
  MockCounterPrinter,
  defaultCounterPrinter,
  getActiveCounterPrinter,
} from "@/windows-pos/services/printer/counterPrinter";
import {
  PrinterConfigService,
  DEFAULT_PRINTER_CONFIG,
} from "@/windows-pos/services/printer/printerConfigService";
import { generateCounterKot } from "@/windows-pos/services/counterKotService";
import { CounterOrderBuilderService } from "@/windows-pos/services/counterOrderBuilderService";
import { NetworkManager } from "@/lib/offline/networkManager";
import { clearAllOperations, getPendingOperations } from "@/lib/offline/indexedDbQueue";
import type { CounterOrder } from "@/windows-pos/types/counterTypes";

describe("Milestone 6 — Native Windows ESC/POS Printing Test Suite", () => {
  let printer: NativeWindowsPrinter;
  const mockTauriInvoke = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    printer = new NativeWindowsPrinter();
    PrinterConfigService.saveConfig(DEFAULT_PRINTER_CONFIG);
    await clearAllOperations();
    NetworkManager.resetForceOverride();

    // Default window without Tauri bridge
    delete (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI__;
  });

  afterEach(async () => {
    delete (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI__;
    await clearAllOperations();
    NetworkManager.resetForceOverride();
  });

  it("1. Returns UNAVAILABLE with BRIDGE_UNAVAILABLE when running in non-Tauri browser runtime", async () => {
    expect(isTauriAvailable()).toBe(false);

    const testPayload = new Uint8Array([0x1b, 0x40, 0x41, 0x42]);
    const res = await printer.printRaw(testPayload, { orderNumber: 101 });

    expect(res.status).toBe("UNAVAILABLE");
    expect(res.errorCode).toBe("BRIDGE_UNAVAILABLE");
    expect(res.message).toContain("Tauri native bridge is not available");
  });

  it("2. Rejects empty or zero-byte payload before native call", async () => {
    const emptyPayload = new Uint8Array(0);
    const res = await printer.printRaw(emptyPayload);

    expect(res.status).toBe("FAILED");
    expect(res.errorCode).toBe("INVALID_PAYLOAD");
    expect(res.message).toContain("empty ESC/POS byte payload");
  });

  it("3. Rejects empty or unconfigured printer target", async () => {
    PrinterConfigService.saveConfig({ printerName: "" });

    const payload = new Uint8Array([0x1b, 0x40]);
    const res = await printer.printRaw(payload);

    expect(res.status).toBe("FAILED");
    expect(res.errorCode).toBe("PRINTER_NOT_FOUND");
    expect(res.message).toContain("No printer target configured");
  });

  it("4. Rejects print attempt when thermal printer is disabled in station settings", async () => {
    PrinterConfigService.saveConfig({ enabled: false });

    const payload = new Uint8Array([0x1b, 0x40]);
    const res = await printer.printRaw(payload);

    expect(res.status).toBe("UNAVAILABLE");
    expect(res.errorCode).toBe("PRINTER_DISABLED");
    expect(res.message).toContain("Thermal printing is disabled");
  });

  it("5. Successfully invokes Tauri print_raw_escpos command through native bridge", async () => {
    // Setup mock Tauri bridge
    (window as any).__TAURI_INTERNALS__ = {
      invoke: mockTauriInvoke.mockResolvedValue({
        status: "SPOOLER_ACCEPTED",
        jobId: "win-spool-901",
        bytesWritten: 4,
      }),
    };

    expect(isTauriAvailable()).toBe(true);

    const payload = new Uint8Array([0x1b, 0x40, 0x48, 0x69]);
    const res = await printer.printRaw(payload, {
      title: "Kitchen Order Ticket",
      orderNumber: 105,
    });

    expect(mockTauriInvoke).toHaveBeenCalledWith("print_raw_escpos", {
      printerName: "POS-58-Series",
      payload: [27, 64, 72, 105],
      jobTitle: "Kitchen Order Ticket",
    });

    expect(res.status).toBe("SPOOLER_ACCEPTED");
    expect(res.jobId).toBe("win-spool-901");
    expect(res.bytesPrinted).toBe(4);
    expect(res.message).toContain("POS-58-Series");
  });

  it("6. Passes raw ESC/POS binary bytes completely unchanged to native bridge", async () => {
    const rawEscposBytes = new Uint8Array([
      0x1b, 0x40, // INIT
      0x1b, 0x61, 0x01, // CENTER
      0x1b, 0x45, 0x01, // BOLD ON
      0x50, 0x4f, 0x53, // "POS"
      0x1b, 0x45, 0x00, // BOLD OFF
      0x1d, 0x56, 0x41, 0x03, // FEED & CUT
    ]);

    (window as any).__TAURI_INTERNALS__ = {
      invoke: mockTauriInvoke.mockResolvedValue({
        status: "SPOOLER_ACCEPTED",
        jobId: "win-spool-902",
        bytesWritten: rawEscposBytes.length,
      }),
    };

    const res = await printer.printRaw(rawEscposBytes);
    expect(res.status).toBe("SPOOLER_ACCEPTED");

    const calledArgs = mockTauriInvoke.mock.calls[0][1];
    expect(calledArgs.payload).toEqual(Array.from(rawEscposBytes));
    expect(calledArgs.payload).toHaveLength(rawEscposBytes.length);
  });

  it("7. Emits honest SPOOLER_ACCEPTED status and never claims physical print output", async () => {
    (window as any).__TAURI_INTERNALS__ = {
      invoke: mockTauriInvoke.mockResolvedValue({
        status: "SPOOLER_ACCEPTED",
        jobId: "win-spool-903",
        bytesWritten: 120,
      }),
    };

    const payload = new Uint8Array([0x1b, 0x40, 0x0a]);
    const res = await printer.printRaw(payload);

    expect(res.status).toBe("SPOOLER_ACCEPTED");
    expect(res.status as string).not.toBe("PRINTED");
    expect(res.status as string).not.toBe("PHYSICALLY_PRINTED");
    expect(res.message).toContain("accepted by Windows Print Spooler");
  });

  it("8. Accurately maps native error classifications (printer not found, access denied, spooler error)", async () => {
    // 8a: Printer Not Found
    (window as any).__TAURI_INTERNALS__ = {
      invoke: mockTauriInvoke.mockRejectedValue({
        code: "PRINTER_NOT_FOUND",
        message: "The specified printer name is invalid or does not exist.",
      }),
    };
    let res = await printer.printRaw(new Uint8Array([0x1b]));
    expect(res.status).toBe("UNAVAILABLE");
    expect(res.errorCode).toBe("PRINTER_NOT_FOUND");

    // 8b: Access Denied
    (window as any).__TAURI_INTERNALS__.invoke = vi.fn().mockRejectedValue({
      code: "ACCESS_DENIED",
      message: "Access is denied opening printer spooler handle.",
    });
    res = await printer.printRaw(new Uint8Array([0x1b]));
    expect(res.status).toBe("FAILED");
    expect(res.errorCode).toBe("ACCESS_DENIED");

    // 8c: Spooler Unavailable
    (window as any).__TAURI_INTERNALS__.invoke = vi.fn().mockRejectedValue({
      code: "SPOOLER_UNAVAILABLE",
      message: "Windows Print Spooler service is stopped or unavailable.",
    });
    res = await printer.printRaw(new Uint8Array([0x1b]));
    expect(res.status).toBe("UNAVAILABLE");
    expect(res.errorCode).toBe("SPOOLER_UNAVAILABLE");
  });

  it("9. Diagnostic test print generates formatted ESC/POS test payload and submits via printer", async () => {
    const payload = PrinterConfigService.generateDiagnosticTestPayload("COUNTER-01", 58);
    expect(payload.length).toBeGreaterThan(50);

    // Convert to string to verify contents
    const text = new TextDecoder("latin1").decode(payload);
    expect(text).toContain("CHEESE CORNER");
    expect(text).toContain("PRINTER TEST");
    expect(text).toContain("Station: COUNTER-01");
    expect(text).toContain("STATUS: TEST");

    // Verify cut command is appended (\x1D\x56\x41\x03)
    const lastBytes = Array.from(payload.slice(-4));
    expect(lastBytes).toEqual([0x1d, 0x56, 0x41, 0x03]);

    // Execute test print through MockCounterPrinter
    const mock = new MockCounterPrinter();
    const printRes = await PrinterConfigService.executeTestPrint(mock);
    expect(printRes.status).toBe("ACCEPTED_FOR_TEST_PRINT");
    expect(mock.getLastPayload()).toBeDefined();
  });

  it("10. MockCounterPrinter continues to function reliably for development and unit testing", async () => {
    const mock = new MockCounterPrinter();
    const data = new Uint8Array([0x1b, 0x40, 0x54, 0x65, 0x73, 0x74]);

    const res = await mock.printRaw(data, { orderNumber: 202 });
    expect(res.status).toBe("ACCEPTED_FOR_TEST_PRINT");
    expect(res.bytesPrinted).toBe(6);
    expect(mock.getLastPayload()).toEqual(data);
    expect(mock.getHistory()).toHaveLength(1);

    // Test failure simulation
    mock.setShouldFail(true);
    const failRes = await mock.printRaw(data);
    expect(failRes.status).toBe("FAILED");

    // Test unavailable simulation
    mock.setShouldFail(false);
    mock.setShouldBeUnavailable(true);
    const unavailRes = await mock.printRaw(data);
    expect(unavailRes.status).toBe("UNAVAILABLE");
  });

  it("11. KOT generation pipeline formats CounterOrder into ESC/POS bytes unchanged", () => {
    const order: CounterOrder = {
      id: "ord-test-kot-1",
      orderNumber: 142,
      tableId: "t-4",
      diningSessionId: null,
      status: "preparing",
      orderSource: "DINE_IN",
      createdAt: new Date().toISOString(),
      totalCents: 45000,
      customerName: "Anand",
      items: [
        { id: "it-1", menuItemId: "m-1", name: "Farmhouse Pizza", priceCents: 29900, qty: 1 },
        { id: "it-2", menuItemId: "m-2", name: "Cold Coffee", priceCents: 15100, qty: 2 },
      ],
    };

    const kot = generateCounterKot(order, "Table 4", "Cheese Corner", 58);
    expect(kot.rawBytes).toBeInstanceOf(Uint8Array);
    expect(kot.rawBytes.length).toBeGreaterThan(0);
    expect(kot.text).toContain("KOT #: 142");
    expect(kot.text).toContain("TABLE 4");
    expect(kot.text).toContain("Farmhouse Pizza");
    expect(kot.text).toContain("Cold Coffee");
  });

  it("12. Offline order creation and queue remain fully operational and independent of printer state", async () => {
    NetworkManager.forceOffline();

    const failingPrinter: MockCounterPrinter = new MockCounterPrinter();
    failingPrinter.setShouldFail(true);

    const submitRes = await CounterOrderBuilderService.submitOrder({
      cafeId: "8c418a5a-7cd4-4054-8a88-f412c1762f7d",
      orderSource: "TAKEAWAY",
      customerName: "Karan",
      items: [
        { id: "it-1", name: "Paneer Sandwich", priceCents: 12000, qty: 1 },
      ],
      printer: failingPrinter,
    });

    // 1. Order submission MUST succeed locally even when printing fails
    expect(submitRes.success).toBe(true);
    expect(submitRes.isOffline).toBe(true);
    expect(submitRes.syncStatus).toBe("PENDING_SYNC");

    // 2. Print result reflects failure independently
    expect(submitRes.printResult?.status).toBe("FAILED");

    // 3. Operation is queued in IndexedDB for server sync
    const pending = await getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0].operationType).toBe("CREATE_ORDER");
    expect(pending[0].status).toBe("Queued");
  });
});
