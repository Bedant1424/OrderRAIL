import { describe, it, expect, beforeEach } from 'vitest';
import { BillingService, billsMap } from '@/lib/billing/billingService';
import { BillSummaryCalculator } from '@/lib/billing/BillSummaryCalculator';
import { ReceiptBuilder } from '@/lib/printing/receiptBuilder';
import {
  getTaxSettings,
  saveTaxSettingsToLocalStorage,
  DEFAULT_TAX_SETTINGS,
  type TaxSettings,
} from '@/lib/billing/taxSettings';

describe('Owner Tax Settings to Counter Billing Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    billsMap.clear();
  });

  it('Test 1 - GST disabled: Actual BillingService bill creation yields GST = 0 and Total = 500', async () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: false,
      gstPercentage: 5,
    };
    saveTaxSettingsToLocalStorage(taxSettings, 'cafe-test-1');

    const result = await BillingService.createBill({
      orderId: 'ord-test-1',
      tableLabel: 'Table 01',
      items: [{ name: 'Artisan Pizza', price: 500, qty: 1 }],
      taxSettings,
      cafeId: 'cafe-test-1',
    });

    expect(result.bill.subtotal).toBe(500);
    expect(result.bill.tax).toBe(0);
    expect(result.bill.netTotal).toBe(500);
  });

  it('Test 2 - GST 5%: Subtotal 500 yields GST = 25 and Total = 525', async () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 5,
      pricingMode: 'exclusive',
    };

    const result = await BillingService.createBill({
      orderId: 'ord-test-2',
      tableLabel: 'Table 02',
      items: [{ name: 'Artisan Burger', price: 500, qty: 1 }],
      taxSettings,
      cafeId: 'cafe-test-2',
    });

    expect(result.bill.subtotal).toBe(500);
    expect(result.bill.tax).toBe(25);
    expect(result.bill.netTotal).toBe(525);
  });

  it('Test 3 - GST 18%: Subtotal 500 yields GST = 90 and Total = 590', async () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 18,
      pricingMode: 'exclusive',
    };

    const result = await BillingService.createBill({
      orderId: 'ord-test-3',
      tableLabel: 'Table 03',
      items: [{ name: 'Special Platter', price: 500, qty: 1 }],
      taxSettings,
      cafeId: 'cafe-test-3',
    });

    expect(result.bill.subtotal).toBe(500);
    expect(result.bill.tax).toBe(90);
    expect(result.bill.netTotal).toBe(590);
  });

  it('Test 4 - GST disabled must NEVER fall back to 5% when taxRatePct is omitted', async () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: false,
      gstPercentage: 5,
    };
    saveTaxSettingsToLocalStorage(taxSettings, 'cafe-test-4');

    // Intentionally omit taxRatePct from payload
    const result = await BillingService.createBill({
      orderId: 'ord-test-4',
      tableLabel: 'Table 04',
      items: [{ name: 'Cold Coffee', price: 200, qty: 1 }],
      cafeId: 'cafe-test-4',
    });

    expect(result.bill.subtotal).toBe(200);
    expect(result.bill.tax).toBe(0);
    expect(result.bill.cgst).toBe(0);
    expect(result.bill.sgst).toBe(0);
    expect(result.bill.netTotal).toBe(200);
  });

  it('Test 5 - Service charge disabled yields serviceCharge = 0', async () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: false,
      serviceChargeEnabled: false,
      serviceChargePercentage: 5,
    };

    const result = await BillingService.createBill({
      orderId: 'ord-test-5',
      tableLabel: 'Table 05',
      items: [{ name: 'Club Sandwich', price: 300, qty: 1 }],
      taxSettings,
      cafeId: 'cafe-test-5',
    });

    expect(result.bill.serviceCharge).toBe(0);
    expect(result.bill.netTotal).toBe(300);
  });

  it('Test 6 - Service charge enabled (5%) correctly adds service charge to totals', async () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: false,
      serviceChargeEnabled: true,
      serviceChargePercentage: 5,
    };

    const result = await BillingService.createBill({
      orderId: 'ord-test-6',
      tableLabel: 'Table 06',
      items: [{ name: 'Gourmet Feast', price: 1000, qty: 1 }],
      taxSettings,
      cafeId: 'cafe-test-6',
    });

    expect(result.bill.subtotal).toBe(1000);
    expect(result.bill.serviceCharge).toBe(50); // 5% of 1000
    expect(result.bill.tax).toBe(0);
    expect(result.bill.netTotal).toBe(1050);
  });

  it('Test 7 - Inclusive pricing extracts tax backwards from total item price', async () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 5,
      pricingMode: 'inclusive',
    };

    const summary = BillSummaryCalculator.buildBillSummary({
      draftCart: [{ id: 'item-7', name: 'Inclusive Combo', price: 525, qty: 1 }],
      taxSettings,
    });

    expect(summary.subtotal).toBe(500); // 525 / 1.05 = 500
    expect(summary.tax).toBe(25);
    expect(summary.grandTotal).toBe(525);
  });

  it('Test 8 - Exclusive pricing adds tax on top of subtotal', async () => {
    const taxSettings: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 5,
      pricingMode: 'exclusive',
    };

    const summary = BillSummaryCalculator.buildBillSummary({
      draftCart: [{ id: 'item-8', name: 'Exclusive Combo', price: 500, qty: 1 }],
      taxSettings,
    });

    expect(summary.subtotal).toBe(500);
    expect(summary.tax).toBe(25);
    expect(summary.grandTotal).toBe(525);
  });

  it('Test 9 - Receipt rendering with GST disabled contains NO CGST/SGST tax lines', () => {
    const text = ReceiptBuilder.buildText({
      billNumber: 'B-1001',
      tableLabel: 'Table 01',
      items: [{ name: 'Garlic Bread', price: 150, qty: 1 }],
      subtotal: 150,
      tax: 0,
      cgst: 0,
      sgst: 0,
      netTotal: 150,
    });

    expect(text).not.toContain('CGST');
    expect(text).not.toContain('SGST');
    expect(text).toContain('Subtotal:');
    expect(text).toContain('NET PAYABLE TOTAL:');
  });

  it('Test 10 - Receipt rendering with 18% GST displays CGST (9%) and SGST (9%)', () => {
    const text = ReceiptBuilder.buildText({
      billNumber: 'B-1002',
      tableLabel: 'Table 02',
      items: [{ name: 'Luxury Pasta', price: 500, qty: 1 }],
      subtotal: 500,
      tax: 90,
      cgst: 45,
      sgst: 45,
      gstPercentage: 18,
      netTotal: 590,
    });

    expect(text).toContain('CGST (9%):');
    expect(text).toContain('SGST (9%):');
    expect(text).not.toContain('2.5%');
  });

  it('Test 11 - Historical bill safety: Changing tax settings does not alter existing created bill', async () => {
    const taxSettings5: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 5,
    };

    const bill101 = await BillingService.createBill({
      billId: 'bill-101',
      orderId: 'ord-101',
      tableLabel: 'Table 01',
      items: [{ name: 'Historical Item', price: 500, qty: 1 }],
      taxSettings: taxSettings5,
      cafeId: 'cafe-hist',
    });

    expect(bill101.bill.tax).toBe(25);
    expect(bill101.bill.netTotal).toBe(525);

    // Owner now updates tax settings to 18% GST
    const taxSettings18: TaxSettings = {
      ...DEFAULT_TAX_SETTINGS,
      gstEnabled: true,
      gstPercentage: 18,
    };
    saveTaxSettingsToLocalStorage(taxSettings18, 'cafe-hist');

    // Historical Bill #101 MUST remain 5%
    const fetchedBill101 = BillingService.getBill('bill-101');
    expect(fetchedBill101?.tax).toBe(25);
    expect(fetchedBill101?.netTotal).toBe(525);

    // NEW Bill #102 created after settings update receives 18% GST
    const bill102 = await BillingService.createBill({
      billId: 'bill-102',
      orderId: 'ord-102',
      tableLabel: 'Table 02',
      items: [{ name: 'New Item', price: 500, qty: 1 }],
      taxSettings: taxSettings18,
      cafeId: 'cafe-hist',
    });

    expect(bill102.bill.tax).toBe(90);
    expect(bill102.bill.netTotal).toBe(590);
  });

  it('Test 12 - Cross-device persistence loads configuration from cafe record', () => {
    const mockCafeRecord = {
      id: 'cafe-remote',
      tax_settings: {
        gstEnabled: false,
        gstPercentage: 18,
        serviceChargeEnabled: true,
        serviceChargePercentage: 10,
        pricingMode: 'exclusive',
        roundingMode: 'none',
      },
    };

    const loadedSettings = getTaxSettings('cafe-remote', mockCafeRecord);
    expect(loadedSettings.gstEnabled).toBe(false);
    expect(loadedSettings.gstPercentage).toBe(18);
    expect(loadedSettings.serviceChargeEnabled).toBe(true);
    expect(loadedSettings.serviceChargePercentage).toBe(10);
  });
});
