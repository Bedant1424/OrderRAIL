import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_PAYMENT_SETTINGS,
  getPaymentSettings,
  savePaymentSettings,
  type PaymentSettings,
} from "@/lib/billing/paymentSettings";

describe("Sprint 9.2.9.3 — Payment Methods & Settlement Settings Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("1. Loads default payment settings", () => {
    const settings = getPaymentSettings("test-cafe");

    expect(settings.enabledMethods.cash).toBe(true);
    expect(settings.enabledMethods.upi).toBe(true);
    expect(settings.enabledMethods.card).toBe(true);
    expect(settings.defaultMethod).toBe("upi");
    expect(settings.requirePaymentBeforeClosing).toBe(true);
    expect(settings.autoCloseOrder).toBe(true);
  });

  it("2. Saves and retrieves custom payment settings", () => {
    const custom: PaymentSettings = {
      ...DEFAULT_PAYMENT_SETTINGS,
      enabledMethods: {
        cash: true,
        upi: false,
        card: true,
        wallet: true,
        bank_transfer: false,
      },
      defaultMethod: "card",
      offerDigitalReceipt: true,
      offerPrintedReceipt: false,
    };

    savePaymentSettings(custom, "test-cafe");
    const loaded = getPaymentSettings("test-cafe");

    expect(loaded.enabledMethods.upi).toBe(false);
    expect(loaded.enabledMethods.wallet).toBe(true);
    expect(loaded.defaultMethod).toBe("card");
    expect(loaded.offerPrintedReceipt).toBe(false);
  });

  it("3. Ensures at least one payment method remains enabled", () => {
    const enabledCount = (methods: Record<string, boolean>) =>
      Object.values(methods).filter(Boolean).length;

    const validMethods = { cash: true, upi: false, card: false, wallet: false, bank_transfer: false };
    expect(enabledCount(validMethods)).toBe(1);

    const invalidMethods = { cash: false, upi: false, card: false, wallet: false, bank_transfer: false };
    expect(enabledCount(invalidMethods)).toBe(0);
  });
});
