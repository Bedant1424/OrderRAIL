export interface ReceiptSettings {
  // Receipt Branding Toggles
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showGst: boolean;
  showInvoiceNum: boolean;

  // Receipt Content & Notes
  receiptHeader: string; // Max 100 chars
  thankYouMessage: string;
  footerInfo: string; // Max 250 chars

  // Invoice Number Config
  invoicePrefix: string; // Max 10 chars, e.g. "INV-"

  // Printing Options
  receiptWidth: "58mm" | "80mm";
  autoPrint: boolean;
  printCopies: number; // 1, 2, 3

  // Identifiers & Optional Business Fields
  gstNumber: string;
  fssaiNumber: string;
  businessRegNumber: string;
  supportEmail: string;
  website: string;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showGst: true,
  showInvoiceNum: true,
  receiptHeader: "Welcome to Cheese Corner",
  thankYouMessage: "Thank you for visiting Cheese Corner!\nPlease visit again soon.",
  footerInfo: "FSSAI LIC NO: 10020022000123\nFollow us on Instagram @cheesecorner",
  invoicePrefix: "INV-",
  receiptWidth: "58mm",
  autoPrint: false,
  printCopies: 1,
  gstNumber: "27AAAAA0000A1Z5",
  fssaiNumber: "10020022000123",
  businessRegNumber: "CIN-12345678",
  supportEmail: "support@cheesecorner.com",
  website: "www.cheesecorner.com",
};

/**
 * Saves receipt settings to localStorage cache for offline access.
 */
export function saveReceiptSettingsToLocalStorage(settings: ReceiptSettings, cafeId?: string): void {
  try {
    const key = `orderrail_receipt_settings_${cafeId || "default"}`;
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(settings));
    }
  } catch (e) {
    console.warn("[receiptSettings] Failed to save to localStorage:", e);
  }
}

/**
 * Loads receipt settings for a given cafe.
 * Prioritizes cafeRecord.receipt_settings if present, then localStorage cache, then default settings.
 * When DB settings exist, caches them to localStorage for offline access.
 */
export function getReceiptSettings(
  cafeId?: string,
  cafeRecord?: { receipt_settings?: any } | null
): ReceiptSettings {
  // 1. Prioritize DB cafeRecord.receipt_settings if present & non-null
  if (cafeRecord && cafeRecord.receipt_settings != null) {
    try {
      const parsed =
        typeof cafeRecord.receipt_settings === "string"
          ? JSON.parse(cafeRecord.receipt_settings)
          : cafeRecord.receipt_settings;
      if (parsed && typeof parsed === "object") {
        const merged: ReceiptSettings = { ...DEFAULT_RECEIPT_SETTINGS, ...parsed };
        saveReceiptSettingsToLocalStorage(merged, cafeId);
        return merged;
      }
    } catch (e) {
      console.warn("[receiptSettings] Failed to parse cafeRecord.receipt_settings:", e);
    }
  }

  // 2. Secondary fallback to localStorage cache
  try {
    const key = `orderrail_receipt_settings_${cafeId || "default"}`;
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          return { ...DEFAULT_RECEIPT_SETTINGS, ...parsed };
        }
      }
    }
  } catch (e) {
    console.warn("[receiptSettings] Failed to read from localStorage:", e);
  }

  // 3. Final fallback to DEFAULT_RECEIPT_SETTINGS
  return DEFAULT_RECEIPT_SETTINGS;
}

/**
 * Saves receipt settings for a given cafe to localStorage.
 */
export function saveReceiptSettings(settings: ReceiptSettings, cafeId?: string): void {
  saveReceiptSettingsToLocalStorage(settings, cafeId);
}
