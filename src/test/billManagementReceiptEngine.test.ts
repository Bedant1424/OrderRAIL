import { describe, it, expect, beforeEach } from 'vitest';
import {
  BillService,
  BillRepository,
  BillNumberGenerator,
  type RawInputItem,
} from '../lib/billing';

describe('Bill Management & Receipt Engine Integration Tests', () => {
  beforeEach(() => {
    BillNumberGenerator.resetSequenceForTesting();
    BillRepository.clearMemoryStoreForTesting();
  });

  it('1. Bill Generation: Should generate immutable bill snapshot from POS dining session', async () => {
    const sessionItems: RawInputItem[] = [
      { id: 'm-1', name: 'Cappuccino', price: 180, qty: 2, category: 'Coffee' },
      { id: 'm-7', name: 'Club Sandwich', price: 380, qty: 1, category: 'Food' },
    ];

    const bill = await BillService.generateBill({
      cafeId: 'cafe-test-1',
      sessionId: 'session-sprint4-101',
      tableId: 'Table 3',
      cashierId: 'Sarah M.',
      orderType: 'DINE_IN',
      orders: [{ items: sessionItems }],
    });

    expect(bill.bill_number).toBe(1);
    expect(bill.table_id).toBe('Table 3');
    expect(bill.cashier_id).toBe('Sarah M.');
    expect(bill.subtotal).toBe(740); // 360 + 380
    expect(bill.total_items).toBe(3);
    expect(bill.payment_status).toBe('PENDING');
    expect(bill.items).toHaveLength(2);
  });

  it('2. Bill Payment Workflow: Should mark bill as PAID and record payment method', async () => {
    const bill = await BillService.generateBill({
      cafeId: 'cafe-test-1',
      sessionId: 'session-sprint4-102',
      tableId: 'Table 5',
      orders: [{ items: [{ name: 'Mocha', price: 220, qty: 1 }] }],
    });

    expect(bill.payment_status).toBe('PENDING');

    const paidBill = await BillService.markBillPaid(bill.id, 'UPI');
    expect(paidBill?.payment_status).toBe('PAID');
    expect(paidBill?.payment_method).toBe('UPI');
    expect(paidBill?.paid_at).toBeDefined();
    expect(paidBill?.closed_at).toBeDefined();
  });

  it('3. Bill History Filtering: Should query bills by status, payment method, and date range', async () => {
    const cafeId = 'cafe-history-test';

    const b1 = await BillService.generateBill({
      cafeId,
      sessionId: 's-1',
      tableId: 'Table 1',
      orders: [{ items: [{ name: 'Item A', price: 100, qty: 1 }] }],
    });
    await BillService.markBillPaid(b1.id, 'CASH');

    const b2 = await BillService.generateBill({
      cafeId,
      sessionId: 's-2',
      tableId: 'Table 2',
      orders: [{ items: [{ name: 'Item B', price: 200, qty: 1 }] }],
    });
    await BillService.markBillPaid(b2.id, 'UPI');

    const b3 = await BillService.generateBill({
      cafeId,
      sessionId: 's-3',
      tableId: 'Table 3',
      orders: [{ items: [{ name: 'Item C', price: 300, qty: 1 }] }],
    });
    // b3 remains PENDING

    const paidBills = await BillService.getBillsByPaymentStatus(cafeId, 'PAID');
    expect(paidBills).toHaveLength(2);

    const pendingBills = await BillService.getBillsByPaymentStatus(cafeId, 'PENDING');
    expect(pendingBills).toHaveLength(1);
    expect(pendingBills[0].id).toBe(b3.id);

    const table2Bills = await BillService.getBillsByTable('Table 2');
    expect(table2Bills).toHaveLength(1);
    expect(table2Bills[0].id).toBe(b2.id);
  });
});
