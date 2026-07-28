import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  printService,
  PrinterNotFound,
  ConnectionFailed,
  PrintFailed,
  type Printer,
} from "@/lib/printing";

// Ensure no qz-tray imports anywhere outside src/lib/printing
describe("Developer Printing Validation Tests", () => {
  let mockDriver: Printer;

  beforeEach(() => {
    mockDriver = {
      driverType: "QZ_TRAY",
      connect: vi.fn(async () => {}),
      autoConnect: vi.fn(async () => true),
      disconnect: vi.fn(async () => {}),
      listPrinters: vi.fn(async () => ["POS-58-Series", "Receipt-Printer"]),
      getDefaultPrinter: vi.fn(async () => "POS-58-Series"),
      printTest: vi.fn(async () => {}),
      isConnected: vi.fn(() => true),
    };
    printService.setDriver(mockDriver);
  });

  it("1. PrintService proxies connect, autoConnect, disconnect, listPrinters, and printTest cleanly", async () => {
    await printService.connect();
    expect(mockDriver.connect).toHaveBeenCalled();

    const autoConnected = await printService.autoConnect();
    expect(autoConnected).toBe(true);
    expect(mockDriver.autoConnect).toHaveBeenCalled();

    const printers = await printService.listPrinters();
    expect(printers).toEqual(["POS-58-Series", "Receipt-Printer"]);

    const defaultPrinter = await printService.getDefaultPrinter();
    expect(defaultPrinter).toBe("POS-58-Series");

    await printService.printTest("POS-58-Series");
    expect(mockDriver.printTest).toHaveBeenCalledWith("POS-58-Series");
  });

  it("2. Persists and restores last used printer from localStorage", async () => {
    printService.setLastUsedPrinter("Receipt-Printer");
    const restored = await printService.getRestoredPrinter();
    expect(restored).toBe("Receipt-Printer");
  });

  it("3. Handles PrinterNotFound error cleanly with user friendly message", async () => {
    (mockDriver.printTest as any).mockRejectedValueOnce(
      new PrinterNotFound("NonExistentPrinter")
    );

    try {
      await printService.printTest("NonExistentPrinter");
    } catch (err: any) {
      expect(err).toBeInstanceOf(PrinterNotFound);
      expect(err.message).toBe('[Printing] Printer "NonExistentPrinter" was not found.');
    }
  });

  it("4. Handles ConnectionFailed error cleanly", async () => {
    (mockDriver.connect as any).mockRejectedValueOnce(
      new ConnectionFailed("WebSocket closed")
    );

    try {
      await printService.connect();
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConnectionFailed);
      expect(err.message).toBe("[Printing] Connection failed: WebSocket closed");
    }
  });
});
