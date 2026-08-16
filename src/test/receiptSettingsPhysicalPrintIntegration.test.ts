import { describe, it, expect, beforeEach } from "vitest";
import { ReceiptBuilder, type ReceiptBuilderPayload } from "../lib/printing/receiptBuilder";
import { PrinterAdapter } from "../lib/printing/printerAdapter";
import { printService } from "../lib/printing/PrintService";
import { MockProvider } from "../lib/printing/providers/MockProvider";
import { saveReceiptSettings, DEFAULT_RECEIPT_SETTINGS, type ReceiptSettings } from "../lib/billing/receiptSettings";

describe("Physical Receipt Settings Integration Suite", () => {
  const testCafeId = "cafe-settings-test";

  beforeEach(() => {
    printService.setProvider(new MockProvider({ simulatedDelayMs: 0 }));
    PrinterAdapter.setSimulatedState(null);
    localStorage.clear();
  });

  it("1 & 2. showAddress toggle: Controls presence of cafe address without altering Business Profile", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      address: "456 Food Court Road",
      billNumber: "INV-101",
      tableLabel: "Table 1",
      items: [{ name: "Coffee", price: 100, qty: 1 }],
      subtotal: 100,
      tax: 5,
      netTotal: 105,
      showAddress: true,
    };

    const textWithAddr = ReceiptBuilder.buildText(payload, 58);
    expect(textWithAddr).toContain("456 Food Court Road");

    const payloadNoAddr: ReceiptBuilderPayload = {
      ...payload,
      showAddress: false,
    };
    const textNoAddr = ReceiptBuilder.buildText(payloadNoAddr, 58);
    expect(textNoAddr).not.toContain("456 Food Court Road");
  });

  it("3 & 4. showPhone toggle: Controls presence of cafe phone without altering Business Profile", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      phone: "+91 99999 88888",
      billNumber: "INV-102",
      tableLabel: "Table 2",
      items: [{ name: "Tea", price: 50, qty: 1 }],
      subtotal: 50,
      tax: 0,
      netTotal: 50,
      showPhone: true,
    };

    const textWithPhone = ReceiptBuilder.buildText(payload, 58);
    expect(textWithPhone).toContain("+91 99999 88888");

    const payloadNoPhone: ReceiptBuilderPayload = {
      ...payload,
      showPhone: false,
    };
    const textNoPhone = ReceiptBuilder.buildText(payloadNoPhone, 58);
    expect(textNoPhone).not.toContain("+91 99999 88888");
  });

  it("5, 6 & 7. showGst toggle + gstNumber: Controls GSTIN header line while tax calculations remain untouched", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      gstin: "27ABCDE1234F1Z9",
      billNumber: "INV-103",
      tableLabel: "Table 3",
      items: [{ name: "Burger", price: 200, qty: 1 }],
      subtotal: 200,
      tax: 10,
      cgst: 5,
      sgst: 5,
      netTotal: 210,
      showGst: true,
    };

    const textWithGst = ReceiptBuilder.buildText(payload, 58);
    expect(textWithGst).toContain("GSTIN: 27ABCDE1234F1Z9");
    expect(textWithGst).toContain("CGST (2.5%):");
    expect(textWithGst).toContain("Rs.5.00");

    const payloadNoGst: ReceiptBuilderPayload = {
      ...payload,
      showGst: false,
    };
    const textNoGst = ReceiptBuilder.buildText(payloadNoGst, 58);
    expect(textNoGst).not.toContain("GSTIN: 27ABCDE1234F1Z9");
    // Tax calculations MUST remain present even when GSTIN header is hidden
    expect(textNoGst).toContain("CGST (2.5%):");
    expect(textNoGst).toContain("Rs.5.00");
    expect(textNoGst).toContain("NET PAYABLE TOTAL:");
    expect(textNoGst).toContain("Rs.210.00");
  });

  it("8 & 9. showInvoiceNum toggle: Controls display of existing bill number", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      billNumber: "INV-000999",
      tableLabel: "Table 4",
      items: [{ name: "Pizza", price: 400, qty: 1 }],
      subtotal: 400,
      tax: 0,
      netTotal: 400,
      showInvoiceNum: true,
    };

    const textWithInv = ReceiptBuilder.buildText(payload, 58);
    expect(textWithInv).toContain("INV-000999");

    const payloadNoInv: ReceiptBuilderPayload = {
      ...payload,
      showInvoiceNum: false,
    };
    const textNoInv = ReceiptBuilder.buildText(payloadNoInv, 58);
    expect(textNoInv).not.toContain("INV-000999");
    expect(textNoInv).toContain("Ref: Table 4");
  });

  it("10 & 11. receiptHeader note: Renders custom header note when present, omits when empty", () => {
    const payloadCustomHeader: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      receiptHeader: "Freshly Baked Every Day",
      billNumber: "INV-105",
      tableLabel: "Table 5",
      items: [{ name: "Croissant", price: 120, qty: 1 }],
      subtotal: 120,
      tax: 0,
      netTotal: 120,
    };

    const textCustom = ReceiptBuilder.buildText(payloadCustomHeader, 58);
    expect(textCustom).toContain("Freshly Baked Every Day");

    const payloadEmptyHeader: ReceiptBuilderPayload = {
      ...payloadCustomHeader,
      receiptHeader: "",
    };
    const textEmpty = ReceiptBuilder.buildText(payloadEmptyHeader, 58);
    expect(textEmpty).not.toContain("Freshly Baked Every Day");
  });

  it("12 & 13. thankYouMessage: Renders custom thank-you message or falls back to default", () => {
    const payloadCustomMsg: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      thankYouMessage: "Have a wonderful day ahead!\nSee you soon",
      billNumber: "INV-106",
      tableLabel: "Table 6",
      items: [{ name: "Lemonade", price: 80, qty: 1 }],
      subtotal: 80,
      tax: 0,
      netTotal: 80,
    };

    const textCustom = ReceiptBuilder.buildText(payloadCustomMsg, 58);
    expect(textCustom).toContain("Have a wonderful day ahead!");
    expect(textCustom).toContain("See you soon");

    const payloadDefaultMsg: ReceiptBuilderPayload = {
      ...payloadCustomMsg,
      thankYouMessage: undefined,
    };
    const textDefault = ReceiptBuilder.buildText(payloadDefaultMsg, 58);
    expect(textDefault).toContain("Thank you for dining with us!");
    expect(textDefault).toContain("Please visit again");
  });

  it("14 & 15. footerInfo: Renders optional footer info (e.g. FSSAI lic) when present", () => {
    const payloadFooter: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      footerInfo: "FSSAI LIC NO: 10020030040055\nInstagram: @cheesecorner",
      billNumber: "INV-107",
      tableLabel: "Table 7",
      items: [{ name: "Pasta", price: 250, qty: 1 }],
      subtotal: 250,
      tax: 0,
      netTotal: 250,
    };

    const textFooter = ReceiptBuilder.buildText(payloadFooter, 58);
    expect(textFooter).toContain("FSSAI LIC NO: 10020030040055");
    expect(textFooter).toContain("Instagram: @cheesecorner");

    const payloadNoFooter: ReceiptBuilderPayload = {
      ...payloadFooter,
      footerInfo: "",
    };
    const textNoFooter = ReceiptBuilder.buildText(payloadNoFooter, 58);
    expect(textNoFooter).not.toContain("FSSAI LIC NO: 10020030040055");
  });

  it("16, 17 & 18. printCopies setting: Enqueues 1, 2, or 3 print jobs based on PrinterAdapter settings", async () => {
    // 1 Copy Test
    saveReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, printCopies: 1 }, testCafeId);
    await PrinterAdapter.printReceipt({
      cafeId: testCafeId,
      billNumber: "INV-COP-1",
      tableLabel: "Table 1",
      items: [{ name: "Espresso", price: 100, qty: 1 }],
      subtotal: 100,
      tax: 0,
      netTotal: 100,
    });
    let history = printService.getJobHistory();
    expect(history.length).toBe(1);

    // 2 Copies Test
    saveReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, printCopies: 2 }, testCafeId);
    await PrinterAdapter.printReceipt({
      cafeId: testCafeId,
      billNumber: "INV-COP-2",
      tableLabel: "Table 2",
      items: [{ name: "Espresso", price: 100, qty: 1 }],
      subtotal: 100,
      tax: 0,
      netTotal: 100,
    });
    history = printService.getJobHistory();
    expect(history.length).toBe(1 + 2);

    // 3 Copies Test
    saveReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, printCopies: 3 }, testCafeId);
    await PrinterAdapter.printReceipt({
      cafeId: testCafeId,
      billNumber: "INV-COP-3",
      tableLabel: "Table 3",
      items: [{ name: "Espresso", price: 100, qty: 1 }],
      subtotal: 100,
      tax: 0,
      netTotal: 100,
    });
    history = printService.getJobHistory();
    expect(history.length).toBe(1 + 2 + 3);
  });

  it("19 & 20. 58mm vs 80mm Column Bounds Verification", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner Bistro",
      receiptHeader: "Very Long Receipt Header Sentence That Needs Safe Wrapping Across Columns",
      address: "123 Very Long Address Line In The Center Of The City Near Landmark",
      thankYouMessage: "Thank you for dining at Cheese Corner Bistro we appreciate your business very much",
      footerInfo: "FSSAI LIC NO: 10020030040055 / Follow us on Instagram @cheesecornerbistro",
      billNumber: "INV-888888",
      tableLabel: "Table 12",
      items: [{ name: "Super Cheese Burst Special Pizza", price: 450, qty: 1 }],
      subtotal: 450,
      tax: 22.5,
      netTotal: 472.5,
    };

    // 58mm test (32 columns)
    const text58 = ReceiptBuilder.buildText(payload, 58);
    for (const line of text58.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(32);
    }

    // 80mm test (48 columns)
    const text80 = ReceiptBuilder.buildText(payload, 80);
    for (const line of text80.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(48);
    }
  });

  it("21. Real Payment Mode Integrity: Retains UPI/CASH/CARD and never defaults to Paid when tender data exists", () => {
    const payload: ReceiptBuilderPayload = {
      cafeName: "Cheese Corner",
      billNumber: "INV-PAY-1",
      tableLabel: "Table 1",
      paymentStatus: "paid",
      paymentMode: "UPI",
      tenders: [{ method: "UPI", amount: 250 }],
      items: [{ name: "Cold Coffee", price: 250, qty: 1 }],
      subtotal: 250,
      tax: 0,
      netTotal: 250,
    };

    const text = ReceiptBuilder.buildText(payload, 58);
    expect(text).toContain("Mode: UPI");
    expect(text).not.toContain("Mode: Paid");
  });

  it("22. Historical Bill Safety: Changing receipt display settings does not alter stored financial values", () => {
    const billFinancials = {
      subtotal: 500,
      tax: 25,
      netTotal: 525,
    };

    saveReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, showGst: false, showAddress: false }, testCafeId);

    const payload: ReceiptBuilderPayload = {
      cafeId: testCafeId,
      cafeName: "Cheese Corner",
      billNumber: "INV-HIST-1",
      tableLabel: "Table 1",
      items: [{ name: "Combo", price: 500, qty: 1 }],
      subtotal: billFinancials.subtotal,
      tax: billFinancials.tax,
      netTotal: billFinancials.netTotal,
    };

    const text = ReceiptBuilder.buildText(payload, 58);
    expect(text).toContain("Subtotal:              Rs.500.00");
    expect(text).toContain("CGST (2.5%):            Rs.12.50");
    expect(text).toContain("SGST (2.5%):            Rs.12.50");
    expect(text).toContain("NET PAYABLE TOTAL:     Rs.525.00");
  });

  /**
   * Note on invoicePrefix:
   * invoicePrefix is deferred at receipt rendering time because modifying invoicePrefix
   * on existing bills during receipt rendering would break the fundamental invariant:
   * "Stored bill invoice number == printed invoice number".
   * Invoice generation in buildInvoiceRecords() already uses receiptSettings.invoicePrefix
   * during bill creation.
   */
});
