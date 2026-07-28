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
  receiptHeader: "Welcome to OrderRail Cafe",
  thankYouMessage: "Thank you for visiting!\nWe hope to see you again soon.",
  footerInfo: "FSSAI LIC NO: 10020022000123\nFollow us on Instagram @OrderRail",
  invoicePrefix: "INV-",
  receiptWidth: "80mm",
  autoPrint: false,
  printCopies: 1,
  gstNumber: "27AAAAA0000A1Z5",
  fssaiNumber: "10020022000123",
  businessRegNumber: "CIN-12345678",
  supportEmail: "billing@orderrail.com",
  website: "www.orderrail.com",
};

/**
 * Loads receipt settings for a given cafe from localStorage, falling back to default settings.
 */
export function getReceiptSettings(cafeId?: string): ReceiptSettings {
  try {
    const key = `orderrail_receipt_settings_${cafeId || "default"}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return { ...DEFAULT_RECEIPT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Fallback on parse error
  }
  return DEFAULT_RECEIPT_SETTINGS;
}

/**
 * Saves receipt settings for a given cafe to localStorage.
 */
export function saveReceiptSettings(settings: ReceiptSettings, cafeId?: string): void {
  const key = `orderrail_receipt_settings_${cafeId || "default"}`;
  localStorage.setItem(key, JSON.stringify(settings));
}
