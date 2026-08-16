import { describe, it, expect } from "vitest";
import { ReceiptBuilder, type ReceiptBuilderPayload } from "@/lib/printing/receiptBuilder";
import { ESC_POS } from "@/lib/printing/constants";

describe("Thermal Receipt Formatting & Feed/Cut Suite", () => {
  const basePayload: ReceiptBuilderPayload = {
    billId: "bill-1001",
    billNumber: "1001",
    orderId: "ord-1001",
    orderNumber: 4,
    tableLabel: "Table 3",
    cashierName: "John",
    timestamp: "16/08/2026, 19:30:00",
    cafeName: "Cheese Corner",
    gstin: "27AAAAA0000A1Z5",
    address: "123 Main St, Food Street",
    phone: "+919876543210",
    items: [
      { name: "Double Decker Burger", price: 198, qty: 1 },
      { name: "Fries", price: 89, qty: 2 }
    ],
    subtotal: 376,
    tax: 18.8,
    cgst: 9.4,
    sgst: 9.4,
    netTotal: 394.8,
    paymentStatus: "paid",
    thankYouMessage: "Thank you for dining with us!\nPlease visit again",
    footerInfo: "FSSAI LIC: 10020022000123"
  };

  it("1. Address ON / Phone ON renders both address and phone", () => {
    const payload = { ...basePayload, showAddress: true, showPhone: true };
    const text = ReceiptBuilder.buildText(payload, 58);
    const escpos = ReceiptBuilder.buildEscPos(payload, 58);

    expect(text).toContain("123 Main St");
    expect(text).toContain("+919876543210");
    expect(escpos).toContain("123 Main St");
    expect(escpos).toContain("+919876543210");
  });

  it("2. Address ON / Phone OFF renders address only", () => {
    const payload = { ...basePayload, showAddress: true, showPhone: false };
    const text = ReceiptBuilder.buildText(payload, 58);
    const escpos = ReceiptBuilder.buildEscPos(payload, 58);

    expect(text).toContain("123 Main St");
    expect(text).not.toContain("+919876543210");
    expect(escpos).toContain("123 Main St");
    expect(escpos).not.toContain("+919876543210");
  });

  it("3. Address OFF / Phone ON renders phone only", () => {
    const payload = { ...basePayload, showAddress: false, showPhone: true };
    const text = ReceiptBuilder.buildText(payload, 58);
    const escpos = ReceiptBuilder.buildEscPos(payload, 58);

    expect(text).not.toContain("123 Main St");
    expect(text).toContain("+919876543210");
    expect(escpos).not.toContain("123 Main St");
    expect(escpos).toContain("+919876543210");
  });

  it("4. Address OFF / Phone OFF renders neither address nor phone", () => {
    const payload = { ...basePayload, showAddress: false, showPhone: false };
    const text = ReceiptBuilder.buildText(payload, 58);
    const escpos = ReceiptBuilder.buildEscPos(payload, 58);

    expect(text).not.toContain("123 Main St");
    expect(text).not.toContain("+919876543210");
    expect(escpos).not.toContain("123 Main St");
    expect(escpos).not.toContain("+919876543210");
  });

  it("5. Post-footer feed and cut sequence includes exactly 3 explicit line feeds before FEED_AND_CUT", () => {
    const escpos = ReceiptBuilder.buildEscPos(basePayload, 58);
    const lastDividerIdx = escpos.lastIndexOf("================================");
    expect(lastDividerIdx).toBeGreaterThan(-1);

    const cutIndex = escpos.indexOf(ESC_POS.FEED_AND_CUT);
    expect(cutIndex).toBeGreaterThan(lastDividerIdx);

    const betweenDividerAndCut = escpos.substring(lastDividerIdx + 32, cutIndex);
    const lineFeedsCount = (betweenDividerAndCut.match(/\n/g) || []).length;
    // 1 newline from doubleDivider + 3 explicit LINE_FEED = 4 newlines
    expect(lineFeedsCount).toBe(4);

    // Verify no content occurs after FEED_AND_CUT
    const afterCut = escpos.substring(cutIndex + ESC_POS.FEED_AND_CUT.length);
    expect(afterCut.trim()).toBe("");
  });

  it("6. Uses RESET_LINE_SPACING instead of forced 24-dot line spacing", () => {
    const escpos = ReceiptBuilder.buildEscPos(basePayload, 58);
    expect(escpos).toContain(ESC_POS.RESET_LINE_SPACING);
    expect(escpos).not.toContain(ESC_POS.SET_LINE_SPACING_24);
  });

  it("7. Correctly formats 58mm (32 cols) and 80mm (48 cols) widths", () => {
    const text58 = ReceiptBuilder.buildText(basePayload, 58);
    const text80 = ReceiptBuilder.buildText(basePayload, 80);

    const lines58 = text58.split("\n");
    const lines80 = text80.split("\n");

    // Divider length matches width
    expect(lines58[0].length).toBe(32);
    expect(lines80[0].length).toBe(48);
  });

  it("8. Wraps long item names cleanly without truncating price or quantity", () => {
    const longItemPayload: ReceiptBuilderPayload = {
      ...basePayload,
      items: [
        { name: "Extra Large Double Cheese Chicken Supreme Burger with Jalapeños", price: 299, qty: 1 }
      ]
    };

    const text = ReceiptBuilder.buildText(longItemPayload, 58);
    expect(text).toContain("299.00");
    expect(text).toContain("1x ");
    expect(text).toContain("Extra Large Double");
  });
});
