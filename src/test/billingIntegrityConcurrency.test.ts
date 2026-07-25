import { describe, it, expect, beforeEach } from 'vitest';
import {
  BillService,
  BillRepository,
  BillNumberGenerator,
  BillingError,
  type RawInputItem,
} from '../lib/billing';

describe('Billing Integrity & Concurrency Protection Tests', () => {
  beforeEach(() => {
    BillNumberGenerator.resetSequenceForTesting();
    BillRepository.clearMemoryStoreForTesting();
  });

  it('1. Idempotency: Duplicate generateBill calls for the same session return the existing bill', async () => {
    const sessionInput = {
      cafeId: 'cafe-integrity-1',
      sessionId: 'session-unique-901',
      tableId: 'Table 2',
      orders: [{ items: [{ name: 'Espresso', price: 150, qty: 2 }] }],
    };

    const bill1 = await BillService.generateBill(sessionInput);
    const bill2 = await BillService.generateBill(sessionInput);

    expect(bill1.id).toBe(bill2.id);
    expect(bill1.bill_number).toBe(bill2.bill_number);
    expect(bill2.subtotal).toBe(300);
  });

  it('2. Idempotency: Duplicate markBillPaid calls preserve original payment details and timestamps', async () => {
    const bill = await BillService.generateBill({
      cafeId: 'cafe-integrity-1',
      sessionId: 'session-unique-902',
      orders: [{ items: [{ name: 'Flat White', price: 200, qty: 1 }] }],
    });

    const paidAt1 = new Date('2026-07-25T10:00:00.000Z').toISOString();
    const paid1 = await BillService.markBillPaid(bill.id, 'UPI', paidAt1);
    expect(paid1.payment_status).toBe('PAID');
    expect(paid1.payment_method).toBe('UPI');
    expect(paid1.paid_at).toBe(paidAt1);

    // Repeated call with different method & timestamp should be ignored (idempotent)
    const paidAt2 = new Date('2026-07-25T11:00:00.000Z').toISOString();
    const paid2 = await BillService.markBillPaid(bill.id, 'CASH', paidAt2);

    expect(paid2.payment_status).toBe('PAID');
    expect(paid2.payment_method).toBe('UPI'); // Preserved original
    expect(paid2.paid_at).toBe(paidAt1); // Preserved original
  });

  it('3. Concurrency Protection: Simultaneous generateBill requests resolve to single bill', async () => {
    const sessionInput = {
      cafeId: 'cafe-integrity-2',
      sessionId: 'session-concurrent-888',
      tableId: 'Table 8',
      orders: [{ items: [{ name: 'Club Sandwich', price: 350, qty: 1 }] }],
    };

    // Fire 5 concurrent generateBill promises
    const promises = Array.from({ length: 5 }, () => BillService.generateBill(sessionInput));
    const results = await Promise.all(promises);

    const firstId = results[0].id;
    for (const b of results) {
      expect(b.id).toBe(firstId);
      expect(b.bill_number).toBe(results[0].bill_number);
    }
  });

  it('4. Concurrency Protection: Simultaneous markBillPaid requests execute safely', async () => {
    const bill = await BillService.generateBill({
      cafeId: 'cafe-integrity-2',
      sessionId: 'session-concurrent-999',
      orders: [{ items: [{ name: 'Lemonade', price: 120, qty: 2 }] }],
    });

    // Fire 5 concurrent payment promises
    const promises = Array.from({ length: 5 }, () => BillService.markBillPaid(bill.id, 'CARD'));
    const results = await Promise.all(promises);

    for (const b of results) {
      expect(b.payment_status).toBe('PAID');
      expect(b.payment_method).toBe('CARD');
    }
  });

  it('5. Error Handling: Throws domain BillingError with expected error codes', async () => {
    // Session ID missing
    await expect(
      BillService.generateBill({ cafeId: 'c1', sessionId: '', orders: [] })
    ).rejects.toThrowError(BillingError);

    try {
      await BillService.generateBill({ cafeId: 'c1', sessionId: '', orders: [] });
    } catch (e: any) {
      expect(e.code).toBe('SESSION_NOT_FOUND');
    }

    // Empty orders
    await expect(
      BillService.generateBill({ cafeId: 'c1', sessionId: 's-empty', orders: [] })
    ).rejects.toThrowError(BillingError);

    try {
      await BillService.generateBill({ cafeId: 'c1', sessionId: 's-empty', orders: [] });
    } catch (e: any) {
      expect(e.code).toBe('INVALID_BILL_STATE');
    }

    // Non-existent bill
    try {
      await BillService.markBillPaid('non-existent-id', 'CASH');
    } catch (e: any) {
      expect(e.code).toBe('BILL_NOT_FOUND');
    }
  });
});
