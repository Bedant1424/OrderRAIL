import { describe, it, expect } from "vitest";
import { KotBuilder, type KotBuilderPayload } from "@/lib/printing/kotBuilder";
import { ReceiptBuilder } from "@/lib/printing/receiptBuilder";
import { ESC_POS } from "@/lib/printing/constants";

describe("Sprint 14H — KOT Header Space Reduction & Geometry Audit (58mm)", () => {
  const standardKotPayload: KotBuilderPayload = {
    kotNumber: 48,
    orderNumber: 48,
    tableLabel: "Table 4",
    timestamp: "12:45 PM",
    orderSource: "DINE_IN",
    items: [
      {
        id: "item-1",
        name: "Peri Peri Fries",
        qty: 1,
        price: 99,
        notes: "Extra crispy",
      },
      {
        id: "item-2",
        name: "Cold Coffee",
        qty: 2,
        price: 120,
        modifiers: ["Less sugar", "Extra ice"],
      },
    ],
    specialInstructions: "Serve fries first",
  };

  it("1. Header Space Reduction: KOT plain text must NOT contain redundant 'KITCHEN KOT' title", () => {
    const result = KotBuilder.build(standardKotPayload, 58);

    // Redundant header must be absent
    expect(result.text).not.toContain("KITCHEN KOT");
    expect(result.text).not.toContain("*** KITCHEN KOT ***");

    // Useful identifying metadata must start immediately
    expect(result.text).toContain("TABLE 4");
    expect(result.text).toContain("DINE IN");
    expect(result.text).toContain("KOT #: 48");
    expect(result.text).toContain("Order #: 48");
    expect(result.text).toContain("Time: 12:45 PM");
  });

  it("2. ESC/POS Binary Stream: Must NOT contain 'KITCHEN KOT' command bytes", () => {
    const result = KotBuilder.build(standardKotPayload, 58);

    expect(result.escpos).not.toContain("KITCHEN KOT");
    expect(result.escpos).toContain("TABLE 4");
  });

  it("3. Order & Item Information Preservation: Retains all quantities, items, modifiers, notes, and footer", () => {
    const result = KotBuilder.build(standardKotPayload, 58);

    expect(result.text).toContain("1x   Peri Peri Fries");
    expect(result.text).toContain("> Extra crispy");
    expect(result.text).toContain("2x   Cold Coffee");
    expect(result.text).toContain("> Less sugar");
    expect(result.text).toContain("> Extra ice");
    expect(result.text).toContain("SPECIAL INSTRUCTIONS:");
    expect(result.text).toContain("Serve fries first");
    expect(result.text).toContain("TOTAL ITEMS: 3");
  });

  it("4. 58mm / 32-Column Strict Geometry: No line exceeds 32 characters", () => {
    const result = KotBuilder.build(standardKotPayload, 58);
    const lines = result.text.split("\n");

    expect(lines.length).toBeGreaterThan(5);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it("5. Cutter Safety Feed Sequence: Preserves 2 line feeds before FEED_AND_CUT (Sprint 14E Fix)", () => {
    const result = KotBuilder.build(standardKotPayload, 58);

    // Must end with 2 line feeds followed by FEED_AND_CUT to clear mechanical printhead-to-blade gap
    const expectedEndSequence = `${ESC_POS.LINE_FEED}${ESC_POS.LINE_FEED}${ESC_POS.FEED_AND_CUT}`;
    expect(result.escpos.endsWith(expectedEndSequence)).toBe(true);
  });

  it("6. Non-Dine-In Sources (Takeaway / Swiggy / Zomato): Formats table banner cleanly without KITCHEN KOT", () => {
    const takeawayResult = KotBuilder.build(
      {
        ...standardKotPayload,
        orderSource: "TAKEAWAY",
        tableLabel: "Express",
      },
      58
    );

    expect(takeawayResult.text).not.toContain("KITCHEN KOT");
    expect(takeawayResult.text).toContain("TAKEAWAY");

    const swiggyResult = KotBuilder.build(
      {
        ...standardKotPayload,
        orderSource: "SWIGGY",
        externalOrderRef: "SW-8891",
      },
      58
    );

    expect(swiggyResult.text).not.toContain("KITCHEN KOT");
    expect(swiggyResult.text).toContain("SWIGGY #SW-8891");
  });

  it("7. Receipt / Bill Printing Unaffected: ReceiptBuilder continues to print standard bill header and footer", () => {
    const receipt = ReceiptBuilder.build({
      billNumber: 101,
      tableLabel: "Table 4",
      items: [{ name: "Peri Peri Fries", qty: 1, price: 99 }],
      subtotal: 99,
      tax: 4.95,
      netTotal: 103.95,
      paymentStatus: "paid",
    });

    expect(receipt.text).toContain("CHEESE CORNER");
    expect(receipt.text).toContain("PAID RECEIPT");
    expect(receipt.text).toContain("NET PAYABLE TOTAL:");
    expect(receipt.text).toContain("Please visit again");
  });
});
