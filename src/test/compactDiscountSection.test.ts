import { describe, it, expect } from 'vitest';
import { BillCalculator } from '../lib/billing';
import { type CustomDiscount } from '../components/counter/CompactDiscountControl';

describe('Compact Discount Section Unit & Calculation Tests', () => {
  const mockItems = [
    { name: 'Cold Brew Coffee', price: 200, qty: 2 },
    { name: 'Avocado Toast', price: 400, qty: 2 },
  ]; // Total Subtotal = 400 + 800 = ₹1200

  it('1. Preset Discounts: Calculates 0%, 5%, 10%, 15% discounts correctly', () => {
    const subtotal = 1200;

    const calc5 = BillCalculator.calculate(mockItems, { discountPct: 5 });
    expect(calc5.subtotal).toBe(subtotal);
    expect(calc5.discount).toBe(60); // 5% of 1200

    const calc10 = BillCalculator.calculate(mockItems, { discountPct: 10 });
    expect(calc10.discount).toBe(120); // 10% of 1200

    const calc15 = BillCalculator.calculate(mockItems, { discountPct: 15 });
    expect(calc15.discount).toBe(180); // 15% of 1200
  });

  it('2. Custom Percentage Discount: Calculates 40% OFF correctly (Saved ₹480)', () => {
    const customDiscount: CustomDiscount = {
      type: 'PERCENTAGE',
      value: 40,
      reason: 'Loyalty',
    };

    const calc = BillCalculator.calculate(mockItems, { discountPct: customDiscount.value });

    expect(calc.subtotal).toBe(1200);
    expect(calc.discount).toBe(480); // 40% of 1200
    expect(calc.grand_total).toBe(756); // (1200 - 480) * 1.05 = 720 * 1.05 = 756
  });

  it('3. Custom Flat Amount Discount: Calculates ₹150 OFF correctly', () => {
    const customDiscount: CustomDiscount = {
      type: 'FLAT',
      value: 150,
      reason: 'Promotion',
    };

    const calc = BillCalculator.calculate(mockItems, { discountAmt: customDiscount.value });

    expect(calc.subtotal).toBe(1200);
    expect(calc.discount).toBe(150);
  });

  it('4. Flat Amount Boundary Protection: Caps flat discount at subtotal amount', () => {
    const excessiveFlatDiscount: CustomDiscount = {
      type: 'FLAT',
      value: 2000, // Exceeds ₹1200 subtotal
    };

    const calc = BillCalculator.calculate(mockItems, { discountAmt: excessiveFlatDiscount.value });

    expect(calc.subtotal).toBe(1200);
    expect(calc.discount).toBe(1200); // Capped at subtotal
  });

  it('5. Discount Removal: Resetting discount restores original totals', () => {
    const noDiscount = BillCalculator.calculate(mockItems, { discountPct: 0 });

    expect(noDiscount.subtotal).toBe(1200);
    expect(noDiscount.discount).toBe(0);
  });
});
