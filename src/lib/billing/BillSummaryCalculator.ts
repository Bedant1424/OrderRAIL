import { type CustomDiscount } from '@/components/counter/CompactDiscountControl';
import { type RawInputItem } from './types';
import { getTaxSettings, calculateTaxAndTotals, DEFAULT_TAX_SETTINGS, type TaxSettings } from './taxSettings';

export interface SharedBillSummary {
  submittedSubtotal: number;
  draftSubtotal: number;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountReason?: string;
  taxableSubtotal: number;
  tax: number;
  cgst?: number;
  sgst?: number;
  serviceCharge?: number;
  roundOff?: number;
  grandTotal: number;
  totalOrders: number;
  totalItems: number;
}

export interface BuildBillSummaryParams {
  orders?: Array<{ items?: RawInputItem[]; subtotal?: number }>;
  draftCart?: RawInputItem[];
  discount?: CustomDiscount;
  taxRatePct?: number; // Direct tax rate percentage (e.g. 5, 18)
  taxEnabled?: boolean; // Explicit toggle for tax
  taxSettings?: TaxSettings | { gstEnabled?: boolean; gstPercentage?: number; serviceChargeEnabled?: boolean; serviceChargePercentage?: number; pricingMode?: any; roundingMode?: any };
  cafeId?: string;
}

export class BillSummaryCalculator {
  /**
   * Single source of truth for financial calculations across Counter, Payment Dialog, Receipt, and Analytics.
   */
  public static buildBillSummary(params: BuildBillSummaryParams): SharedBillSummary {
    const orders = params.orders || [];
    const draftCart = params.draftCart || [];
    const discount = params.discount || { type: 'PERCENTAGE', value: 0 };

    let effectiveTaxSettings: TaxSettings;
    if (params.taxSettings && typeof (params.taxSettings as any).pricingMode !== 'undefined') {
      effectiveTaxSettings = params.taxSettings as TaxSettings;
    } else if (params.taxSettings) {
      const ts = params.taxSettings;
      effectiveTaxSettings = {
        ...DEFAULT_TAX_SETTINGS,
        gstEnabled: ts.gstEnabled !== false,
        gstPercentage: ts.gstPercentage ?? DEFAULT_TAX_SETTINGS.gstPercentage,
      };
    } else if (params.taxEnabled === false) {
      effectiveTaxSettings = { ...DEFAULT_TAX_SETTINGS, gstEnabled: false };
    } else if (typeof params.taxRatePct === 'number') {
      effectiveTaxSettings = {
        ...DEFAULT_TAX_SETTINGS,
        gstEnabled: params.taxRatePct > 0,
        gstPercentage: params.taxRatePct,
      };
    } else if (params.cafeId) {
      effectiveTaxSettings = getTaxSettings(params.cafeId);
    } else {
      // Legacy fallback for unconfigured unit test calls without cafeId or taxSettings
      effectiveTaxSettings = {
        ...DEFAULT_TAX_SETTINGS,
        gstEnabled: true,
        gstPercentage: 8,
      };
    }

    // Calculate Submitted Orders Subtotal & Items Count
    let submittedSubtotal = 0;
    let submittedItemsCount = 0;

    for (const order of orders) {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const itemSub = item.price * item.qty;
          submittedSubtotal += itemSub;
          submittedItemsCount += item.qty;
        }
      } else if (typeof order.subtotal === 'number') {
        submittedSubtotal += order.subtotal;
      }
    }

    // Calculate Draft Cart Subtotal & Items Count
    let draftSubtotal = 0;
    let draftItemsCount = 0;

    for (const item of draftCart) {
      const itemSub = item.price * item.qty;
      draftSubtotal += itemSub;
      draftItemsCount += item.qty;
    }

    const rawSubtotal = submittedSubtotal + draftSubtotal;
    const subtotalCents = Math.round(rawSubtotal * 100);

    // Calculate Discount Amount & Equivalent Percentage
    let discountAmount = 0;
    let discountPercent = 0;

    if (discount && discount.value > 0 && rawSubtotal > 0) {
      if (discount.type === 'PERCENTAGE') {
        discountPercent = discount.value;
        discountAmount = (rawSubtotal * discount.value) / 100;
      } else {
        discountAmount = Math.min(rawSubtotal, discount.value);
        discountPercent = (discountAmount / rawSubtotal) * 100;
      }
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    discountPercent = Math.round(discountPercent * 100) / 100;

    const discountCents = Math.round(discountAmount * 100);
    const taxableSubtotalCents = Math.max(0, subtotalCents - discountCents);

    const calc = calculateTaxAndTotals(taxableSubtotalCents, effectiveTaxSettings);

    let totalOrdersCount = orders.length;
    if (draftCart.length > 0) {
      totalOrdersCount += 1;
    }

    const totalItemsCount = submittedItemsCount + draftItemsCount;

    return {
      submittedSubtotal: Math.round(submittedSubtotal * 100) / 100,
      draftSubtotal: Math.round(draftSubtotal * 100) / 100,
      subtotal: Math.round(rawSubtotal * 100) / 100,
      discountAmount,
      discountPercent,
      discountType: discount.type || 'PERCENTAGE',
      discountReason: discount.reason,
      taxableSubtotal: taxableSubtotalCents / 100,
      tax: calc.totalGstCents / 100,
      cgst: calc.cgstCents / 100,
      sgst: calc.sgstCents / 100,
      serviceCharge: calc.serviceChargeCents / 100,
      roundOff: calc.roundingAdjustmentCents / 100,
      grandTotal: calc.grandTotalCents / 100,
      totalOrders: totalOrdersCount,
      totalItems: totalItemsCount,
    };
  }
}
