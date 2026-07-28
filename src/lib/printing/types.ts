/**
 * Sprint: Printing Infrastructure Foundation
 * 
 * Defines strongly-typed custom errors and the unifying Printer interface
 * for OrderRail's extensible printing architecture.
 */

export class PrinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrinterError";
  }
}

export class PrinterNotFound extends PrinterError {
  constructor(printerName?: string) {
    const msg = printerName
      ? `[Printing] Printer "${printerName}" was not found.`
      : `[Printing] No default printer was found.`;
    super(msg);
    this.name = "PrinterNotFound";
  }
}

export class ConnectionFailed extends PrinterError {
  constructor(reason?: string) {
    const msg = reason
      ? `[Printing] Connection failed: ${reason}`
      : `[Printing] Connection failed to printer driver.`;
    super(msg);
    this.name = "ConnectionFailed";
  }
}

export class PrintFailed extends PrinterError {
  constructor(reason?: string) {
    const msg = reason
      ? `[Printing] Print failed: ${reason}`
      : `[Printing] Print job execution failed.`;
    super(msg);
    this.name = "PrintFailed";
  }
}

export type PrinterDriverType = "QZ_TRAY" | "LAN" | "USB" | "CLOUD";

/**
 * Extensible Printer Interface
 * Every printer driver (QZ Tray, LAN, USB, Cloud) must implement this contract.
 */
export interface Printer {
  readonly driverType: PrinterDriverType;
  connect(): Promise<void>;
  autoConnect(): Promise<boolean>;
  disconnect(): Promise<void>;
  listPrinters(): Promise<string[]>;
  getDefaultPrinter(): Promise<string | null>;
  printTest(printerName?: string): Promise<void>;
  isConnected(): boolean;
}
