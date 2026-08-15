import { type CustomDiscount } from '@/components/counter/CompactDiscountControl';
import { type RawInputItem } from './types';

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
  grandTotal: number;
  totalOrders: number;
  totalItems: number;
}

export interface BuildBillSummaryParams {
  orders?: Array<{ items?: RawInputItem[]; subtotal?: number }>;
  draftCart?: RawInputItem[];
  discount?: CustomDiscount;
  taxRatePct?: number; // Direct tax rate percentage (e.g. 5, 8)
  taxEnabled?: boolean; // Explicit toggle for tax
  taxSettings?: { gstEnabled?: boolean; gstPercentage?: number }; // TaxSettings configuration object
}

export class BillSummaryCalculator {
  /**
   * Single source of truth for financial calculations across Counter, Payment Dialog, Receipt, and Analytics.
   */
  public static buildBillSummary(params: BuildBillSummaryParams): SharedBillSummary {
    const orders = params.orders || [];
    const draftCart = params.draftCart || [];
    const discount = params.discount || { type: 'PERCENTAGE', value: 0 };

    let taxRate = 0;
    if (params.taxSettings) {
      taxRate = params.taxSettings.gstEnabled !== false ? (params.taxSettings.gstPercentage ?? 0) : 0;
    } else if (params.taxEnabled === false) {
      taxRate = 0;
    } else if (typeof params.taxRatePct === 'number') {
      taxRate = params.taxRatePct;
    } else {
      taxRate = 8;
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

    const subtotal = Math.round((submittedSubtotal + draftSubtotal) * 100) / 100;

    // Calculate Discount Amount & Equivalent Percentage
    let discountAmount = 0;
    let discountPercent = 0;

    if (discount && discount.value > 0 && subtotal > 0) {
      if (discount.type === 'PERCENTAGE') {
        discountPercent = discount.value;
        discountAmount = (subtotal * discount.value) / 100;
      } else {
        discountAmount = Math.min(subtotal, discount.value);
        discountPercent = (discountAmount / subtotal) * 100;
      }
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    discountPercent = Math.round(discountPercent * 100) / 100;

    const taxableSubtotal = Math.max(0, subtotal - discountAmount);
    const tax = Math.round((taxableSubtotal * (taxRate / 100)) * 100) / 100;
    const grandTotal = Math.round((taxableSubtotal + tax) * 100) / 100;

    let totalOrdersCount = orders.length;
    if (draftCart.length > 0) {
      totalOrdersCount += 1;
    }

    const totalItemsCount = submittedItemsCount + draftItemsCount;

    return {
      submittedSubtotal,
      draftSubtotal,
      subtotal,
      discountAmount,
      discountPercent,
      discountType: discount.type || 'PERCENTAGE',
      discountReason: discount.reason,
      taxableSubtotal,
      tax,
      grandTotal,
      totalOrders: totalOrdersCount,
      totalItems: totalItemsCount,
    };
  }
}
