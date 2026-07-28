import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  printService,
  PrintService,
  QZTrayPrinter,
  PrinterError,
  PrinterNotFound,
  ConnectionFailed,
  PrintFailed,
  type Printer,
} from "@/lib/printing";
import qz from "qz-tray";

vi.mock("qz-tray", () => {
  return {
    default: {
      websocket: {
        isActive: vi.fn(() => false),
        connect: vi.fn(async () => {}),
        disconnect: vi.fn(async () => {}),
        setClosedCallback: vi.fn(),
        setErrorCallback: vi.fn(),
      },
      printers: {
        find: vi.fn(async () => ["POS-58-Series", "Kitchen-Printer"]),
        getDefault: vi.fn(async () => "POS-58-Series"),
      },
      configs: {
        create: vi.fn(() => ({})),
      },
      security: {
        setCertificatePromise: vi.fn(),
        setSignaturePromise: vi.fn(),
        setSignatureAlgorithm: vi.fn(),
        getSignatureAlgorithm: vi.fn(() => "SHA256"),
      },
      print: vi.fn(async () => {}),
    },
  };
});

describe("Foundational Printing Infrastructure Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Custom printing error classes format message with [Printing] prefix", () => {
    const errNotFound = new PrinterNotFound("KOT-Printer");
    expect(errNotFound).toBeInstanceOf(PrinterError);
    expect(errNotFound.message).toContain('[Printing] Printer "KOT-Printer" was not found.');

    const errConnection = new ConnectionFailed("Host unreachable");
    expect(errConnection.message).toContain("[Printing] Connection failed: Host unreachable");

    const errPrint = new PrintFailed("Out of paper");
    expect(errPrint.message).toContain("[Printing] Print failed: Out of paper");
  });

  it("2. QZTrayPrinter connects, lists printers, and retrieves default printer", async () => {
    const qzPrinter = new QZTrayPrinter();

    await qzPrinter.connect();
    expect(qz.websocket.connect).toHaveBeenCalled();

    const printers = await qzPrinter.listPrinters();
    expect(printers).toEqual(["POS-58-Series", "Kitchen-Printer"]);

    const defaultPrinter = await qzPrinter.getDefaultPrinter();
    expect(defaultPrinter).toBe("POS-58-Series");
  });

  it("3. QZTrayPrinter executes test print with plain text POS-58 format", async () => {
    const qzPrinter = new QZTrayPrinter();
    (qz.websocket.isActive as any).mockReturnValue(true);

    await qzPrinter.printTest("POS-58-Series");

    expect(qz.configs.create).toHaveBeenCalledWith("POS-58-Series", expect.anything());
    expect(qz.print).toHaveBeenCalled();
  });

  it("4. PrintService singleton proxies calls and allows driver swapping", async () => {
    expect(printService).toBeInstanceOf(PrintService);
    expect(printService.driverType).toBe("QZ_TRAY");

    // Mock driver for testing driver swap
    const mockDriver: Printer = {
      driverType: "LAN",
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      listPrinters: vi.fn(async () => ["192.168.1.100"]),
      getDefaultPrinter: vi.fn(async () => "192.168.1.100"),
      printTest: vi.fn(async () => {}),
      isConnected: vi.fn(() => true),
    };

    printService.setDriver(mockDriver);
    expect(printService.driverType).toBe("LAN");

    const printers = await printService.listPrinters();
    expect(printers).toEqual(["192.168.1.100"]);
    expect(mockDriver.listPrinters).toHaveBeenCalled();

    // Restore QZTrayPrinter
    printService.setDriver(new QZTrayPrinter());
    expect(printService.driverType).toBe("QZ_TRAY");
  });
});
