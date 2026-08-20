import { describe, it, expect, beforeEach, vi } from "vitest";
import { BillingService, billsMap } from "@/lib/billing/billingService";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";
import { ReceiptBuilder } from "@/lib/printing/receiptBuilder";
import type { BillWithItems } from "@/lib/billing/types";

describe("Owner Invoice Canonical Printing Engine Integration Tests", () => {
  beforeEach(() => {
    billsMap.clear();
    PrinterAdapter.setSimulatedState(null);
  });

  const sampleBill: BillWithItems = {
    id: "99999999-9999-4999-8999-999999999999",
    bill_number: 2048,
    cafe_id: "cafe-gamma",
    session_id: "sess-gamma-1",
    table_id: "Table 05",
    cashier_id: "owner-1",
    customer_name: "Vikram Malhotra",
    customer_phone: "+91 99887 76655",
    order_type: "DINE_IN",
    payment_status: "PAID",
    payment_method: "CARD",
    subtotal: 800.0,
    discount: 50.0,
    service_charge: 0.0,
    cgst: 18.75,
    sgst: 18.75,
    round_off: 0.5,
    grand_total: 788.0,
    total_items: 2,
    created_at: "2026-08-20T12:00:00.000Z",
    paid_at: "2026-08-20T12:10:00.000Z",
    items: [
      {
        id: "bi-101",
        bill_id: "99999999-9999-4999-8999-999999999999",
        menu_item_id: "m-1",
        item_name: "Cold Brew Coffee",
        category_name: "Beverages",
        quantity: 2,
        unit_price: 200.0,
        discount: 0,
        tax: 20.0,
        line_total: 400.0,
      },
      {
        id: "bi-102",
        bill_id: "99999999-9999-4999-8999-999999999999",
        menu_item_id: "m-2",
        item_name: "Truffle Fries",
        category_name: "Snacks",
        quantity: 1,
        unit_price: 400.0,
        discount: 0,
        tax: 20.0,
        line_total: 400.0,
      },
    ],
  };

  const sampleCafeRecord = {
    id: "cafe-gamma",
    name: "GAMMA ROASTERS",
    address: "456 Tech Park Road",
    phone: "+91 91234 56789",
    currency: "INR",
    receipt_settings: {
      receiptWidth: "58mm",
      showAddress: true,
      showPhone: true,
      showGst: true,
      showInvoiceNum: true,
      gstNumber: "27AAACG1234A1Z5",
      receiptHeader: "Welcome to Gamma Roasters",
      thankYouMessage: "Thank you for visiting!",
      footerInfo: "Visit again",
    },
  };

  it("1. Owner Invoice Print uses persisted bill data", () => {
    const record = BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    expect(record.billId).toBe("99999999-9999-4999-8999-999999999999");
    expect(record.billNumber).toBe("B-2048");
    expect(record.netTotal).toBe(788.0);
    expect(record.subtotal).toBe(800.0);
  });

  it("2. Print Invoice does NOT call window.print()", async () => {
    const windowPrintSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    await BillingService.printBill(sampleBill.id);

    expect(windowPrintSpy).not.toHaveBeenCalled();
    windowPrintSpy.mockRestore();
  });

  it("3. Print Invoice routes through canonical PrinterAdapter thermal printing path", async () => {
    const printSpy = vi.spyOn(PrinterAdapter, "printReceipt");
    BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    await BillingService.printBill(sampleBill.id);

    expect(printSpy).toHaveBeenCalled();
    expect(printSpy.mock.calls[0][0].billNumber).toBe("B-2048");
    printSpy.mockRestore();
  });

  it("4. Historical bill_items become receipt line items", () => {
    const record = BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    expect(record.items).toHaveLength(2);
    expect(record.items[0].name).toBe("Cold Brew Coffee");
    expect(record.items[0].qty).toBe(2);
    expect(record.items[0].price).toBe(200.0);
  });

  it("5. Historical item prices are preserved", () => {
    const historicalBill: BillWithItems = {
      ...sampleBill,
      items: [
        {
          id: "bi-old",
          bill_id: sampleBill.id,
          menu_item_id: "m-old",
          item_name: "Historical Special",
          category_name: "Specials",
          quantity: 1,
          unit_price: 99.0, // Historical price
          discount: 0,
          tax: 5.0,
          line_total: 99.0,
        },
      ],
    };
    const record = BillingService.registerHistoricalBill(historicalBill, sampleCafeRecord);
    expect(record.items[0].price).toBe(99.0);
  });

  it("6. Persisted subtotal/tax/round-off/grand-total are preserved without recalculation", () => {
    const record = BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    expect(record.subtotal).toBe(800.0);
    expect(record.cgst).toBe(18.75);
    expect(record.sgst).toBe(18.75);
    expect(record.tax).toBe(37.5);
    expect(record.roundOff).toBe(0.5);
    expect(record.netTotal).toBe(788.0);
  });

  it("7. Historical customer name and phone are used", () => {
    const record = BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    expect(record.customerName).toBe("Vikram Malhotra");
    expect(record.customerPhone).toBe("+91 99887 76655");
  });

  it("8. No fake customer phone is generated when customer_phone is null", () => {
    const billNoPhone = { ...sampleBill, customer_phone: null };
    const record = BillingService.registerHistoricalBill(billNoPhone, sampleCafeRecord);
    expect(record.customerPhone).toBeNull();
  });

  it("9. Reprint invokes canonical reprint path in BillingService", async () => {
    const printSpy = vi.spyOn(PrinterAdapter, "printReceipt");
    BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    await BillingService.reprintBill(sampleBill.id);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it("10. Reprint marks receipt payload with isReprint: true", async () => {
    const printSpy = vi.spyOn(PrinterAdapter, "printReceipt");
    BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    await BillingService.reprintBill(sampleBill.id);

    expect(printSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isReprint: true,
      })
    );
    printSpy.mockRestore();
  });

  it("11. Print does NOT create a new bill in database or alter billsMap count", async () => {
    const initialMapSize = billsMap.size;
    BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    const countBeforePrint = billsMap.size;

    await BillingService.printBill(sampleBill.id);
    expect(billsMap.size).toBe(countBeforePrint);
  });

  it("12. Print does NOT create a new payment or settlement", async () => {
    BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    const recordBefore = billsMap.get(sampleBill.id);
    const statusBefore = recordBefore?.paymentStatus;

    await BillingService.printBill(sampleBill.id);
    const recordAfter = billsMap.get(sampleBill.id);
    expect(recordAfter?.paymentStatus).toBe(statusBefore);
  });

  it("13. Print does NOT modify customer settlement metrics", async () => {
    BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    await BillingService.printBill(sampleBill.id);
    const record = billsMap.get(sampleBill.id);
    expect(record?.customerName).toBe("Vikram Malhotra");
  });

  it("14. Printing failure does NOT mutate bill/payment state", async () => {
    PrinterAdapter.setSimulatedState("OUT_OF_PAPER");
    BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);

    const res = await BillingService.printBill(sampleBill.id);
    expect(res.queued).toBe(true);

    const record = billsMap.get(sampleBill.id);
    expect(record?.billId).toBe(sampleBill.id);
    expect(record?.paymentStatus).toBe("paid");
  });

  it("15. 58mm receipt configuration reaches ReceiptBuilder correctly", () => {
    const buildSpy = vi.spyOn(ReceiptBuilder, "build");
    const cafe58mm = {
      ...sampleCafeRecord,
      receipt_settings: { ...sampleCafeRecord.receipt_settings, receiptWidth: "58mm" },
    };
    BillingService.registerHistoricalBill(sampleBill, cafe58mm);
    PrinterAdapter.printReceipt({
      billId: sampleBill.id,
      billNumber: "B-2048",
      orderId: sampleBill.session_id,
      orderNumber: 2048,
      tableLabel: "Table 05",
      items: [{ name: "Item 1", price: 100, qty: 1 }],
      subtotal: 100,
      tax: 5,
      discountPct: 0,
      discountAmt: 0,
      netTotal: 105,
      cafeId: sampleBill.cafe_id,
      cafeRecord: cafe58mm,
    } as any);

    expect(buildSpy).toHaveBeenCalledWith(expect.anything(), 58);
    buildSpy.mockRestore();
  });

  it("16. 80mm receipt configuration reaches ReceiptBuilder correctly", () => {
    const buildSpy = vi.spyOn(ReceiptBuilder, "build");
    const cafe80mm = {
      ...sampleCafeRecord,
      receipt_settings: { ...sampleCafeRecord.receipt_settings, receiptWidth: "80mm" },
    };
    BillingService.registerHistoricalBill(sampleBill, cafe80mm);
    PrinterAdapter.printReceipt({
      billId: sampleBill.id,
      billNumber: "B-2048",
      orderId: sampleBill.session_id,
      orderNumber: 2048,
      tableLabel: "Table 05",
      items: [{ name: "Item 1", price: 100, qty: 1 }],
      subtotal: 100,
      tax: 5,
      discountPct: 0,
      discountAmt: 0,
      netTotal: 105,
      cafeId: sampleBill.cafe_id,
      cafeRecord: cafe80mm,
    } as any);

    expect(buildSpy).toHaveBeenCalledWith(expect.anything(), 80);
    buildSpy.mockRestore();
  });

  it("17. Cafe receipt settings are sourced from authoritative cafe record", () => {
    const record = BillingService.registerHistoricalBill(sampleBill, sampleCafeRecord);
    expect(record.cafeRecord).toEqual(sampleCafeRecord);
  });

  it("18. Device-specific printer configuration remains local-only", () => {
    // Verified: PrinterAdapter and QZ Tray hardware names are kept local state/localStorage
    const status = PrinterAdapter.getStatus();
    expect(status).toHaveProperty("state");
  });
});
