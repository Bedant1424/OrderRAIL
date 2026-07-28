import { describe, it, expect, beforeEach } from "vitest";
import { saveReceiptSettings, getReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from "@/lib/billing/receiptSettings";
import { saveTaxSettings, getTaxSettings, calculateTaxAndTotals, DEFAULT_TAX_SETTINGS } from "@/lib/billing/taxSettings";
import { savePaymentSettings, getPaymentSettings, DEFAULT_PAYMENT_SETTINGS } from "@/lib/billing/paymentSettings";
import { saveOperationsSettings, getOperationsSettings, getTodayOpenStatus, DEFAULT_OPERATIONS_SETTINGS } from "@/lib/billing/operationsSettings";

describe("Sprint 9.3.2 — Runtime Settings Integration Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("1. Receipt settings affect active runtime configuration", () => {
    saveReceiptSettings(
      {
        ...DEFAULT_RECEIPT_SETTINGS,
        invoicePrefix: "CAF-",
        receiptWidth: "58mm",
        showLogo: false,
        receiptHeader: "Welcome to Gourmet Cafe",
      },
      "cafe-1"
    );

    const loaded = getReceiptSettings("cafe-1");
    expect(loaded.invoicePrefix).toBe("CAF-");
    expect(loaded.receiptWidth).toBe("58mm");
    expect(loaded.showLogo).toBe(false);
    expect(loaded.receiptHeader).toBe("Welcome to Gourmet Cafe");
  });

  it("2. Tax settings affect billing calculation engine", () => {
    saveTaxSettings(
      {
        ...DEFAULT_TAX_SETTINGS,
        gstEnabled: true,
        gstPercentage: 18,
        serviceChargeEnabled: true,
        serviceChargePercentage: 5,
        roundingMode: "nearest_1",
      },
      "cafe-1"
    );

    const loaded = getTaxSettings("cafe-1");
    const calc = calculateTaxAndTotals(10000, loaded); // Rs 100 subtotal

    expect(calc.totalGstCents).toBe(1800); // 18% GST = Rs 18
    expect(calc.serviceChargeCents).toBe(500); // 5% Service Charge = Rs 5
    expect(calc.grandTotalCents).toBe(12300); // Rs 123
  });

  it("3. Payment settings filter active methods and set default method", () => {
    savePaymentSettings(
      {
        ...DEFAULT_PAYMENT_SETTINGS,
        enabledMethods: {
          cash: false,
          upi: true,
          card: true,
          wallet: false,
          bank_transfer: false,
        },
        defaultMethod: "card",
      },
      "cafe-1"
    );

    const loaded = getPaymentSettings("cafe-1");
    expect(loaded.enabledMethods.cash).toBe(false);
    expect(loaded.enabledMethods.upi).toBe(true);
    expect(loaded.defaultMethod).toBe("card");
  });

  it("4. Operations settings control open status and ordering channels", () => {
    saveOperationsSettings(
      {
        ...DEFAULT_OPERATIONS_SETTINGS,
        status: "maintenance",
        enabledChannels: {
          dine_in: false,
          counter: true,
          takeaway: true,
          swiggy: true,
          zomato: true,
        },
      },
      "cafe-1"
    );

    const ops = getOperationsSettings("cafe-1");
    const status = getTodayOpenStatus(ops);

    expect(status.isOpen).toBe(false);
    expect(status.text).toBe("Under Maintenance");
    expect(ops.enabledChannels.dine_in).toBe(false);
  });
});
