import type {
  CounterPrinter,
  PrintResult,
  PrintContext,
  PrintErrorCode,
  PrintStatus,
} from "./counterPrinter";
import { PrinterConfigService } from "./printerConfigService";

export interface NativePrintResponse {
  status: "SPOOLER_ACCEPTED";
  jobId: string;
  bytesWritten: number;
}

export interface NativePrintError {
  code: string;
  message: string;
}

/**
 * Checks whether the Tauri IPC runtime is available in the current environment
 */
export function isTauriAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const tauri =
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__?.core;
  return !!(tauri && typeof tauri.invoke === "function");
}

/**
 * NativeWindowsPrinter: Sends raw ESC/POS byte buffers directly through
 * Tauri IPC to the Windows Print Spooler subsystem using RAW datatype.
 * 
 * Result Semantics:
 * Successful submission emits `SPOOLER_ACCEPTED`.
 * It does NOT claim physical paper output or mechanical verification.
 */
export class NativeWindowsPrinter implements CounterPrinter {
  public async printRaw(data: Uint8Array, context?: PrintContext): Promise<PrintResult> {
    const timestamp = new Date();

    // 1. Validate payload is non-empty
    if (!data || data.length === 0) {
      return {
        status: "FAILED",
        errorCode: "INVALID_PAYLOAD",
        message: "Cannot dispatch empty ESC/POS byte payload to print spooler.",
        timestamp,
      };
    }

    // 2. Validate printer configuration
    const config = PrinterConfigService.getConfig();
    if (!config.enabled) {
      return {
        status: "UNAVAILABLE",
        errorCode: "PRINTER_DISABLED",
        message: "Thermal printing is disabled in station configuration.",
        timestamp,
      };
    }

    const printerName = config.printerName?.trim();
    if (!printerName) {
      return {
        status: "FAILED",
        errorCode: "PRINTER_NOT_FOUND",
        message: "No printer target configured in station settings.",
        timestamp,
      };
    }

    // 3. Verify Tauri native bridge availability
    if (!isTauriAvailable()) {
      return {
        status: "UNAVAILABLE",
        errorCode: "BRIDGE_UNAVAILABLE",
        message: "Tauri native bridge is not available (running in web browser or mock test runtime).",
        timestamp,
      };
    }

    const tauri =
      (window as any).__TAURI_INTERNALS__ ||
      (window as any).__TAURI__?.core;

    const jobTitle =
      context?.title ||
      (context?.orderNumber
        ? `Cheese Corner Order #${context.orderNumber}`
        : "Cheese Corner Print Job");

    // 4. Dispatch raw byte buffer to Tauri command `print_raw_escpos`
    try {
      const response: NativePrintResponse = await tauri.invoke("print_raw_escpos", {
        printerName,
        payload: Array.from(data),
        jobTitle,
      });

      return {
        status: "SPOOLER_ACCEPTED",
        message: `ESC/POS job accepted by Windows Print Spooler for "${printerName}" (${response.bytesWritten ?? data.length} bytes).`,
        bytesPrinted: response.bytesWritten ?? data.length,
        jobId: response.jobId || `spool-${Date.now()}`,
        timestamp,
      };
    } catch (err: any) {
      const parsed = this.classifyNativeError(err);
      console.warn("[NativeWindowsPrinter] Spooler submission error:", {
        printerName,
        err,
        parsed,
      });

      return {
        status: parsed.status,
        errorCode: parsed.errorCode,
        message: parsed.message,
        timestamp,
      };
    }
  }

  /**
   * Classifies native Rust/Win32 errors into structured TypeScript print errors
   */
  private classifyNativeError(err: any): {
    status: PrintStatus;
    errorCode: PrintErrorCode;
    message: string;
  } {
    const rawMsg = (err?.message || (typeof err === "string" ? err : JSON.stringify(err)) || "").toLowerCase();
    const rawCode = (err?.code || "").toUpperCase();

    if (rawCode === "PRINTER_NOT_FOUND" || rawMsg.includes("printer not found") || rawMsg.includes("cannot find printer")) {
      return {
        status: "UNAVAILABLE",
        errorCode: "PRINTER_NOT_FOUND",
        message: "Specified printer not found in Windows subsystem. Please check printer name in settings.",
      };
    }

    if (rawCode === "ACCESS_DENIED" || rawMsg.includes("access is denied") || rawMsg.includes("5")) {
      return {
        status: "FAILED",
        errorCode: "ACCESS_DENIED",
        message: "Access denied opening Windows print spooler handle. Elevated permissions may be required.",
      };
    }

    if (rawCode === "SPOOLER_UNAVAILABLE" || rawMsg.includes("spooler") || rawMsg.includes("rpc server is unavailable")) {
      return {
        status: "UNAVAILABLE",
        errorCode: "SPOOLER_UNAVAILABLE",
        message: "Windows Print Spooler service is stopped or unavailable.",
      };
    }

    if (rawCode === "INVALID_PAYLOAD" || rawMsg.includes("empty payload")) {
      return {
        status: "FAILED",
        errorCode: "INVALID_PAYLOAD",
        message: "Native bridge rejected empty or invalid byte buffer.",
      };
    }

    if (rawCode === "TIMEOUT" || rawMsg.includes("timeout") || rawMsg.includes("timed out")) {
      return {
        status: "FAILED",
        errorCode: "TIMEOUT",
        message: "Native print spooler communication timed out.",
      };
    }

    return {
      status: "FAILED",
      errorCode: "NATIVE_ERROR",
      message: err?.message || (typeof err === "string" ? err : "Unknown native print spooler error occurred."),
    };
  }
}

export const defaultNativeWindowsPrinter = new NativeWindowsPrinter();
