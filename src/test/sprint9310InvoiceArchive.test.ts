import { describe, it, expect, beforeEach } from "vitest";
import { buildInvoiceRecords, type InvoiceRecord } from "@/lib/billing/invoiceService";
import type { OrderWithItems } from "@/lib/orders/repository";
import { saveReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from "@/lib/billing/receiptSettings";
import { saveTaxSettings, DEFAULT_TAX_SETTINGS } from "@/lib/billing/taxSettings";

const sampleOrders: OrderWithItems[] = [
  {
    id: "ord-101",
    cafe_id: "test-cafe",
    order_number: 101,
    order_mode: "DINE_IN",
    status: "completed",
    total_cents: 54000,
    created_at: "2026-07-28T12:00:00Z",
    updated_at: "2026-07-28T12:00:00Z",
    order_items: [
      { id: "i1", order_id: "ord-101", menu_item_id: "m1", name: "Cappuccino", price_cents: 24000, qty: 2, created_at: "" },
      { id: "i2", order_id: "ord-101", menu_item_id: "m2", name: "Croissant", price_cents: 6000, qty: 1, created_at: "" },
    ],
    tables: { label: "Table 04" },
  } as any,
  {
    id: "ord-102",
    cafe_id: "test-cafe",
    order_number: 102,
    order_mode: "TAKEAWAY",
    status: "cancelled",
    total_cents: 18000,
    created_at: "2026-07-28T12:30:00Z",
    updated_at: "2026-07-28T12:30:00Z",
    order_items: [
      { id: "i3", order_id: "ord-102", menu_item_id: "m3", name: "Masala Dosa", price_cents: 18000, qty: 1, created_at: "" },
    ],
  } as any,
];

describe("Sprint 9.3.1 — Invoice Archive & Receipt Management Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("1. Transforms orders into structured invoice records with prefix", () => {
    saveReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, invoicePrefix: "INV-" }, "test-cafe");
    saveTaxSettings({ ...DEFAULT_TAX_SETTINGS, gstEnabled: true, gstPercentage: 5 }, "test-cafe");

    const records = buildInvoiceRecords(sampleOrders, "test-cafe");

    expect(records.length).toBe(2);
    expect(records[0].invoiceNumber).toContain("INV-");
    expect(records[0].orderNumber).toBe(101);
    expect(records[0].status).toBe("Paid");
    expect(records[0].subtotalCents).toBe(54000);
    expect(records[0].totalTaxCents).toBe(2700); // 5% of 54000 = 2700

    expect(records[1].status).toBe("Cancelled");
  });

  it("2. Filters invoices by status and search query", () => {
    const records = buildInvoiceRecords(sampleOrders, "test-cafe");

    const paidOnly = records.filter((r) => r.status === "Paid");
    expect(paidOnly.length).toBe(1);
    expect(paidOnly[0].id).toBe("ord-101");

    const cancelledOnly = records.filter((r) => r.status === "Cancelled");
    expect(cancelledOnly.length).toBe(1);
    expect(cancelledOnly[0].id).toBe("ord-102");
  });
});
