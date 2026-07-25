import {
  BillCalculationOptions,
  BillCalculationResult,
  BillItemSnapshot,
  RawInputItem,
} from './types';

export class BillCalculator {
  /**
   * Calculates financial metrics and produces immutable item snapshots.
   */
  public static calculate(
    items: RawInputItem[],
    options: BillCalculationOptions = {}
  ): BillCalculationResult {
    const cgstRate = options.cgstRatePct ?? 2.5; // Default 2.5% CGST
    const sgstRate = options.sgstRatePct ?? 2.5; // Default 2.5% SGST

    let rawSubtotal = 0;
    let totalQuantity = 0;

    // Aggregate items by name and price to handle split order additions
    const aggregatedMap = new Map<string, BillItemSnapshot>();

    for (const item of items) {
      if (item.qty <= 0) continue;
      const key = `${item.name.trim().toLowerCase()}_${item.price}`;
      const lineSubtotal = item.price * item.qty;
      rawSubtotal += lineSubtotal;
      totalQuantity += item.qty;

      const existing = aggregatedMap.get(key);
      if (existing) {
        existing.quantity += item.qty;
        existing.line_total += lineSubtotal;
        if (item.notes && !existing.special_instructions?.includes(item.notes)) {
          existing.special_instructions = existing.special_instructions
            ? `${existing.special_instructions}; ${item.notes}`
            : item.notes;
        }
      } else {
        aggregatedMap.set(key, {
          menu_item_id: item.menuItemId || item.id || null,
          item_name: item.name.trim(),
          category_name: item.category || 'General',
          quantity: item.qty,
          unit_price: Number(item.price.toFixed(2)),
          discount: 0,
          tax: 0,
          line_total: Number(lineSubtotal.toFixed(2)),
          special_instructions: item.notes || null,
        });
      }
    }

    const itemSnapshots = Array.from(aggregatedMap.values());
    const subtotal = Number(rawSubtotal.toFixed(2));

    // Calculate discount
    let discount = 0;
    if (options.discountAmt && options.discountAmt > 0) {
      discount = options.discountAmt;
    } else if (options.discountPct && options.discountPct > 0) {
      discount = (subtotal * options.discountPct) / 100;
    }
    discount = Math.min(discount, subtotal);
    discount = Number(discount.toFixed(2));

    const discountedSubtotal = subtotal - discount;

    // Calculate service charge
    let serviceCharge = 0;
    if (options.serviceChargeAmt && options.serviceChargeAmt > 0) {
      serviceCharge = options.serviceChargeAmt;
    } else if (options.serviceChargePct && options.serviceChargePct > 0) {
      serviceCharge = (discountedSubtotal * options.serviceChargePct) / 100;
    }
    serviceCharge = Number(serviceCharge.toFixed(2));

    // Calculate CGST and SGST on taxable base (discounted subtotal + service charge)
    const taxableBase = discountedSubtotal + serviceCharge;
    const cgst = Number(((taxableBase * cgstRate) / 100).toFixed(2));
    const sgst = Number(((taxableBase * sgstRate) / 100).toFixed(2));

    const unroundedTotal = taxableBase + cgst + sgst;
    const grandTotal = Math.round(unroundedTotal);
    const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));

    return {
      subtotal,
      discount,
      service_charge: serviceCharge,
      cgst,
      sgst,
      round_off: roundOff,
      grand_total: grandTotal,
      total_items: totalQuantity,
      itemSnapshots,
    };
  }
}
