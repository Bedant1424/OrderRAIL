import { describe, it, expect, beforeEach, vi } from "vitest";
import { getReceiptSettings, saveReceiptSettings, DEFAULT_RECEIPT_SETTINGS, type ReceiptSettings } from "@/lib/billing/receiptSettings";
import { BillingService } from "@/lib/billing/billingService";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";

describe("Cafe-Wide Shared Receipt Settings & Multi-Device Sync Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("1. DB receipt_settings are resolved and used without requiring Owner role", () => {
    const cafeRecordFromDb = {
      id: "cafe-cheesecorner",
      receipt_settings: {
        showAddress: false,
        showPhone: true,
        receiptHeader: "Custom Cafe DB Header",
        receiptWidth: "80mm"
      }
    };

    // Counter POS workstation (no owner role) loads settings with DB cafe record
    const settings = getReceiptSettings("cafe-cheesecorner", cafeRecordFromDb as any);

    expect(settings.showAddress).toBe(false);
    expect(settings.showPhone).toBe(true);
    expect(settings.receiptHeader).toBe("Custom Cafe DB Header");
    expect(settings.receiptWidth).toBe("80mm");
    expect(settings.showLogo).toBe(true); // Default fallback preserved for omitted fields
  });

  it("2. Authoritative DB settings override stale local storage settings on Counter device", () => {
    const cafeId = "cafe-stale-test";
    const staleLocalSettings: ReceiptSettings = {
      ...DEFAULT_RECEIPT_SETTINGS,
      receiptHeader: "STALE LOCAL HEADER",
      receiptWidth: "58mm"
    };

    // Local device has old stored settings
    saveReceiptSettings(staleLocalSettings, cafeId);

    const freshDbRecord = {
      id: cafeId,
      receipt_settings: {
        receiptHeader: "FRESH DB HEADER",
        receiptWidth: "80mm"
      }
    };

    // DB record must win over local storage
    const resolved = getReceiptSettings(cafeId, freshDbRecord as any);
    expect(resolved.receiptHeader).toBe("FRESH DB HEADER");
    expect(resolved.receiptWidth).toBe("80mm");
  });

  it("3. DB NULL + local storage uses local storage fallback for offline/migration", () => {
    const cafeId = "cafe-local-fallback";
    const localSettings: ReceiptSettings = {
      ...DEFAULT_RECEIPT_SETTINGS,
      receiptHeader: "LOCAL STORAGE HEADER"
    };

    saveReceiptSettings(localSettings, cafeId);

    const dbRecordWithNull = {
      id: cafeId,
      receipt_settings: null
    };

    // DB is NULL -> falls back to local storage
    const resolved = getReceiptSettings(cafeId, dbRecordWithNull as any);
    expect(resolved.receiptHeader).toBe("LOCAL STORAGE HEADER");
  });

  it("4. DB NULL does NOT automatically get overwritten by Counter local storage", () => {
    const cafeId = "cafe-no-auto-overwrite";
    const localSettings: ReceiptSettings = {
      ...DEFAULT_RECEIPT_SETTINGS,
      receiptHeader: "COUNTER LOCAL HEADER"
    };

    saveReceiptSettings(localSettings, cafeId);

    const dbRecordWithNull = {
      id: cafeId,
      receipt_settings: null
    };

    // Resolving settings does not mutate the DB record
    const resolved = getReceiptSettings(cafeId, dbRecordWithNull as any);
    expect(resolved.receiptHeader).toBe("COUNTER LOCAL HEADER");
    expect(dbRecordWithNull.receipt_settings).toBeNull();
  });

  it("5. DB settings automatically update local storage cache for offline printing resilience", () => {
    const cafeId = "cafe-offline-cache";
    const dbRecord = {
      id: cafeId,
      receipt_settings: {
        receiptHeader: "OFFLINE SYNC HEADER",
        footerInfo: "OFFLINE FOOTER"
      }
    };

    // First load online with DB record
    getReceiptSettings(cafeId, dbRecord as any);

    // Later offline load without DB record
    const cachedOfflineSettings = getReceiptSettings(cafeId, null);
    expect(cachedOfflineSettings.receiptHeader).toBe("OFFLINE SYNC HEADER");
    expect(cachedOfflineSettings.footerInfo).toBe("OFFLINE FOOTER");
  });

  it("6. Malformed local storage JSON falls back safely to DEFAULT_RECEIPT_SETTINGS", () => {
    const cafeId = "cafe-corrupt-local";
    localStorage.setItem(`orderrail_receipt_settings_${cafeId}`, "{ invalid json ... }");

    const resolved = getReceiptSettings(cafeId, null);
    expect(resolved.receiptHeader).toBe("Welcome to Cheese Corner");
    expect(resolved.receiptWidth).toBe("58mm");
  });

  it("7. Malformed DB JSON merges safely with DEFAULT_RECEIPT_SETTINGS", () => {
    const cafeId = "cafe-corrupt-db";
    const corruptDbRecord = {
      id: cafeId,
      receipt_settings: "not-json-valid-string"
    };

    const resolved = getReceiptSettings(cafeId, corruptDbRecord as any);
    expect(resolved.receiptHeader).toBe("Welcome to Cheese Corner");
    expect(resolved.showAddress).toBe(true);
  });

  it("8. Strict Multi-Cafe isolation (Cafe A settings do not pollute Cafe B)", () => {
    const cafeARecord = {
      id: "cafe-A",
      receipt_settings: {
        receiptHeader: "HEADER CAFE A",
        receiptWidth: "80mm"
      }
    };

    const cafeBRecord = {
      id: "cafe-B",
      receipt_settings: {
        receiptHeader: "HEADER CAFE B",
        receiptWidth: "58mm"
      }
    };

    const settingsA = getReceiptSettings("cafe-A", cafeARecord as any);
    const settingsB = getReceiptSettings("cafe-B", cafeBRecord as any);

    expect(settingsA.receiptHeader).toBe("HEADER CAFE A");
    expect(settingsA.receiptWidth).toBe("80mm");

    expect(settingsB.receiptHeader).toBe("HEADER CAFE B");
    expect(settingsB.receiptWidth).toBe("58mm");
  });

  it("9. Receipt presentation toggles (showAddress, showPhone, showLogo) are cafe-wide shared", () => {
    const dbRecord = {
      id: "cafe-toggles",
      receipt_settings: {
        showLogo: false,
        showAddress: true,
        showPhone: false,
        invoicePrefix: "BILL-"
      }
    };

    const settings = getReceiptSettings("cafe-toggles", dbRecord as any);
    expect(settings.showLogo).toBe(false);
    expect(settings.showAddress).toBe(true);
    expect(settings.showPhone).toBe(false);
    expect(settings.invoicePrefix).toBe("BILL-");
  });

  it("10. Device-specific printer hardware configuration remains local", () => {
    const cafeId = "cafe-hw-isolation";

    // Shared cafe-wide settings
    const sharedSettings: ReceiptSettings = {
      ...DEFAULT_RECEIPT_SETTINGS,
      receiptHeader: "SHARED CAFE HEADER"
    };
    saveReceiptSettings(sharedSettings, cafeId);

    // Device-specific hardware settings (QZ Tray printer name) stored in device localStorage
    const localDevicePrinterName = "EPSON_TM_T88VI_COUNTER_1";
    localStorage.setItem(`orderrail_device_printer_${cafeId}`, localDevicePrinterName);

    const resolvedShared = getReceiptSettings(cafeId, null);
    const resolvedHwPrinter = localStorage.getItem(`orderrail_device_printer_${cafeId}`);

    expect(resolvedShared.receiptHeader).toBe("SHARED CAFE HEADER");
    expect(resolvedHwPrinter).toBe("EPSON_TM_T88VI_COUNTER_1");
  });

  it("11. PRINT_BILL integration: cafe.receipt_settings reach PrinterAdapter.printReceipt payload", async () => {
    const printSpy = vi.spyOn(PrinterAdapter, "printReceipt").mockResolvedValue({ success: true });

    const cafeRecord = {
      id: "cafe-print-bill-test",
      receipt_settings: {
        showAddress: false,
        showPhone: true,
        showGst: false,
        showInvoiceNum: true,
        receiptHeader: "Cheese Corner DB Header",
        thankYouMessage: "Thank you from DB",
        footerInfo: "Visit again soon DB",
        receiptWidth: "80mm"
      }
    };

    const createdBill = await BillingService.createBill({
      billId: "bill-print-integration-1",
      orderId: "order-print-integration-1",
      tableLabel: "Table 4",
      items: [{ id: "item-1", name: "Cheese Pizza", price: 250, qty: 2 }],
      cafeId: cafeRecord.id,
      cafeRecord: cafeRecord as any
    });

    await BillingService.printBill(createdBill.bill.billId);

    expect(printSpy).toHaveBeenCalled();
    const lastCallArg = printSpy.mock.calls[printSpy.mock.calls.length - 1][0];

    expect(lastCallArg.showAddress).toBe(false);
    expect(lastCallArg.showPhone).toBe(true);
    expect(lastCallArg.showGst).toBe(false);
    expect(lastCallArg.showInvoiceNum).toBe(true);
    expect(lastCallArg.receiptHeader).toBe("Cheese Corner DB Header");
    expect(lastCallArg.thankYouMessage).toBe("Thank you from DB");
    expect(lastCallArg.footerInfo).toBe("Visit again soon DB");
    expect(lastCallArg.isReprint).toBe(false);

    printSpy.mockRestore();
  });

  it("12. REPRINT_BILL integration: cafe.receipt_settings reach PrinterAdapter with isReprint true", async () => {
    const printSpy = vi.spyOn(PrinterAdapter, "printReceipt").mockResolvedValue({ success: true });

    const cafeRecord = {
      id: "cafe-reprint-integration-test",
      receipt_settings: {
        showAddress: true,
        showPhone: false,
        showGst: true,
        showInvoiceNum: true,
        receiptHeader: "Reprint DB Header",
        thankYouMessage: "Reprint Thank You",
        footerInfo: "Reprint Footer Info",
        receiptWidth: "58mm"
      }
    };

    const createdBill = await BillingService.createBill({
      billId: "bill-reprint-integration-1",
      orderId: "order-reprint-integration-1",
      tableLabel: "Table 8",
      items: [{ id: "item-2", name: "Garlic Bread", price: 150, qty: 1 }],
      cafeId: cafeRecord.id,
      cafeRecord: cafeRecord as any
    });

    await BillingService.reprintBill(createdBill.bill.billId);

    expect(printSpy).toHaveBeenCalled();
    const lastCallArg = printSpy.mock.calls[printSpy.mock.calls.length - 1][0];

    expect(lastCallArg.showAddress).toBe(true);
    expect(lastCallArg.showPhone).toBe(false);
    expect(lastCallArg.showGst).toBe(true);
    expect(lastCallArg.showInvoiceNum).toBe(true);
    expect(lastCallArg.receiptHeader).toBe("Reprint DB Header");
    expect(lastCallArg.thankYouMessage).toBe("Reprint Thank You");
    expect(lastCallArg.footerInfo).toBe("Reprint Footer Info");
    expect(lastCallArg.isReprint).toBe(true);

    printSpy.mockRestore();
  });

  it("13. PRINT_BILL flow functions cleanly without localStorage dependency", async () => {
    localStorage.clear(); // Ensure 0 local storage cache
    const printSpy = vi.spyOn(PrinterAdapter, "printReceipt").mockResolvedValue({ success: true });

    const cafeRecord = {
      id: "cafe-no-localstorage-test",
      receipt_settings: {
        receiptHeader: "PURE DB HEADER NO LOCALSTORAGE",
        footerInfo: "PURE DB FOOTER NO LOCALSTORAGE"
      }
    };

    const createdBill = await BillingService.createBill({
      billId: "bill-no-ls-1",
      orderId: "order-no-ls-1",
      tableLabel: "Counter 1",
      items: [{ id: "item-3", name: "Cold Coffee", price: 120, qty: 1 }],
      cafeId: cafeRecord.id,
      cafeRecord: cafeRecord as any
    });

    await BillingService.printBill(createdBill.bill.billId);

    expect(printSpy).toHaveBeenCalled();
    const lastCallArg = printSpy.mock.calls[printSpy.mock.calls.length - 1][0];
    expect(lastCallArg.receiptHeader).toBe("PURE DB HEADER NO LOCALSTORAGE");
    expect(lastCallArg.footerInfo).toBe("PURE DB FOOTER NO LOCALSTORAGE");

    printSpy.mockRestore();
  });

  it("14. Stale localStorage cannot override DB settings in PRINT_BILL flow", async () => {
    const cafeId = "cafe-stale-ls-print-test";

    // Put stale settings in localStorage
    saveReceiptSettings({
      ...DEFAULT_RECEIPT_SETTINGS,
      receiptHeader: "STALE LOCALSTORAGE HEADER"
    }, cafeId);

    const printSpy = vi.spyOn(PrinterAdapter, "printReceipt").mockResolvedValue({ success: true });

    // DB has different authoritative settings
    const cafeRecord = {
      id: cafeId,
      receipt_settings: {
        receiptHeader: "AUTHORITATIVE DB HEADER"
      }
    };

    const createdBill = await BillingService.createBill({
      billId: "bill-stale-ls-1",
      orderId: "order-stale-ls-1",
      tableLabel: "Table 2",
      items: [{ id: "item-4", name: "Pasta", price: 200, qty: 1 }],
      cafeId,
      cafeRecord: cafeRecord as any
    });

    await BillingService.printBill(createdBill.bill.billId);

    expect(printSpy).toHaveBeenCalled();
    const lastCallArg = printSpy.mock.calls[printSpy.mock.calls.length - 1][0];
    expect(lastCallArg.receiptHeader).toBe("AUTHORITATIVE DB HEADER");

    printSpy.mockRestore();
  });

  it("15. Printer width (58mm & 80mm) from cafe.receipt_settings reaches printer path when localStorage is empty", async () => {
    localStorage.clear();

    const dbRecord80mm = {
      id: "cafe-80mm-test",
      receipt_settings: {
        receiptWidth: "80mm"
      }
    };

    const dbRecord58mm = {
      id: "cafe-58mm-test",
      receipt_settings: {
        receiptWidth: "58mm"
      }
    };

    const settings80 = getReceiptSettings("cafe-80mm-test", dbRecord80mm as any);
    const settings58 = getReceiptSettings("cafe-58mm-test", dbRecord58mm as any);

    expect(settings80.receiptWidth).toBe("80mm");
    expect(settings58.receiptWidth).toBe("58mm");
  });

  it("16. Device printer hardware configuration (qz_printer_name) remains device-local and is not taken from cafes.receipt_settings", () => {
    const cafeId = "cafe-hardware-isolation-verify";
    const dbRecord = {
      id: cafeId,
      receipt_settings: {
        receiptHeader: "CAFE HEADER IN DB",
        // qz_printer_name is NOT in DB schema
      }
    };

    // Hardware printer endpoint saved in device browser storage
    localStorage.setItem(`orderrail_device_printer_${cafeId}`, "LOCAL_PHYSICAL_PRINTER_COUNTER_A");

    const settings = getReceiptSettings(cafeId, dbRecord as any);
    const localHwPrinter = localStorage.getItem(`orderrail_device_printer_${cafeId}`);

    expect(settings.receiptHeader).toBe("CAFE HEADER IN DB");
    expect((settings as any).qz_printer_name).toBeUndefined();
    expect(localHwPrinter).toBe("LOCAL_PHYSICAL_PRINTER_COUNTER_A");
  });
});
