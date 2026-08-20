import { describe, it, expect, beforeEach } from "vitest";
import { BillRepository } from "@/lib/billing/BillRepository";
import type { BillWithItems } from "@/lib/billing/types";
import { mapBillToInvoiceRecord } from "@/pages/owner/OwnerInvoicesPage";

describe("Owner Invoice Canonical Data Source & Persistence Tests", () => {
  beforeEach(() => {
    BillRepository.clearMemoryStoreForTesting();
  });

  const sampleBill: BillWithItems = {
    id: "11111111-1111-4111-8111-111111111111",
    bill_number: 1042,
    cafe_id: "cafe-alpha",
    session_id: "sess-99",
    table_id: "Table 04",
    cashier_id: "staff-1",
    customer_name: "Anita Sharma",
    customer_phone: "+91 98111 22233",
    order_type: "DINE_IN",
    payment_status: "PAID",
    payment_method: "UPI",
    subtotal: 450.0,
    discount: 0.0,
    service_charge: 0.0,
    cgst: 11.25,
    sgst: 11.25,
    round_off: 0.5,
    grand_total: 473.0,
    total_items: 2,
    notes: "No onion",
    created_at: "2026-08-20T10:00:00.000Z",
    paid_at: "2026-08-20T10:05:00.000Z",
    items: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        bill_id: "11111111-1111-4111-8111-111111111111",
        menu_item_id: "mi-101",
        item_name: "Paneer Butter Masala",
        category_name: "Mains",
        quantity: 1,
        unit_price: 300.0,
        discount: 0,
        tax: 15.0,
        line_total: 300.0,
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        bill_id: "11111111-1111-4111-8111-111111111111",
        menu_item_id: "mi-102",
        item_name: "Garlic Naan",
        category_name: "Breads",
        quantity: 2,
        unit_price: 75.0,
        discount: 0,
        tax: 7.5,
        line_total: 150.0,
      },
    ],
  };

  it("1. Owner Invoices queries persisted bills from BillRepository", async () => {
    await BillRepository.saveBill(sampleBill, sampleBill.items);

    const bills = await BillRepository.getBillsByDateRange("cafe-alpha");
    expect(bills).toHaveLength(1);
    expect(bills[0].id).toBe("11111111-1111-4111-8111-111111111111");
    expect(bills[0].bill_number).toBe(1042);
  });

  it("2. bill_number is displayed from persisted bill.bill_number", () => {
    const inv = mapBillToInvoiceRecord(sampleBill);
    expect(inv.invoiceNumber).toBe("B-1042");
    expect(inv.orderNumber).toBe("1042");
  });

  it("3. Invoice number does not change when array order or date filter changes", () => {
    const bill2: BillWithItems = {
      ...sampleBill,
      id: "22222222-2222-4222-8222-222222222222",
      bill_number: 1043,
      created_at: "2026-08-20T11:00:00.000Z",
    };

    const inv1 = mapBillToInvoiceRecord(sampleBill);
    const inv2 = mapBillToInvoiceRecord(bill2);

    expect(inv1.invoiceNumber).toBe("B-1042");
    expect(inv2.invoiceNumber).toBe("B-1043");

    // Re-mapping after array reordering maintains immutable bill numbers
    const list = [bill2, sampleBill].map(mapBillToInvoiceRecord);
    expect(list[1].invoiceNumber).toBe("B-1042");
  });

  it("4. Persisted payment_status is displayed correctly for PAID", () => {
    const inv = mapBillToInvoiceRecord(sampleBill);
    expect(inv.status).toBe("Paid");
  });

  it("5. An unpaid/pending bill is NOT displayed as Paid", () => {
    const pendingBill: BillWithItems = {
      ...sampleBill,
      payment_status: "PENDING",
    };
    const inv = mapBillToInvoiceRecord(pendingBill);
    expect(inv.status).toBe("Pending");
    expect(inv.status).not.toBe("Paid");
  });

  it("6. Persisted subtotal is used without recalculation", () => {
    const inv = mapBillToInvoiceRecord(sampleBill);
    expect(inv.subtotalCents).toBe(45000); // 450.00 * 100
  });

  it("7. Persisted tax values are used without recalculation", () => {
    const inv = mapBillToInvoiceRecord(sampleBill);
    expect(inv.cgstCents).toBe(1125); // 11.25 * 100
    expect(inv.sgstCents).toBe(1125); // 11.25 * 100
    expect(inv.totalTaxCents).toBe(2250); // 22.50 * 100
  });

  it("8. Persisted grand_total is used", () => {
    const inv = mapBillToInvoiceRecord(sampleBill);
    expect(inv.grandTotalCents).toBe(47300); // 473.00 * 100
  });

  it("9. No fake customer phone is generated when customer_phone is null/empty", () => {
    const billNoPhone: BillWithItems = {
      ...sampleBill,
      customer_phone: null,
    };
    const inv = mapBillToInvoiceRecord(billNoPhone);
    expect(inv.customerPhone).toBe("");
    expect(inv.customerPhone).not.toContain("98765 43210");
  });

  it("10. Persisted bill_items are displayed correctly", () => {
    const inv = mapBillToInvoiceRecord(sampleBill);
    expect(inv.items).toHaveLength(2);
    expect(inv.items[0].name).toBe("Paneer Butter Masala");
    expect(inv.items[0].qty).toBe(1);
    expect(inv.items[0].priceCents).toBe(30000);
    expect(inv.items[1].name).toBe("Garlic Naan");
    expect(inv.items[1].qty).toBe(2);
  });

  it("11. Historical item prices are preserved rather than current menu prices", () => {
    const historicalBill: BillWithItems = {
      ...sampleBill,
      items: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          bill_id: "11111111-1111-4111-8111-111111111111",
          menu_item_id: "mi-101",
          item_name: "Old Price Espresso",
          category_name: "Coffee",
          quantity: 1,
          unit_price: 120.0, // Historical price before menu price increase
          discount: 0,
          tax: 6.0,
          line_total: 120.0,
        },
      ],
    };
    const inv = mapBillToInvoiceRecord(historicalBill);
    expect(inv.items[0].priceCents).toBe(12000);
  });

  it("12. Cafe filtering is preserved in BillRepository query", async () => {
    await BillRepository.saveBill(sampleBill, sampleBill.items);
    await BillRepository.saveBill(
      {
        ...sampleBill,
        id: "22222222-2222-4222-8222-222222222222",
        cafe_id: "cafe-beta",
        session_id: "sess-100",
        bill_number: 99,
      },
      []
    );

    const alphaBills = await BillRepository.getBillsByDateRange("cafe-alpha");
    expect(alphaBills).toHaveLength(1);
    expect(alphaBills[0].cafe_id).toBe("cafe-alpha");

    const betaBills = await BillRepository.getBillsByDateRange("cafe-beta");
    expect(betaBills).toHaveLength(1);
    expect(betaBills[0].cafe_id).toBe("cafe-beta");
  });

  it("13. Changing date range does not mutate bill identity or totals", async () => {
    await BillRepository.saveBill(sampleBill, sampleBill.items);

    const billsToday = await BillRepository.getBillsByDateRange(
      "cafe-alpha",
      "2026-08-20T00:00:00.000Z",
      "2026-08-20T23:59:59.999Z"
    );
    const billsAllTime = await BillRepository.getBillsByDateRange("cafe-alpha");

    expect(billsToday[0].bill_number).toBe(billsAllTime[0].bill_number);
    expect(billsToday[0].grand_total).toBe(billsAllTime[0].grand_total);
  });

  it("14. Querying BillRepository reconstructs identical invoice data", async () => {
    await BillRepository.saveBill(sampleBill, sampleBill.items);

    const retrievedBill = await BillRepository.getBillById("11111111-1111-4111-8111-111111111111");
    expect(retrievedBill).not.toBeNull();
    const inv = mapBillToInvoiceRecord(retrievedBill!);

    expect(inv.id).toBe(sampleBill.id);
    expect(inv.invoiceNumber).toBe("B-1042");
    expect(inv.grandTotalCents).toBe(47300);
  });
});
