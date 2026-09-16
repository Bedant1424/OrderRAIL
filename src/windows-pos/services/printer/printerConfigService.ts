import { ESC_POS } from "@/lib/printing/constants";
import { escposStringToBytes } from "../counterKotService";
import type { CounterPrinter, PrintResult } from "./counterPrinter";

export interface PrinterConfig {
  printerName: string;
  stationId: string;
  enabled: boolean;
  paperWidth: 58 | 80;
  autoCut: boolean;
}

const PRINTER_CONFIG_STORAGE_KEY = "orderrail_pos_printer_config";

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  printerName: "POS-58-Series",
  stationId: "COUNTER-01",
  enabled: true,
  paperWidth: 58,
  autoCut: true,
};

export class PrinterConfigService {
  /**
   * Retrieves active printer configuration from local storage
   */
  public static getConfig(): PrinterConfig {
    try {
      const raw = localStorage.getItem(PRINTER_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_PRINTER_CONFIG,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn("[PrinterConfigService] Error reading config from storage, using defaults:", e);
    }
    return { ...DEFAULT_PRINTER_CONFIG };
  }

  /**
   * Updates and persists printer configuration
   */
  public static saveConfig(updates: Partial<PrinterConfig>): PrinterConfig {
    const current = this.getConfig();
    const updated: PrinterConfig = {
      ...current,
      ...updates,
    };
    try {
      localStorage.setItem(PRINTER_CONFIG_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("[PrinterConfigService] Error persisting config:", e);
    }
    return updated;
  }

  /**
   * Discovers installed Windows printers via Tauri native bridge
   */
  public static async discoverPrinters(): Promise<string[]> {
    if (typeof window === "undefined") {
      return [];
    }

    // Check Tauri v2 internal IPC bridge
    const tauri = (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__?.core;
    if (tauri && typeof tauri.invoke === "function") {
      try {
        const printers = await tauri.invoke("list_printers");
        if (Array.isArray(printers)) {
          return printers;
        }
      } catch (err) {
        console.warn("[PrinterConfigService] Failed to discover printers via Tauri bridge:", err);
      }
    }

    return [];
  }

  /**
   * Generates formatted ESC/POS byte sequence for diagnostic test print
   */
  public static generateDiagnosticTestPayload(
    stationId: string = "COUNTER-01",
    paperWidth: 58 | 80 = 58
  ): Uint8Array {
    const cols = paperWidth === 58 ? 32 : 48;
    const divider = "-".repeat(cols);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const dateStr = now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    let s = "";
    s += ESC_POS.INIT;
    s += ESC_POS.ALIGN_CENTER;
    s += ESC_POS.BOLD_ON;
    s += "CHEESE CORNER\n";
    s += "PRINTER TEST\n\n";
    s += ESC_POS.BOLD_OFF;

    s += ESC_POS.ALIGN_LEFT;
    s += `Station: ${stationId}\n`;
    s += `Date:    ${dateStr}\n`;
    s += `Time:    ${timeStr}\n`;
    s += `Width:   ${paperWidth}mm (${cols} cols)\n`;
    s += divider + "\n";

    s += ESC_POS.ALIGN_CENTER;
    s += ESC_POS.BOLD_ON;
    s += "STATUS: TEST\n";
    s += ESC_POS.BOLD_OFF;

    s += ESC_POS.ALIGN_LEFT;
    s += divider + "\n\n\n";

    s += ESC_POS.FEED_AND_CUT;

    return escposStringToBytes(s);
  }

  /**
   * Executes a diagnostic test print against the specified printer adapter
   */
  public static async executeTestPrint(printer: CounterPrinter): Promise<PrintResult> {
    const config = this.getConfig();
    const payload = this.generateDiagnosticTestPayload(config.stationId, config.paperWidth);
    return await printer.printRaw(payload, {
      title: "Diagnostic Printer Test",
      tableLabel: "TEST",
    });
  }
}
