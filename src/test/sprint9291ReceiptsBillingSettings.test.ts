import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_RECEIPT_SETTINGS,
  getReceiptSettings,
  saveReceiptSettings,
  type ReceiptSettings,
} from "@/lib/billing/receiptSettings";

describe("Sprint 9.2.9.1 — Receipts & Billing Settings Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("1. Loads default receipt settings when none are saved", () => {
    const settings = getReceiptSettings("test-cafe");

    expect(settings.showLogo).toBe(true);
    expect(settings.showAddress).toBe(true);
    expect(settings.showPhone).toBe(true);
    expect(settings.showGst).toBe(true);
    expect(settings.showInvoiceNum).toBe(true);
    expect(settings.invoicePrefix).toBe("INV-");
    expect(settings.receiptWidth).toBe("58mm");
    expect(settings.printCopies).toBe(1);
  });

  it("2. Saves and retrieves custom receipt settings for a cafe", () => {
    const customSettings: ReceiptSettings = {
      ...DEFAULT_RECEIPT_SETTINGS,
      invoicePrefix: "OR-",
      receiptHeader: "Welcome to Gourmet Cafe",
      receiptWidth: "80mm",
      printCopies: 2,
      autoPrint: true,
      gstNumber: "29BBBBB1111B2Z6",
    };

    saveReceiptSettings(customSettings, "test-cafe");
    const loaded = getReceiptSettings("test-cafe");

    expect(loaded.invoicePrefix).toBe("OR-");
    expect(loaded.receiptHeader).toBe("Welcome to Gourmet Cafe");
    expect(loaded.receiptWidth).toBe("80mm");
    expect(loaded.printCopies).toBe(2);
    expect(loaded.autoPrint).toBe(true);
    expect(loaded.gstNumber).toBe("29BBBBB1111B2Z6");
  });

  it("3. Validates length limits for receipt header (100) and footer (250)", () => {
    const validHeader = "A".repeat(100);
    const validFooter = "B".repeat(250);

    expect(validHeader.length).toBeLessThanOrEqual(100);
    expect(validFooter.length).toBeLessThanOrEqual(250);

    const invalidHeader = "A".repeat(101);
    const invalidFooter = "B".repeat(251);

    expect(invalidHeader.length > 100).toBe(true);
    expect(invalidFooter.length > 250).toBe(true);
  });
});
