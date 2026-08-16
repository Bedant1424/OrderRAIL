import {
  BillCalculationOptions,
  BillCalculationResult,
  BillItemSnapshot,
  RawInputItem,
} from './types';
import { getTaxSettings, calculateTaxAndTotals, DEFAULT_TAX_SETTINGS, type TaxSettings } from './taxSettings';

export class BillCalculator {
  /**
   * Calculates financial metrics and produces immutable item snapshots using canonical TaxSettings.
   */
  public static calculate(
    items: RawInputItem[],
    options: BillCalculationOptions = {}
  ): BillCalculationResult {
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
    const subtotalCents = Math.round(rawSubtotal * 100);

    // Calculate discount
    let discountAmt = 0;
    if (options.discountAmt && options.discountAmt > 0) {
      discountAmt = options.discountAmt;
    } else if (options.discountPct && options.discountPct > 0) {
      discountAmt = (rawSubtotal * options.discountPct) / 100;
    }
    discountAmt = Math.min(discountAmt, rawSubtotal);
    const discountCents = Math.round(discountAmt * 100);

    const taxableBaseCents = Math.max(0, subtotalCents - discountCents);

    let effectiveTaxSettings: TaxSettings;
    if (options.taxSettings) {
      effectiveTaxSettings = options.taxSettings;
    } else if (typeof options.cgstRatePct === 'number' || typeof options.sgstRatePct === 'number') {
      const combinedGst = (options.cgstRatePct ?? 0) + (options.sgstRatePct ?? 0);
      effectiveTaxSettings = {
        ...DEFAULT_TAX_SETTINGS,
        gstEnabled: combinedGst > 0,
        gstPercentage: combinedGst,
        serviceChargeEnabled: (options.serviceChargeAmt ?? 0) > 0 || (options.serviceChargePct ?? 0) > 0,
        serviceChargePercentage: options.serviceChargePct ?? DEFAULT_TAX_SETTINGS.serviceChargePercentage,
      };
    } else {
      effectiveTaxSettings = getTaxSettings(options.cafeId);
    }

    const calc = calculateTaxAndTotals(taxableBaseCents, effectiveTaxSettings);

    return {
      subtotal: calc.subtotalCents / 100,
      discount: Math.round(discountCents) / 100,
      service_charge: calc.serviceChargeCents / 100,
      cgst: calc.cgstCents / 100,
      sgst: calc.sgstCents / 100,
      round_off: calc.roundingAdjustmentCents / 100,
      grand_total: calc.grandTotalCents / 100,
      total_items: totalQuantity,
      itemSnapshots,
    };
  }
}
