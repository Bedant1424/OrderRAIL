import { describe, it, expect, beforeEach } from "vitest";
import { ReceiptBuilder, type ReceiptBuilderPayload } from "../lib/printing/receiptBuilder";
import { PrinterAdapter } from "../lib/printing/printerAdapter";
import { printService } from "../lib/printing/PrintService";
import { MockProvider } from "../lib/printing/providers/MockProvider";

describe("Compact Thermal Receipt (58mm / 80mm) Builder Validation Tests", () => {
  beforeEach(() => {
    printService.setProvider(new MockProvider({ simulatedDelayMs: 0 }));
    PrinterAdapter.setSimulatedState(null);
  });

  it("1. Compact Receipt Structure & Typography: Validates exact header, metadata, items, and totals layout", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      address: "123 Main Street",
      phone: "+91 98765 43210",
      billNumber: "INV-000101",
      tableLabel: "Table 04",
      timestamp: "16/08/2026, 12:45 PM",
      paymentMode: "UPI",
      customerName: "Rahul Das",
      customerPhone: "+91 98765 43210",
      items: [
        { id: "i1", name: "Espresso Coffee", qty: 2, price: 120 },
        { id: "i2", name: "Butter Croissant", qty: 1, price: 120 },
        { id: "i3", name: "Masala Dosa", qty: 1, price: 180 }
      ],
      subtotal: 540,
      tax: 27,
      cgst: 13.5,
      sgst: 13.5,
      gstPercentage: 5,
      netTotal: 567,
      paymentStatus: "paid"
    };

    const result = ReceiptBuilder.build(payload, 58);
    const text = result.text;

    // 1. Cafe phone appears in header
    expect(text).toContain("+91 98765 43210");
    // 2. Cafe address remains present
    expect(text).toContain("123 Main Street");
    // 3. PAID RECEIPT present, single line height (no double width command \x1D\x21\x10)
    expect(text).toContain("PAID RECEIPT");
    expect(result.escpos).not.toContain("\x1D\x21\x10");
    // 4. Invoice number present
    expect(text).toContain("INV-000101");
    // 5. Table reference present
    expect(text).toContain("Ref: Table 04");
    // 6. Date present without time
    expect(text).toContain("Date: 16/08/2026");
    expect(text).not.toContain("12:45 PM");
    // 7. Payment mode present
    expect(text).toContain("Mode: UPI");
    // 8-10. Removed redundant fields from bill info
    expect(text).not.toContain("Order #");
    expect(text).not.toContain("Staff:");
    expect(text).not.toContain("Status: PAID");
    // 11. Customer info present
    expect(text).toContain("Customer: Rahul Das");
    expect(text).toContain("Phone: +91 98765 43210");
    // 12-13. Item header QTY ITEM AMOUNT (ITEM DESCRIPTION absent)
    expect(text).toContain("QTY  ITEM");
    expect(text).not.toContain("ITEM DESCRIPTION");
    // 14. Item amounts correct
    expect(text).toContain("2x Espresso Coffee");
    expect(text).toContain("240.00");
    // 15. Subtotal correct
    expect(text).toContain("Subtotal:");
    expect(text).toContain("Rs.540.00");
    // 16-17. Dynamic GST lines when applicable
    expect(text).toContain("CGST (2.5%):");
    expect(text).toContain("Rs.13.50");
    expect(text).toContain("SGST (2.5%):");
    expect(text).toContain("Rs.13.50");
    // 18. Net payable total correct
    expect(text).toContain("NET PAYABLE TOTAL:");
    expect(text).toContain("Rs.567.00");
    // 19. PAYMENT DETAILS section absent
    expect(text).not.toContain("PAYMENT DETAILS:");
    // 20. Footer present
    expect(text).toContain("Thank you for dining with us!");
    expect(text).toContain("Please visit again");
  });

  it("2. GST Disabled: Should omit CGST and SGST lines entirely", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      billNumber: "INV-000102",
      tableLabel: "Table 01",
      items: [{ name: "Artisan Pizza", price: 500, qty: 1 }],
      subtotal: 500,
      tax: 0,
      cgst: 0,
      sgst: 0,
      netTotal: 500,
      paymentStatus: "paid"
    };

    const result = ReceiptBuilder.build(payload, 58);

    expect(result.text).not.toContain("CGST");
    expect(result.text).not.toContain("SGST");
    expect(result.text).toContain("Subtotal:");
    expect(result.text).toContain("Rs.500.00");
    expect(result.text).toContain("NET PAYABLE TOTAL:");
    expect(result.text).toContain("Rs.500.00");
  });

  it("3. Dynamic 18% GST: Should render CGST (9%) and SGST (9%)", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      billNumber: "INV-000103",
      tableLabel: "Table 02",
      items: [{ name: "Special Feast", price: 1000, qty: 1 }],
      subtotal: 1000,
      tax: 180,
      cgst: 90,
      sgst: 90,
      gstPercentage: 18,
      netTotal: 1180,
      paymentStatus: "paid"
    };

    const result = ReceiptBuilder.build(payload, 58);

    expect(result.text).toContain("CGST (9%):");
    expect(result.text).toContain("Rs.90.00");
    expect(result.text).toContain("SGST (9%):");
    expect(result.text).toContain("Rs.90.00");
  });

  it("4. Long Item Names: Wraps cleanly without exceeding column width", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      billNumber: "INV-000104",
      tableLabel: "Table 05",
      items: [
        {
          name: "Super Deluxe Cheese Garlic Mushroom Butter Burger",
          qty: 1,
          price: 350
        }
      ],
      subtotal: 350,
      tax: 0,
      netTotal: 350
    };

    const result = ReceiptBuilder.build(payload, 58);
    const lines = result.text.split("\n");

    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it("5. 80mm Compatibility: Generates valid 48-column receipt", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner 80mm",
      billNumber: "INV-000105",
      tableLabel: "Table 10",
      items: [{ name: "Double Cheese Pizza", qty: 2, price: 400 }],
      subtotal: 800,
      tax: 40,
      cgst: 20,
      sgst: 20,
      gstPercentage: 5,
      netTotal: 840
    };

    const result = ReceiptBuilder.build(payload, 80);
    const lines = result.text.split("\n");

    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(48);
    }
    expect(result.text).toContain("NET PAYABLE TOTAL:");
    expect(result.text).toContain("Rs.840.00");
  });

  it("6. ESC/POS Commands: Includes 24-dot line spacing & reduced line feeds before cut", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner ESCPOS",
      billNumber: "INV-000106",
      tableLabel: "Table 03",
      items: [{ name: "Lemonade", qty: 1, price: 80 }],
      subtotal: 80,
      tax: 0,
      netTotal: 80
    };

    const result = ReceiptBuilder.build(payload, 58);

    expect(result.escpos).toContain("\x1B@"); // INIT
    expect(result.escpos).toContain("\x1B\x32"); // RESET_LINE_SPACING
    expect(result.escpos).toContain("\x1D\x56\x41\x03"); // FEED & CUT
  });

  it("7. End-to-End PrinterAdapter Dispatch: Enqueues compact receipt job successfully", async () => {
    const res = await PrinterAdapter.printReceipt({
      billNumber: "INV-000107",
      tableLabel: "Table 08",
      items: [{ name: "Cold Coffee", qty: 2, price: 160 }],
      subtotal: 320,
      tax: 16,
      netTotal: 336,
      paymentStatus: "paid"
    });

    expect(res.success).toBe(true);

    const history = printService.getJobHistory();
    expect(history.length).toBeGreaterThan(0);

    const lastJob = history[history.length - 1];
    expect(lastJob.type).toBe("RECEIPT");
    expect(lastJob.status).toBe("COMPLETED");
    expect(lastJob.payload.escpos).toContain("\x1B\x32"); // RESET_LINE_SPACING
  });
});
