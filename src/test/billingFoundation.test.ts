import { describe, it, expect, beforeEach } from 'vitest';
import {
  BillCalculator,
  BillNumberGenerator,
  BillRepository,
  BillService,
  type RawInputItem,
} from '../lib/billing';

describe('Billing Foundation Architecture & Financial Domain Tests', () => {
  beforeEach(() => {
    BillNumberGenerator.resetSequenceForTesting();
    BillRepository.clearMemoryStoreForTesting();
  });

  it('1. BillCalculator: Should calculate subtotal, discounts, GST split, round off, and total quantity correctly', () => {
    const rawItems: RawInputItem[] = [
      { id: 'm1', name: 'New York Cheesecake', price: 280, qty: 2, category: 'Dessert' },
      { id: 'm2', name: 'Cappuccino', price: 150, qty: 1, category: 'Beverage' },
    ];

    const result = BillCalculator.calculate(rawItems, {
      discountPct: 10, // 10% discount on 710 subtotal = 71
      cgstRatePct: 2.5,
      sgstRatePct: 2.5,
    });

    expect(result.subtotal).toBe(710);
    expect(result.discount).toBe(71);
    expect(result.total_items).toBe(3);

    // Taxable base = 710 - 71 = 639
    // CGST (2.5%) = 15.97, SGST (2.5%) = 15.97
    expect(result.cgst).toBe(15.97);
    expect(result.sgst).toBe(15.97);

    // Unrounded total = 639 + 15.97 + 15.97 = 670.94
    // Grand total rounded = 671, Round off = 0.06
    expect(result.grand_total).toBe(671);
    expect(result.round_off).toBe(0.06);
    expect(result.itemSnapshots).toHaveLength(2);
  });

  it('2. BillCalculator: Should aggregate duplicate item lines into single snapshot line items', () => {
    const rawItems: RawInputItem[] = [
      { id: 'm1', name: 'Cheesecake', price: 250, qty: 1, notes: 'Extra fork' },
      { id: 'm1', name: 'Cheesecake', price: 250, qty: 2, notes: 'Extra napkin' },
    ];

    const result = BillCalculator.calculate(rawItems);

    expect(result.subtotal).toBe(750);
    expect(result.total_items).toBe(3);
    expect(result.itemSnapshots).toHaveLength(1);
    expect(result.itemSnapshots[0].quantity).toBe(3);
    expect(result.itemSnapshots[0].unit_price).toBe(250);
    expect(result.itemSnapshots[0].line_total).toBe(750);
    expect(result.itemSnapshots[0].special_instructions).toBe('Extra fork; Extra napkin');
  });

  it('3. BillNumberGenerator: Should increment bill numbers sequentially per cafe', () => {
    const cafeA = 'cafe-central-101';
    const cafeB = 'cafe-express-202';

    expect(BillNumberGenerator.getNextBillNumber(cafeA)).toBe(1);
    expect(BillNumberGenerator.getNextBillNumber(cafeA)).toBe(2);
    expect(BillNumberGenerator.getNextBillNumber(cafeA)).toBe(3);

    // Cafe B maintains separate sequence
    expect(BillNumberGenerator.getNextBillNumber(cafeB)).toBe(1);
    expect(BillNumberGenerator.getNextBillNumber(cafeB)).toBe(2);
  });

  it('4. BillService.generateBill: Should create immutable financial record and item snapshots', async () => {
    const mockOrderItems: RawInputItem[] = [
      { id: 'm1', name: 'Espresso', price: 120, qty: 2 },
    ];

    const bill = await BillService.generateBill({
      cafeId: 'cafe-demo-1',
      sessionId: 'session-9918',
      tableId: 'tbl-4',
      orderType: 'DINE_IN',
      orders: [{ items: mockOrderItems }],
    });

    expect(bill.bill_number).toBe(1);
    expect(bill.session_id).toBe('session-9918');
    expect(bill.table_id).toBe('tbl-4');
    expect(bill.payment_status).toBe('PENDING');
    expect(bill.subtotal).toBe(240);
    expect(bill.grand_total).toBe(252); // 240 + 6 (CGST) + 6 (SGST)
    expect(bill.items).toHaveLength(1);
    expect(bill.items[0].item_name).toBe('Espresso');

    // Verify immutability: mutating original input array does not alter snapshot
    mockOrderItems[0].price = 999;
    mockOrderItems[0].name = 'Hacked Espresso';

    const retrievedBill = await BillService.getBillById(bill.id);
    expect(retrievedBill?.subtotal).toBe(240);
    expect(retrievedBill?.items[0].item_name).toBe('Espresso');
    expect(retrievedBill?.items[0].unit_price).toBe(120);
  });

  it('5. Payment Lifecycle: Should transition bill payment status to PAID, CANCELLED, or REFUNDED', async () => {
    const bill = await BillService.generateBill({
      cafeId: 'cafe-demo-1',
      sessionId: 'session-8812',
      orders: [{ items: [{ name: 'Latte', price: 180, qty: 1 }] }],
    });

    expect(bill.payment_status).toBe('PENDING');
    expect(bill.paid_at).toBeUndefined();

    // Mark PAID
    const paidBill = await BillService.markBillPaid(bill.id, 'UPI');
    expect(paidBill?.payment_status).toBe('PAID');
    expect(paidBill?.payment_method).toBe('UPI');
    expect(paidBill?.paid_at).toBeDefined();
    expect(paidBill?.closed_at).toBeDefined();

    // Refund Bill
    const refundedBill = await BillService.refundBill(bill.id);
    expect(refundedBill?.payment_status).toBe('REFUNDED');
  });

  it('6. BillRepository Queries: Should query bills by session, table, and date range', async () => {
    const bill = await BillService.generateBill({
      cafeId: 'cafe-query-test',
      sessionId: 'session-777',
      tableId: 'table-12',
      orders: [{ items: [{ name: 'Iced Tea', price: 100, qty: 2 }] }],
    });

    const bySession = await BillService.getBillsBySession('session-777');
    expect(bySession).toHaveLength(1);
    expect(bySession[0].id).toBe(bill.id);

    const byTable = await BillService.getBillsByTable('table-12');
    expect(byTable).toHaveLength(1);
    expect(byTable[0].id).toBe(bill.id);

    const byStatus = await BillService.getBillsByPaymentStatus('cafe-query-test', 'PENDING');
    expect(byStatus).toHaveLength(1);
    expect(byStatus[0].id).toBe(bill.id);
  });
});
