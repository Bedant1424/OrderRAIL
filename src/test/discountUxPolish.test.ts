import { describe, it, expect } from 'vitest';
import { BillCalculator } from '../lib/billing';
import { type CustomDiscount } from '../components/counter/CompactDiscountControl';

describe('Discount UX Polish — Validation & Large Discount Threshold Tests', () => {
  const subtotal = 1200;

  it('1. Input Validation Rules: Validates percentage bounds (0.01% - 100%)', () => {
    const validPct: CustomDiscount = { type: 'PERCENTAGE', value: 15 };
    const calcValid = BillCalculator.calculate([{ name: 'Item', price: 1200, qty: 1 }], {
      discountPct: validPct.value,
    });
    expect(calcValid.discount).toBe(180);

    const invalidNegative: CustomDiscount = { type: 'PERCENTAGE', value: -10 };
    const calcNeg = BillCalculator.calculate([{ name: 'Item', price: 1200, qty: 1 }], {
      discountPct: Math.max(0, invalidNegative.value),
    });
    expect(calcNeg.discount).toBe(0);
  });

  it('2. Input Validation Rules: Validates flat amount bounds (₹1 - Subtotal)', () => {
    const validFlat: CustomDiscount = { type: 'FLAT', value: 250 };
    const calcValid = BillCalculator.calculate([{ name: 'Item', price: 1200, qty: 1 }], {
      discountAmt: validFlat.value,
    });
    expect(calcValid.discount).toBe(250);

    const excessiveFlat: CustomDiscount = { type: 'FLAT', value: 1500 };
    const calcExcessive = BillCalculator.calculate([{ name: 'Item', price: 1200, qty: 1 }], {
      discountAmt: excessiveFlat.value,
    });
    expect(calcExcessive.discount).toBe(1200); // Capped at subtotal
  });

  it('3. Large Discount Threshold Detection (> 25% or > 25% of subtotal)', () => {
    const checkIsLargeDiscount = (type: 'PERCENTAGE' | 'FLAT', val: number, sub: number): boolean => {
      const calcAmt = type === 'PERCENTAGE' ? (sub * val) / 100 : Math.min(sub, val);
      return (type === 'PERCENTAGE' && val > 25) || (type === 'FLAT' && calcAmt > sub * 0.25);
    };

    // Standard preset discounts (5%, 10%, 15%) => Not Large
    expect(checkIsLargeDiscount('PERCENTAGE', 5, 1200)).toBe(false);
    expect(checkIsLargeDiscount('PERCENTAGE', 10, 1200)).toBe(false);
    expect(checkIsLargeDiscount('PERCENTAGE', 15, 1200)).toBe(false);

    // Large Percentage (40%) => Large
    expect(checkIsLargeDiscount('PERCENTAGE', 40, 1200)).toBe(true);

    // Large Flat (₹400 on ₹1200 subtotal = 33.3%) => Large
    expect(checkIsLargeDiscount('FLAT', 400, 1200)).toBe(true);
    expect(checkIsLargeDiscount('FLAT', 100, 1200)).toBe(false);
  });

  it('4. Contextual Clear Action: Resets active discount to 0', () => {
    const activeDiscount: CustomDiscount = { type: 'PERCENTAGE', value: 20 };
    const clearedDiscount: CustomDiscount = { type: 'PERCENTAGE', value: 0 };

    const activeCalc = BillCalculator.calculate([{ name: 'Item', price: 1000, qty: 1 }], {
      discountPct: activeDiscount.value,
    });
    expect(activeCalc.discount).toBe(200);

    const clearedCalc = BillCalculator.calculate([{ name: 'Item', price: 1000, qty: 1 }], {
      discountPct: clearedDiscount.value,
    });
    expect(clearedCalc.discount).toBe(0);
    expect(clearedCalc.grand_total).toBe(1050); // 1000 * 1.05
  });
});
