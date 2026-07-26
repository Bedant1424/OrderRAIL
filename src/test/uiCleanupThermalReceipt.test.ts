import { describe, it, expect } from 'vitest';
import { BillService, BillSummaryCalculator } from '../lib/billing';
import { PriorityEngine } from '../lib/kitchen/priorityEngine';

describe('UI Cleanup — Thermal Receipt & MVP Simplification Tests', () => {
  it('1. Kitchen Domain & KOT Engine Intact: PriorityEngine computes thresholds correctly', () => {
    const nowMs = Date.now();
    const freshTimestamp = nowMs - 2 * 60 * 1000;
    const urgentTimestamp = nowMs - 12 * 60 * 1000;

    const normalLevel = PriorityEngine.getPriority(freshTimestamp, nowMs);
    const urgentLevel = PriorityEngine.getPriority(urgentTimestamp, nowMs);

    expect(normalLevel).toBe('NORMAL');
    expect(urgentLevel).toBe('URGENT');
  });

  it('2. Billing Domain & BillService Intact: Generates immutable bill snapshots', async () => {
    const sessionInput = {
      cafeId: 'cafe-thermal-test',
      sessionId: `sess-thermal-${Date.now()}`,
      orders: [
        {
          items: [
            { id: 'i1', name: 'Cold Coffee', qty: 2, price: 120 },
            { id: 'i2', name: 'Veg Sandwich', qty: 1, price: 160 },
          ],
        },
      ],
      calculationOptions: {
        discountPct: 10,
      },
    };

    const bill = await BillService.generateBill(sessionInput);

    expect(bill).toBeDefined();
    expect(bill.subtotal).toBe(400);
    expect(bill.discount).toBe(40);
    expect(bill.grand_total).toBe(378); // (400 - 40) * 1.05 = 378 (5% default tax)
    expect(bill.items.length).toBe(2);
  });

  it('3. Shared BillSummaryCalculator Thermal Calculations', () => {
    const summary = BillSummaryCalculator.buildBillSummary({
      orders: [
        {
          subtotal: 500,
          items: [{ id: 'i1', name: 'Pasta', price: 500, qty: 1 }],
        },
      ],
      discount: { type: 'PERCENTAGE', value: 20 },
    });

    expect(summary.subtotal).toBe(500);
    expect(summary.discountAmount).toBe(100);
    expect(summary.discountPercent).toBe(20);
    expect(summary.taxableSubtotal).toBe(400);
    expect(summary.tax).toBe(32);
    expect(summary.grandTotal).toBe(432);
  });
});
