import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveImageUrlSync } from "@/lib/useImageUrl";
import { mapBillToInvoiceRecord, resolveTableLabel } from "@/pages/owner/OwnerInvoicesPage";
import { BillingService, billsMap } from "@/lib/billing/billingService";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";
import type { BillWithItems } from "@/lib/billing/types";

describe("Milestone 4 — Owner Invoice Presentation Integrity Tests", () => {
  beforeEach(() => {
    billsMap.clear();
    vi.restoreAllMocks();
  });

  it("1. Relative cafe.logo_url resolves to a valid public HTTP(S) URL", () => {
    const relativePath = "menu-images/6d00d671-eaea-47ce-a842-f970878373c9/logo_12345.png";
    const resolved = resolveImageUrlSync(relativePath);
    expect(resolved).not.toBeNull();
    expect(resolved).toMatch(/^https?:\/\//);
    expect(resolved).toContain("menu-images/6d00d671-eaea-47ce-a842-f970878373c9/logo_12345.png");
  });

  it("2. Absolute logo URL remains unchanged", () => {
    const absoluteUrl = "https://cdn.example.com/cafes/logo.png";
    const resolved = resolveImageUrlSync(absoluteUrl);
    expect(resolved).toBe(absoluteUrl);
  });

  it("3. Missing logo does not produce a broken-image state", () => {
    expect(resolveImageUrlSync(null)).toBeNull();
    expect(resolveImageUrlSync(undefined)).toBeNull();
    expect(resolveImageUrlSync("")).toBeNull();
  });

  it("4 & 7. Table UUID is NOT displayed as table label while bill.table_id remains UUID internally", () => {
    const tableUuid = "1e804758-7538-4a61-acac-5982fc15feca";
    const label = resolveTableLabel(tableUuid, "DINE_IN", new Map());

    expect(label).not.toBe(tableUuid);
    expect(label).toBe("Dine-In Table");
  });

  it("5. Existing human-readable table label is displayed when table is resolved", () => {
    const tableUuid = "1e804758-7538-4a61-acac-5982fc15feca";
    const tablesMap = new Map<string, string>([[tableUuid, "Table 01"]]);

    const label = resolveTableLabel(tableUuid, "DINE_IN", tablesMap);
    expect(label).toBe("Table 01");
  });

  it("6. Unknown table falls back safely to Dine-In Table / Takeaway without displaying UUID", () => {
    const unknownUuid = "99999999-9999-9999-9999-999999999999";
    
    const dineInLabel = resolveTableLabel(unknownUuid, "DINE_IN", new Map());
    expect(dineInLabel).toBe("Dine-In Table");

    const takeawayLabel = resolveTableLabel(unknownUuid, "TAKEAWAY", new Map());
    expect(takeawayLabel).toBe("Takeaway");
  });

  it("8, 9, 10 & 11. Preview displays persisted subtotal, CGST, SGST, and grand_total unchanged", () => {
    const bill: BillWithItems = {
      id: "79c5ec51-64e9-4f3a-baac-516858adff4b",
      bill_number: 1001,
      cafe_id: "6d00d671-eaea-47ce-a842-f970878373c9",
      session_id: "0408938e-ead4-4fc9-afc3-a756d427c618",
      table_id: "1e804758-7538-4a61-acac-5982fc15feca",
      cashier_id: "Counter",
      customer_name: "John Doe",
      customer_phone: "+91 98765 43210",
      order_type: "DINE_IN",
      payment_status: "PAID",
      payment_method: "CASH",
      subtotal: 268,
      discount: 0,
      service_charge: 0,
      cgst: 6.7,
      sgst: 6.7,
      round_off: 0,
      grand_total: 281.4,
      total_items: 2,
      created_at: "2026-08-20T05:06:30.587Z",
      items: [
        { bill_id: "79c5ec51-64e9-4f3a-baac-516858adff4b", item_name: "Cheese Delight Wrap", quantity: 1, unit_price: 129, line_total: 129 },
        { bill_id: "79c5ec51-64e9-4f3a-baac-516858adff4b", item_name: "Clay Pot Pizza", quantity: 1, unit_price: 139, line_total: 139 },
      ],
    };

    const invoice = mapBillToInvoiceRecord(bill, new Map([["1e804758-7538-4a61-acac-5982fc15feca", "Table 01"]]));

    expect(invoice.id).toBe("79c5ec51-64e9-4f3a-baac-516858adff4b");
    expect(invoice.tableLabel).toBe("Table 01");
    expect(invoice.subtotalCents).toBe(26800);
    expect(invoice.cgstCents).toBe(670);
    expect(invoice.sgstCents).toBe(670);
    expect(invoice.grandTotalCents).toBe(28140);
  });

  it("12, 13, 14 & 15. Thermal Print Invoice and Reprint paths remain intact without mutating database state", async () => {
    const printSpy = vi.spyOn(PrinterAdapter, "printReceipt").mockResolvedValue({ success: true });

    const bill: BillWithItems = {
      id: "79c5ec51-64e9-4f3a-baac-516858adff4b",
      bill_number: 1001,
      cafe_id: "6d00d671-eaea-47ce-a842-f970878373c9",
      session_id: "0408938e-ead4-4fc9-afc3-a756d427c618",
      table_id: "1e804758-7538-4a61-acac-5982fc15feca",
      order_type: "DINE_IN",
      payment_status: "PAID",
      payment_method: "CASH",
      subtotal: 268,
      cgst: 6.7,
      sgst: 6.7,
      grand_total: 281.4,
      items: [{ item_name: "Wrap", quantity: 1, unit_price: 268, line_total: 268 }],
    };

    const registered = BillingService.registerHistoricalBill(bill);
    expect(registered.tableLabel).toBe("Dine-In Table");
    expect(registered.netTotal).toBe(281.4);

    await BillingService.printBill(bill.id);
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(printSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      isReprint: false,
      netTotal: 281.4,
    }));

    await BillingService.reprintBill(bill.id);
    expect(printSpy).toHaveBeenCalledTimes(2);
    expect(printSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      isReprint: true,
      netTotal: 281.4,
    }));
  });
});
