export type PaymentMethodKey = "cash" | "upi" | "card" | "wallet" | "bank_transfer";

export interface PaymentSettings {
  // Enabled Payment Methods
  enabledMethods: Record<PaymentMethodKey, boolean>;

  // Preselected Default Payment Method
  defaultMethod: PaymentMethodKey;

  // Payment Behavior Rules
  requirePaymentBeforeClosing: boolean;
  autoCloseOrder: boolean;
  allowPartialPayments: boolean; // Placeholder
  allowSplitBills: boolean; // Placeholder

  // Digital & Printed Receipt Behavior
  offerDigitalReceipt: boolean;
  offerPrintedReceipt: boolean;
  printAutomatically: boolean;
  printCustomerCopy: boolean;
  printKitchenCopy: boolean;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  enabledMethods: {
    cash: true,
    upi: true,
    card: true,
    wallet: false,
    bank_transfer: false,
  },
  defaultMethod: "upi",
  requirePaymentBeforeClosing: true,
  autoCloseOrder: true,
  allowPartialPayments: false,
  allowSplitBills: false,
  offerDigitalReceipt: true,
  offerPrintedReceipt: true,
  printAutomatically: false,
  printCustomerCopy: true,
  printKitchenCopy: true,
};

/**
 * Loads payment settings for a given cafe from localStorage, falling back to default settings.
 */
export function getPaymentSettings(cafeId?: string): PaymentSettings {
  try {
    const key = `orderrail_payment_settings_${cafeId || "default"}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_PAYMENT_SETTINGS,
        ...parsed,
        enabledMethods: {
          ...DEFAULT_PAYMENT_SETTINGS.enabledMethods,
          ...(parsed.enabledMethods || {}),
        },
      };
    }
  } catch {}
  return DEFAULT_PAYMENT_SETTINGS;
}

/**
 * Saves payment settings for a given cafe to localStorage.
 */
export function savePaymentSettings(settings: PaymentSettings, cafeId?: string): void {
  const key = `orderrail_payment_settings_${cafeId || "default"}`;
  localStorage.setItem(key, JSON.stringify(settings));
}
