import { describe, it, expect, beforeEach } from "vitest";
import { ReceiptBuilder, type ReceiptBuilderPayload } from "../lib/printing/receiptBuilder";
import { PrinterAdapter } from "../lib/printing/printerAdapter";
import { printService } from "../lib/printing/PrintService";
import { MockProvider } from "../lib/printing/providers/MockProvider";

describe("Customer Receipt (58mm) Builder & End-to-End Printing Validation Tests", () => {
  beforeEach(() => {
    printService.setProvider(new MockProvider({ simulatedDelayMs: 0 }));
    PrinterAdapter.setSimulatedState(null);
  });

  it("1. Single Item Receipt: Should generate valid 58mm (32 cols) ESC/POS & Text receipt", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "OrderRail Express Cafe",
      billNumber: "INV-501",
      orderNumber: 501,
      tableLabel: "Table 2",
      cashierName: "Alex",
      timestamp: "10:15 AM",
      items: [
        { id: "i1", name: "Cappuccino", qty: 1, price: 140 }
      ],
      subtotal: 140,
      tax: 7,
      netTotal: 147,
      paymentStatus: "paid"
    };

    const result = ReceiptBuilder.build(payload, 58);

    // Text (32 cols) assertions
    expect(result.text).toContain("ORDERRAIL EXPRESS CAFE");
    expect(result.text).toContain("INVOICE #: INV-501");
    expect(result.text).toContain("Ref: Table 2");
    expect(result.text).toContain("Staff: Alex");
    expect(result.text).toContain("1x  Cappuccino");
    expect(result.text).toContain("Rs.140.00");
    expect(result.text).toContain("NET PAYABLE TOTAL:");
    expect(result.text).toContain("Rs.147.00");
    expect(result.text).toContain("[ PAYMENT STATUS: PAID ]");

    // ESC/POS assertions
    expect(result.escpos).toContain("\x1B@"); // INIT
    expect(result.escpos).toContain("ORDERRAIL EXPRESS CAFE");
    expect(result.escpos).toContain("NET PAYABLE TOTAL:");
    expect(result.escpos).toContain("\x1D\x56\x41\x03"); // FEED & CUT
  });

  it("2. Multi-Item Receipt with Taxes & Discount: Should format itemized list, taxes, and discounts", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "OrderRail Pro Bistro",
      billNumber: "INV-502",
      orderNumber: 502,
      tableLabel: "Patio-1",
      timestamp: "11:30 AM",
      items: [
        { id: "i1", name: "Espresso", qty: 2, price: 120 },
        { id: "i2", name: "Avocado Toast", qty: 1, price: 250 }
      ],
      subtotal: 490,
      tax: 24.5,
      discountAmt: 50,
      netTotal: 464.5,
      tenders: [
        { method: "UPI", amount: 464.5 }
      ],
      paymentStatus: "paid"
    };

    const result = ReceiptBuilder.build(payload, 58);

    expect(result.text).toContain("2x  Espresso");
    expect(result.text).toContain("1x  Avocado Toast");
    expect(result.text).toContain("Subtotal:");
    expect(result.text).toContain("Rs.490.00");
    expect(result.text).toContain("CGST (2.5%):");
    expect(result.text).toContain("SGST (2.5%):");
    expect(result.text).toContain("Discount:");
    expect(result.text).toContain("-Rs.50.00");
    expect(result.text).toContain("NET PAYABLE TOTAL:");
    expect(result.text).toContain("Rs.464.50");
    expect(result.text).toContain("UPI");
  });

  it("3. Long Item Names: Should wrap text cleanly across multiple 32-column lines", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "OrderRail Bistro",
      billNumber: "INV-503",
      tableLabel: "Table 5",
      items: [
        {
          id: "i1",
          name: "Super Ultimate Barbecue Deluxe Melt Burger",
          qty: 1,
          price: 320
        }
      ],
      subtotal: 320,
      tax: 0,
      netTotal: 320
    };

    const result = ReceiptBuilder.build(payload, 58);
    const lines = result.text.split("\n");

    const line1 = lines.find((l) => l.includes("1x  Super Ultimate"));
    expect(line1).toBeDefined();
    // Line width should not exceed 32 columns
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it("4. Reprint Receipt Tag: Should contain prominent REPRINT header", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "OrderRail Bistro",
      billNumber: "INV-504",
      tableLabel: "Table 1",
      isReprint: true,
      items: [{ id: "i1", name: "Iced Tea", qty: 1, price: 90 }],
      subtotal: 90,
      tax: 0,
      netTotal: 90
    };

    const result = ReceiptBuilder.build(payload, 58);

    expect(result.text).toContain("REPRINT");
    expect(result.escpos).toContain("REPRINT");
  });

  it("5. End-to-End PrinterAdapter & PrintService Dispatch: Should enqueue 58mm receipt job successfully", async () => {
    const res = await PrinterAdapter.printReceipt({
      billNumber: "INV-999",
      orderNumber: 999,
      tableLabel: "Table 8",
      timestamp: "03:00 PM",
      items: [
        { id: "i1", name: "Flat White", qty: 2, price: 160 }
      ],
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
    expect(lastJob.destination).toBe("BILL_PRINTER");
    expect(lastJob.status).toBe("COMPLETED");
    expect(lastJob.payload.escpos).toBeDefined();
    expect(lastJob.payload.escpos).toContain("\x1D\x56\x41\x03"); // FEED & CUT
    expect(lastJob.payload.formattedText).toContain("2x  Flat White");
  });
});
