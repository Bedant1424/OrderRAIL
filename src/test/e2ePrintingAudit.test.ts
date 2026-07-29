import { describe, it, expect, beforeEach } from "vitest";
import { printService } from "../lib/printing/PrintService";
import { PrinterAdapter } from "../lib/printing/printerAdapter";
import { MockProvider } from "../lib/printing/providers/MockProvider";
import { KotBuilder } from "../lib/printing/kotBuilder";
import { ReceiptBuilder } from "../lib/printing/receiptBuilder";

describe("Production End-to-End Printing Audit Suite (58mm Unified Profile)", () => {
  beforeEach(() => {
    printService.setProvider(new MockProvider({ simulatedDelayMs: 0 }));
    PrinterAdapter.setSimulatedState(null);
  });

  it("1. Developer Printing Page: Test Receipt Action", async () => {
    const success = await printService.printTest("BILL_PRINTER");
    expect(success).toBe(true);
  });

  it("2. Staff Dashboard / POS: Print KOT Action", async () => {
    const res = await PrinterAdapter.printKot({
      orderId: "ord-staff-1",
      kotNumber: 101,
      orderNumber: 101,
      tableLabel: "Table 3",
      timestamp: "10:00 AM",
      items: [{ id: "i1", name: "Masala Chai", qty: 2, price: 40 }]
    });

    expect(res.success).toBe(true);

    const history = printService.getJobHistory();
    const lastJob = history[history.length - 1];
    expect(lastJob.type).toBe("KOT");
    expect(lastJob.destination).toBe("KOT_PRINTER");
    expect(lastJob.payload.escpos).toContain("Masala Chai");
    expect(lastJob.payload.formattedText.split("\n")[0].length).toBeLessThanOrEqual(32);
  });

  it("3. Staff Dashboard / POS: Reprint KOT Action", async () => {
    const res = await PrinterAdapter.printKot({
      orderId: "ord-staff-2",
      kotNumber: 102,
      orderNumber: 102,
      tableLabel: "Table 3",
      isReprint: true,
      items: [{ id: "i1", name: "Butter Croissant", qty: 1, price: 120 }]
    });

    expect(res.success).toBe(true);

    const history = printService.getJobHistory();
    const lastJob = history[history.length - 1];
    expect(lastJob.payload.formattedText).toContain("** REPRINT **");
  });

  it("4. Counter POS: Print Receipt & Pay & Print Action", async () => {
    const res = await PrinterAdapter.printReceipt({
      billId: "bill-counter-1",
      billNumber: "INV-801",
      orderId: "ord-801",
      orderNumber: 801,
      tableLabel: "Table 5",
      cashierName: "Sarah",
      timestamp: "02:15 PM",
      items: [{ id: "i1", name: "Iced Caramel Macchiato", qty: 2, price: 210 }],
      subtotal: 420,
      tax: 21,
      netTotal: 441,
      paymentStatus: "paid",
      tenders: [{ method: "CARD", amount: 441 }]
    });

    expect(res.success).toBe(true);

    const history = printService.getJobHistory();
    const lastJob = history[history.length - 1];
    expect(lastJob.type).toBe("RECEIPT");
    expect(lastJob.destination).toBe("BILL_PRINTER");
    expect(lastJob.payload.escpos).toContain("Iced Caramel");
    expect(lastJob.payload.escpos).toContain("Macchiato");
    expect(lastJob.payload.formattedText).toContain("NET PAYABLE TOTAL:");
  });

  it("5. Owner Dashboard: Reprint Receipt Action", async () => {
    const res = await PrinterAdapter.printReceipt({
      billId: "bill-owner-1",
      billNumber: "INV-901",
      tableLabel: "Express Takeaway",
      isReprint: true,
      items: [{ id: "i1", name: "Filter Coffee", qty: 1, price: 60 }],
      subtotal: 60,
      tax: 3,
      netTotal: 63,
      paymentStatus: "paid"
    });

    expect(res.success).toBe(true);

    const history = printService.getJobHistory();
    const lastJob = history[history.length - 1];
    expect(lastJob.payload.formattedText).toContain("** REPRINT RECEIPT **");
  });

  it("6. Unified Profile Check: KotBuilder and ReceiptBuilder both render 32 columns max width", () => {
    const kot = KotBuilder.build({
      kotNumber: 1,
      orderNumber: 1,
      tableLabel: "Table 1",
      items: [{ name: "Super Ultra Extremely Long Dish Name That Must Wrap Cleanly", qty: 1 }]
    });

    const receipt = ReceiptBuilder.build({
      billNumber: 1,
      tableLabel: "Table 1",
      items: [{ name: "Super Ultra Extremely Long Dish Name That Must Wrap Cleanly", qty: 1, price: 100 }],
      subtotal: 100,
      tax: 5,
      netTotal: 105
    });

    for (const line of kot.text.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(32);
    }

    for (const line of receipt.text.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });
});
