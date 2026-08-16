import { describe, it, expect, beforeEach } from "vitest";
import { getReceiptSettings, saveReceiptSettings, DEFAULT_RECEIPT_SETTINGS, type ReceiptSettings } from "@/lib/billing/receiptSettings";

describe("Cafe-Wide Shared Receipt Settings & Multi-Device Sync Suite", () => {
  beforeEach(() => {
    localStorage.clear();
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
});
