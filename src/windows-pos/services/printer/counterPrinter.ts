import { defaultNativeWindowsPrinter } from "./nativeWindowsPrinter";

export type PrintStatus =
  | 'SUCCESS'
  | 'SPOOLER_ACCEPTED'
  | 'ACCEPTED_FOR_TEST_PRINT'
  | 'FAILED'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export type PrintErrorCode =
  | 'PRINTER_NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'SPOOLER_UNAVAILABLE'
  | 'INVALID_PAYLOAD'
  | 'PRINTER_DISABLED'
  | 'BRIDGE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NATIVE_ERROR'
  | 'UNKNOWN_ERROR';

export interface PrintResult {
  status: PrintStatus;
  message: string;
  bytesPrinted?: number;
  jobId?: string;
  errorCode?: PrintErrorCode;
  timestamp: Date;
}

export interface PrintContext {
  title?: string;
  orderNumber?: number | string;
  tableLabel?: string;
}

export interface CounterPrinter {
  printRaw(data: Uint8Array, context?: PrintContext): Promise<PrintResult>;
}

/**
 * MockCounterPrinter: Hardware-free development and test printer implementation.
 * Captures raw bytes in memory and simulates realistic POS printer responses.
 */
export class MockCounterPrinter implements CounterPrinter {
  private lastPayload: Uint8Array | null = null;
  private printHistory: Array<{
    data: Uint8Array;
    timestamp: Date;
    context?: PrintContext;
  }> = [];
  private shouldFail: boolean = false;
  private shouldBeUnavailable: boolean = false;

  async printRaw(data: Uint8Array, context?: PrintContext): Promise<PrintResult> {
    const timestamp = new Date();

    if (this.shouldFail) {
      return {
        status: 'FAILED',
        message: 'Printer hardware error: buffer write rejected',
        timestamp,
      };
    }

    if (this.shouldBeUnavailable) {
      return {
        status: 'UNAVAILABLE',
        message: 'Printer is offline or port is closed',
        timestamp,
      };
    }

    this.lastPayload = data;
    this.printHistory.push({ data, timestamp, context });

    return {
      status: 'ACCEPTED_FOR_TEST_PRINT',
      message: `Mock printer accepted ${data.length} bytes for order #${context?.orderNumber ?? 'N/A'} (Test Mode)`,
      bytesPrinted: data.length,
      jobId: `mock-job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
    };
  }

  getLastPayload(): Uint8Array | null {
    return this.lastPayload;
  }

  getHistory() {
    return this.printHistory;
  }

  clearHistory() {
    this.printHistory = [];
    this.lastPayload = null;
  }

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  setShouldBeUnavailable(unavailable: boolean) {
    this.shouldBeUnavailable = unavailable;
  }
}

export const defaultCounterPrinter = new MockCounterPrinter();

/**
 * Factory providing the active printer implementation:
 * - NativeWindowsPrinter in Tauri desktop runtime
 * - MockCounterPrinter in web browser or unit test environments
 */
export function getActiveCounterPrinter(): CounterPrinter {
  if (typeof window !== "undefined") {
    const tauri = (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__?.core;
    if (tauri && typeof tauri.invoke === "function") {
      return defaultNativeWindowsPrinter;
    }
  }
  return defaultCounterPrinter;
}
