import { describe, it, expect, beforeEach } from "vitest";
import { ReceiptBuilder, type ReceiptBuilderPayload } from "@/lib/printing/receiptBuilder";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";
import { printService } from "@/lib/printing/PrintService";
import { MockProvider } from "@/lib/printing/providers/MockProvider";
import { getReceiptSettings, saveReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from "@/lib/billing/receiptSettings";

describe("Cheese Corner — 58mm Thermal Receipt Standardization & Zero-Waste Layout (Sprint 14A/14B)", () => {
  beforeEach(() => {
    localStorage.clear();
    printService.setProvider(new MockProvider({ simulatedDelayMs: 0 }));
    PrinterAdapter.setSimulatedState(null);
  });

  it("1. Global Safe Default: Defaults to 58mm width when settings are uninitialized", () => {
    const settings = getReceiptSettings();
    expect(settings.receiptWidth).toBe("58mm");
    expect(settings.receiptHeader).toBe("Welcome to Cheese Corner");
    expect(settings.thankYouMessage).toContain("Cheese Corner");
  });

  it("2. 58mm Column Geometry: Every line in 58mm output strictly <= 32 characters", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      address: "Shop No. 4, Food Court Market, City Center",
      gstin: "27AAAAA0000A1Z5",
      billNumber: "INV-1001",
      orderNumber: 101,
      tableLabel: "Table 4",
      cashierName: "Counter",
      timestamp: "12:45 PM",
      customerName: "Siddharth Verma",
      customerPhone: "+91 98765 43210",
      items: [
        { id: "1", name: "Loaded Cheese Garlic Bread Deluxe", qty: 2, price: 160 },
        { id: "2", name: "Paneer Tikka Grilled Sandwich", qty: 1, price: 180 },
        { id: "3", name: "Cold Coffee with Vanilla Ice Cream", qty: 2, price: 120 },
      ],
      subtotal: 740,
      tax: 37,
      discountAmt: 40,
      netTotal: 737,
      paymentStatus: "paid",
      tenders: [{ method: "UPI", amount: 737 }],
    };

    const result = ReceiptBuilder.build(payload, 58);
    const lines = result.text.split("\n");

    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }

    // Verify Cheese Corner branding is rendered
    expect(result.text).toContain("CHEESE CORNER");
    expect(result.text).toContain("INVOICE #: INV-1001");
    expect(result.text).toContain("Ref: Table 4");
    expect(result.text).toContain("2x  Loaded Cheese");
    expect(result.text).toContain("Rs.320.00");
    expect(result.text).toContain("NET PAYABLE TOTAL:");
    expect(result.text).toContain("Rs.737.00");
    expect(result.text).toContain("UPI");
  });

  it("3. Paper Savings: Compact streamlined layout eliminates redundant multi-dividers and blank feeds", () => {
    const payload: ReceiptBuilderPayload = {
      billNumber: "INV-1002",
      tableLabel: "Express",
      items: [{ id: "1", name: "Classic Cheese Pizza", qty: 1, price: 220 }],
      subtotal: 220,
      tax: 11,
      netTotal: 231,
      paymentStatus: "paid",
    };

    const result = ReceiptBuilder.build(payload, 58);
    const lines = result.text.split("\n");

    // Total lines should be compact (<= 25 lines for a single item bill)
    expect(lines.length).toBeLessThanOrEqual(25);

    // ESC/POS commands should contain 2 line feeds before cut to advance past thermal head to cutter blade
    expect(result.escpos).toContain("\x0A\x0A\x1D\x56\x41\x03");
    expect(result.escpos).toContain("\x1D\x56\x41\x03"); // Hardware FEED_AND_CUT present
  });

  it("4. PrinterAdapter Width Safety: Automatically resolves to 58mm unless explicitly 80mm", async () => {
    // Unsaved settings -> default 58mm
    const res = await PrinterAdapter.printReceipt({
      billNumber: "INV-888",
      tableLabel: "Table 1",
      items: [{ id: "1", name: "Burger", qty: 1, price: 150 }],
      subtotal: 150,
      tax: 0,
      netTotal: 150,
    });

    expect(res.success).toBe(true);
    const history = printService.getJobHistory();
    const lastJob = history[history.length - 1];
    expect(lastJob.payload.formattedText).toBeDefined();

    // Check line width of dispatched job
    const lines = lastJob.payload.formattedText!.split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it("5. Owner Customization Persistence: Owner can still configure 80mm width if using 80mm hardware", async () => {
    saveReceiptSettings(
      {
        ...DEFAULT_RECEIPT_SETTINGS,
        receiptWidth: "80mm",
      },
      "cafe-80mm"
    );

    const loaded = getReceiptSettings("cafe-80mm");
    expect(loaded.receiptWidth).toBe("80mm");

    const res = await PrinterAdapter.printReceipt({
      billNumber: "INV-777",
      tableLabel: "Table 9",
      items: [{ id: "1", name: "Family Combo Meal", qty: 1, price: 950 }],
      subtotal: 950,
      tax: 47.5,
      netTotal: 997.5,
      cafeId: "cafe-80mm",
    } as any);

    expect(res.success).toBe(true);
    const history = printService.getJobHistory();
    const lastJob = history[history.length - 1];

    // 80mm line width uses 48 columns
    expect(lastJob.payload.formattedText).toContain("=".repeat(48));
  });

  it("6. Fresh Receipt Title vs Reprint: Fresh receipt does NOT contain (REPRINT), explicit reprint DOES contain (REPRINT)", () => {
    const basePayload: ReceiptBuilderPayload = {
      billNumber: "INV-2001",
      tableLabel: "Table 1",
      items: [{ id: "1", name: "Cheese Garlic Bread", qty: 1, price: 160 }],
      subtotal: 160,
      tax: 8,
      netTotal: 168,
      paymentStatus: "paid",
    };

    // Fresh print (isReprint: false or undefined)
    const freshRes = ReceiptBuilder.build({ ...basePayload, isReprint: false }, 58);
    expect(freshRes.text).toContain("PAID RECEIPT");
    expect(freshRes.text).not.toContain("PAID RECEIPT (REPRINT)");
    expect(freshRes.escpos).toContain("PAID RECEIPT\n");
    expect(freshRes.escpos).not.toContain("PAID RECEIPT (REPRINT)");

    // Explicit reprint (isReprint: true)
    const reprintRes = ReceiptBuilder.build({ ...basePayload, isReprint: true }, 58);
    expect(reprintRes.text).toContain("PAID RECEIPT (REPRINT)");
    expect(reprintRes.escpos).toContain("PAID RECEIPT (REPRINT)\n");
  });

  it("7. Zero-Bleed Footer Sequence: ESC/POS places full footer before line feeds and cutter", () => {
    const payload: ReceiptBuilderPayload = {
      billNumber: "INV-2002",
      tableLabel: "Table 2",
      items: [{ id: "1", name: "Cold Coffee", qty: 1, price: 66.75 }],
      subtotal: 66.75,
      tax: 3.34,
      netTotal: 70.09,
      paymentStatus: "paid",
    };

    const res = ReceiptBuilder.build(payload, 58);
    
    // Verify exact sequence at end of ESC/POS stream:
    // "Thank you for dining with us!\n" -> "Please visit again\n" -> "================================\n" -> "\x0A\x0A" -> "\x1D\x56\x41\x03"
    const footerIdx = res.escpos.indexOf("Thank you for dining with us!\n");
    const visitIdx = res.escpos.indexOf("Please visit again\n");
    const dividerIdx = res.escpos.lastIndexOf("================================\n");
    const cutIdx = res.escpos.indexOf("\x1D\x56\x41\x03");

    expect(footerIdx).toBeGreaterThan(0);
    expect(visitIdx).toBeGreaterThan(footerIdx);
    expect(dividerIdx).toBeGreaterThan(visitIdx);
    expect(cutIdx).toBeGreaterThan(dividerIdx);

    // Confirm that 2 line feeds immediately precede the cut command
    expect(res.escpos.endsWith("\x0A\x0A\x1D\x56\x41\x03")).toBe(true);
  });
});
