import { supabase } from "@/integrations/supabase/client";

export type TaxPricingMode = "inclusive" | "exclusive";
export type RoundingMode = "none" | "nearest_1" | "nearest_0_5";

export interface TaxSettings {
  // Tax Profile
  gstEnabled: boolean;
  gstNumber: string; // GSTIN
  gstPercentage: number; // e.g. 5
  serviceChargeEnabled: boolean;
  serviceChargePercentage: number; // e.g. 5

  // Pricing Behavior
  pricingMode: TaxPricingMode;

  // Rounding
  roundingMode: RoundingMode;

  // Tax Display Preferences
  showTaxBreakdown: boolean;
  showServiceCharge: boolean;
  mergeTaxesInTotal: boolean;
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  gstEnabled: true,
  gstNumber: "27AAAAA0000A1Z5",
  gstPercentage: 5,
  serviceChargeEnabled: false,
  serviceChargePercentage: 5,
  pricingMode: "exclusive",
  roundingMode: "none",
  showTaxBreakdown: true,
  showServiceCharge: true,
  mergeTaxesInTotal: false,
};

export interface TaxCalculationResult {
  subtotalCents: number;
  cgstCents: number;
  sgstCents: number;
  totalGstCents: number;
  serviceChargeCents: number;
  roundingAdjustmentCents: number;
  grandTotalCents: number;
}

/**
 * Calculates tax breakdown, service charge, and rounding for a given base subtotal.
 */
export function calculateTaxAndTotals(
  baseSubtotalCents: number,
  settings: TaxSettings
): TaxCalculationResult {
  let subtotalCents = baseSubtotalCents;
  let totalGstCents = 0;
  let serviceChargeCents = 0;

  const gstRate = settings.gstEnabled ? Math.max(0, settings.gstPercentage) / 100 : 0;
  const serviceChargeRate = settings.serviceChargeEnabled ? Math.max(0, settings.serviceChargePercentage) / 100 : 0;

  if (settings.pricingMode === "inclusive" && gstRate > 0) {
    // Subtotal is extracted from tax-inclusive price
    const netFactor = 1 + gstRate;
    subtotalCents = Math.round(baseSubtotalCents / netFactor);
    totalGstCents = baseSubtotalCents - subtotalCents;
  } else if (settings.pricingMode === "exclusive" && gstRate > 0) {
    // Tax is calculated on top of subtotal
    totalGstCents = Math.round(baseSubtotalCents * gstRate);
  }

  if (serviceChargeRate > 0) {
    serviceChargeCents = Math.round(subtotalCents * serviceChargeRate);
  }

  const cgstCents = Math.round(totalGstCents / 2);
  const sgstCents = totalGstCents - cgstCents;

  const rawGrandTotalCents =
    settings.pricingMode === "inclusive"
      ? baseSubtotalCents + serviceChargeCents
      : subtotalCents + totalGstCents + serviceChargeCents;

  // Rounding adjustment
  let grandTotalCents = rawGrandTotalCents;
  let roundingAdjustmentCents = 0;

  if (settings.roundingMode === "nearest_1") {
    // Round to nearest 100 cents (₹1)
    grandTotalCents = Math.round(rawGrandTotalCents / 100) * 100;
    roundingAdjustmentCents = grandTotalCents - rawGrandTotalCents;
  } else if (settings.roundingMode === "nearest_0_5") {
    // Round to nearest 50 cents (₹0.50)
    grandTotalCents = Math.round(rawGrandTotalCents / 50) * 50;
    roundingAdjustmentCents = grandTotalCents - rawGrandTotalCents;
  }

  return {
    subtotalCents,
    cgstCents,
    sgstCents,
    totalGstCents,
    serviceChargeCents,
    roundingAdjustmentCents,
    grandTotalCents,
  };
}

export function saveTaxSettingsToLocalStorage(settings: TaxSettings, cafeId?: string): void {
  try {
    const key = `orderrail_tax_settings_${cafeId || "default"}`;
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(settings));
    }
  } catch (e) {
    console.warn("[taxSettings] LocalStorage error:", e);
  }
}

/**
 * Loads tax settings for a given cafe.
 * Prioritizes cafeRecord.tax_settings if passed, then localStorage, then default.
 */
export function getTaxSettings(
  cafeId?: string,
  cafeRecord?: { tax_settings?: any } | null
): TaxSettings {
  if (cafeRecord && cafeRecord.tax_settings) {
    try {
      const parsed =
        typeof cafeRecord.tax_settings === "string"
          ? JSON.parse(cafeRecord.tax_settings)
          : cafeRecord.tax_settings;
      if (parsed && typeof parsed === "object") {
        const merged: TaxSettings = { ...DEFAULT_TAX_SETTINGS, ...parsed };
        saveTaxSettingsToLocalStorage(merged, cafeId);
        return merged;
      }
    } catch (e) {
      console.warn("[taxSettings] Failed to parse cafeRecord.tax_settings:", e);
    }
  }

  try {
    const key = `orderrail_tax_settings_${cafeId || "default"}`;
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem(key);
      if (stored) {
        return { ...DEFAULT_TAX_SETTINGS, ...JSON.parse(stored) };
      }
    }
  } catch (e) {
    console.warn("[taxSettings] Failed to read from localStorage:", e);
  }
  return DEFAULT_TAX_SETTINGS;
}

/**
 * Saves tax settings for a given cafe to localStorage AND persists to PostgreSQL.
 */
export async function saveTaxSettings(settings: TaxSettings, cafeId?: string): Promise<void> {
  saveTaxSettingsToLocalStorage(settings, cafeId);

  if (cafeId) {
    const { error } = await supabase
      .from("cafes")
      .update({ tax_settings: settings as any })
      .eq("id", cafeId);
    if (error) {
      console.warn("[taxSettings] Failed to persist tax settings to database:", error.message);
      throw error;
    }
  }
}

/**
 * Fetches tax settings directly from PostgreSQL database for a cafe.
 */
export async function fetchTaxSettingsFromDb(cafeId: string): Promise<TaxSettings> {
  if (!cafeId) return DEFAULT_TAX_SETTINGS;
  try {
    const { data, error } = await supabase
      .from("cafes")
      .select("tax_settings")
      .eq("id", cafeId)
      .maybeSingle();

    if (!error && data && data.tax_settings) {
      const parsed =
        typeof data.tax_settings === "string"
          ? JSON.parse(data.tax_settings)
          : data.tax_settings;
      const settings: TaxSettings = { ...DEFAULT_TAX_SETTINGS, ...parsed };
      saveTaxSettingsToLocalStorage(settings, cafeId);
      return settings;
    }
  } catch (err) {
    console.warn("[taxSettings] Error fetching tax settings from DB:", err);
  }
  return getTaxSettings(cafeId);
}
