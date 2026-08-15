import { describe, it, expect, beforeEach } from 'vitest';
import { BillSummaryCalculator } from '@/lib/billing/BillSummaryCalculator';
import { getTaxSettings, saveTaxSettings, DEFAULT_TAX_SETTINGS, type TaxSettings } from '@/lib/billing/taxSettings';

describe('Counter POS & Owner Settings Tax Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Calculates tax when GST is enabled in TaxSettings', () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 5,
    };

    const summary = BillSummaryCalculator.buildBillSummary({
      draftCart: [{ id: 'item-1', name: 'Burger', price: 200, qty: 1 }],
      taxSettings,
    });

    expect(summary.subtotal).toBe(200);
    expect(summary.tax).toBe(10); // 5% of 200 = 10
    expect(summary.grandTotal).toBe(210);
  });

  it('2. Calculates ZERO tax when GST is disabled (removed) in Owner Settings', () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: false,
      gstPercentage: 5,
    };

    const summary = BillSummaryCalculator.buildBillSummary({
      draftCart: [{ id: 'item-1', name: 'Burger', price: 200, qty: 1 }],
      taxSettings,
    });

    expect(summary.subtotal).toBe(200);
    expect(summary.tax).toBe(0);
    expect(summary.grandTotal).toBe(200);
  });

  it('3. Respects saved localStorage settings when loading via getTaxSettings', () => {
    const customSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: false,
      gstPercentage: 18,
    };

    saveTaxSettings(customSettings, 'cafe-corner');
    const loaded = getTaxSettings('cafe-corner');

    expect(loaded.gstEnabled).toBe(false);
    expect(loaded.gstPercentage).toBe(18);

    const summary = BillSummaryCalculator.buildBillSummary({
      draftCart: [{ id: 'item-2', name: 'Pizza', price: 500, qty: 1 }],
      taxSettings: loaded,
    });

    expect(summary.subtotal).toBe(500);
    expect(summary.tax).toBe(0);
    expect(summary.grandTotal).toBe(500);
  });
});
