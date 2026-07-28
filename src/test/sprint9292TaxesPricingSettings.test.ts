import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_TAX_SETTINGS,
  getTaxSettings,
  saveTaxSettings,
  calculateTaxAndTotals,
  type TaxSettings,
} from "@/lib/billing/taxSettings";

describe("Sprint 9.2.9.2 — Taxes & Pricing Settings Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("1. Calculates Tax Exclusive Pricing correctly with GST and Service Charge", () => {
    const settings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 5,
      serviceChargeEnabled: true,
      serviceChargePercentage: 5,
      pricingMode: "exclusive",
      roundingMode: "none",
    };

    const calc = calculateTaxAndTotals(50000, settings); // ₹500.00 base subtotal

    expect(calc.subtotalCents).toBe(50000);
    expect(calc.totalGstCents).toBe(2500); // 5% of 500 = ₹25.00
    expect(calc.cgstCents).toBe(1250); // ₹12.50
    expect(calc.sgstCents).toBe(1250); // ₹12.50
    expect(calc.serviceChargeCents).toBe(2500); // 5% of 500 = ₹25.00
    expect(calc.grandTotalCents).toBe(55000); // 500 + 25 + 25 = ₹550.00
  });

  it("2. Calculates Tax Inclusive Pricing correctly by extracting tax backwards", () => {
    const settings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 5,
      serviceChargeEnabled: false,
      pricingMode: "inclusive",
      roundingMode: "none",
    };

    const calc = calculateTaxAndTotals(52500, settings); // ₹525.00 inclusive base

    expect(calc.grandTotalCents).toBe(52500);
    expect(calc.subtotalCents).toBe(50000); // 525 / 1.05 = ₹500.00
    expect(calc.totalGstCents).toBe(2500); // ₹25.00
  });

  it("3. Performs Bill Rounding to nearest ₹1 and nearest ₹0.50", () => {
    const settingsNearest1: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 5, // Tax = ₹26.35
      pricingMode: "exclusive",
      roundingMode: "nearest_1",
    };

    const calc1 = calculateTaxAndTotals(52700, settingsNearest1); // Subtotal ₹527.00 + 5% GST (₹26.35) = ₹553.35
    expect(calc1.grandTotalCents).toBe(55300); // Rounded to nearest ₹1 (₹553.00)

    const settingsNearestHalf: TaxSettings = {
      ...settingsNearest1,
      roundingMode: "nearest_0_5",
    };

    const calc2 = calculateTaxAndTotals(52700, settingsNearestHalf); // ₹553.35 -> nearest ₹0.50 (₹553.50)
    expect(calc2.grandTotalCents).toBe(55350);
  });

  it("4. Saves and retrieves Tax & Pricing settings from storage", () => {
    const customTax: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstPercentage: 18,
      gstNumber: "29AAAAA1111A1Z8",
      pricingMode: "inclusive",
      serviceChargeEnabled: true,
      serviceChargePercentage: 10,
    };

    saveTaxSettings(customTax, "cafe-99");
    const loaded = getTaxSettings("cafe-99");

    expect(loaded.gstPercentage).toBe(18);
    expect(loaded.gstNumber).toBe("29AAAAA1111A1Z8");
    expect(loaded.pricingMode).toBe("inclusive");
    expect(loaded.serviceChargePercentage).toBe(10);
  });
});
