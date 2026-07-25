import { describe, it, expect } from 'vitest';
import { BillSummaryCalculator, type SharedBillSummary } from '../lib/billing/BillSummaryCalculator';
import { type CustomDiscount } from '../components/counter/CompactDiscountControl';

describe('Hotfix + Refactor — Payment Dialog Regression & Shared Billing Summary Tests', () => {
  const sampleOrders = [
    {
      subtotal: 800,
      items: [
        { id: 'i1', name: 'Paneer Tikka', price: 250, qty: 2 },
        { id: 'i2', name: 'Butter Naan', price: 50, qty: 6 },
      ],
    },
  ];

  const sampleDraftCart = [{ id: 'i3', name: 'Mango Lassi', price: 100, qty: 2 }];

  it('1. Shared BillSummaryCalculator: No Discount Scenario', () => {
    const discount: CustomDiscount = { type: 'PERCENTAGE', value: 0 };
    const summary: SharedBillSummary = BillSummaryCalculator.buildBillSummary({
      orders: sampleOrders,
      draftCart: sampleDraftCart,
      discount,
    });

    expect(summary.submittedSubtotal).toBe(800);
    expect(summary.draftSubtotal).toBe(200);
    expect(summary.subtotal).toBe(1000);
    expect(summary.discountAmount).toBe(0);
    expect(summary.discountPercent).toBe(0);
    expect(summary.taxableSubtotal).toBe(1000);
    expect(summary.tax).toBe(80); // 8% GST of 1000
    expect(summary.grandTotal).toBe(1080);
    expect(summary.totalOrders).toBe(2);
    expect(summary.totalItems).toBe(10);
  });

  it('2. Shared BillSummaryCalculator: Preset Discount Scenarios (5%, 10%, 15%)', () => {
    // 5% Preset
    const summary5 = BillSummaryCalculator.buildBillSummary({
      orders: sampleOrders,
      draftCart: sampleDraftCart,
      discount: { type: 'PERCENTAGE', value: 5 },
    });
    expect(summary5.discountAmount).toBe(50);
    expect(summary5.taxableSubtotal).toBe(950);
    expect(summary5.tax).toBe(76); // 8% of 950
    expect(summary5.grandTotal).toBe(1026);

    // 10% Preset
    const summary10 = BillSummaryCalculator.buildBillSummary({
      orders: sampleOrders,
      draftCart: sampleDraftCart,
      discount: { type: 'PERCENTAGE', value: 10 },
    });
    expect(summary10.discountAmount).toBe(100);
    expect(summary10.grandTotal).toBe(972);

    // 15% Preset
    const summary15 = BillSummaryCalculator.buildBillSummary({
      orders: sampleOrders,
      draftCart: sampleDraftCart,
      discount: { type: 'PERCENTAGE', value: 15 },
    });
    expect(summary15.discountAmount).toBe(150);
    expect(summary15.grandTotal).toBe(918);
  });

  it('3. Shared BillSummaryCalculator: Custom Percentage Discount (40%)', () => {
    const summary40 = BillSummaryCalculator.buildBillSummary({
      orders: sampleOrders,
      draftCart: sampleDraftCart,
      discount: { type: 'PERCENTAGE', value: 40, reason: 'Staff' },
    });

    expect(summary40.discountAmount).toBe(400);
    expect(summary40.discountPercent).toBe(40);
    expect(summary40.discountReason).toBe('Staff');
    expect(summary40.taxableSubtotal).toBe(600);
    expect(summary40.tax).toBe(48);
    expect(summary40.grandTotal).toBe(648);
  });

  it('4. Shared BillSummaryCalculator: Flat Amount Discount (₹150)', () => {
    const summaryFlat = BillSummaryCalculator.buildBillSummary({
      orders: sampleOrders,
      draftCart: sampleDraftCart,
      discount: { type: 'FLAT', value: 150, reason: 'Loyalty' },
    });

    expect(summaryFlat.discountAmount).toBe(150);
    expect(summaryFlat.discountPercent).toBe(15); // 150 / 1000 = 15%
    expect(summaryFlat.discountType).toBe('FLAT');
    expect(summaryFlat.taxableSubtotal).toBe(850);
    expect(summaryFlat.tax).toBe(68);
    expect(summaryFlat.grandTotal).toBe(918);
  });

  it('5. Discount Removal (Apply -> Clear)', () => {
    const appliedSummary = BillSummaryCalculator.buildBillSummary({
      orders: sampleOrders,
      draftCart: sampleDraftCart,
      discount: { type: 'PERCENTAGE', value: 25 },
    });
    expect(appliedSummary.discountAmount).toBe(250);

    const clearedSummary = BillSummaryCalculator.buildBillSummary({
      orders: sampleOrders,
      draftCart: sampleDraftCart,
      discount: { type: 'PERCENTAGE', value: 0 },
    });
    expect(clearedSummary.discountAmount).toBe(0);
    expect(clearedSummary.grandTotal).toBe(1080);
  });

  it('6. Ensures Payment Dialog receives defined discountPercent without runtime errors', () => {
    const summary = BillSummaryCalculator.buildBillSummary({
      orders: sampleOrders,
      discount: { type: 'FLAT', value: 200 },
    });

    // Consumers expect discountPercent to be defined, non-NaN number
    expect(summary.discountPercent).toBeDefined();
    expect(typeof summary.discountPercent).toBe('number');
    expect(isNaN(summary.discountPercent)).toBe(false);
    expect(summary.discountPercent).toBe(25); // 200 / 800 = 25%
  });
});
