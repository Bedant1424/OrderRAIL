/**
 * Cheese Corner Add-ons Helper & Category Eligibility Engine
 */

export interface Addon {
  id: string;
  name: string;
  price: number; // in INR (₹)
  status: "available" | "unavailable";
  taxIncluded?: boolean;
}

export const CHEESECORNER_ADDONS: Addon[] = [
  {
    id: "cheese-slice",
    name: "Cheese Slice",
    price: 20,
    status: "available",
    taxIncluded: true,
  },
  {
    id: "cheese-injector",
    name: "Cheese Injector",
    price: 30,
    status: "available",
    taxIncluded: true,
  },
  {
    id: "ice-cream-scoop",
    name: "Ice Cream Scoop",
    price: 30,
    status: "available",
    taxIncluded: true,
  },
];

/**
 * Returns available add-ons for a given item based on its category ID or item name.
 * STRICT ELIGIBILITY:
 * - Burger -> Cheese Slice (+₹20), Cheese Injector (+₹30)
 * - Shakes -> Ice Cream Scoop (+₹30)
 * - Everything else -> No add-ons ([])
 */
export function getEligibleAddons(item: { categoryId?: string | null; name?: string }): Addon[] {
  if (!item) return [];

  const catId = (item.categoryId || "").toLowerCase().trim();
  const name = (item.name || "").toLowerCase().trim();

  // Strict check for Burger: categoryId is "burger"/"burgers" OR item name contains "burger"
  const isBurger = catId === "burger" || catId === "burgers" || name.includes("burger");

  // Strict check for Shakes: categoryId is "shakes"/"shake" OR item name contains "shake"
  // Must NOT match ice cream, coffee, cold coffee, beverages, etc.
  const isShake = catId === "shakes" || catId === "shake" || name.includes("shake");

  if (isBurger) {
    return CHEESECORNER_ADDONS.filter(
      (a) => (a.id === "cheese-slice" || a.id === "cheese-injector") && a.status === "available"
    );
  }

  if (isShake) {
    return CHEESECORNER_ADDONS.filter(
      (a) => a.id === "ice-cream-scoop" && a.status === "available"
    );
  }

  // Everything else receives no add-ons (no fallbacks!)
  return [];
}

/**
 * Calculates combined unit price in INR
 */
export function calculateCombinedUnitPrice(basePrice: number, selectedAddonIds: string[]): number {
  let total = basePrice;
  for (const addonId of selectedAddonIds) {
    const addon = CHEESECORNER_ADDONS.find((a) => a.id === addonId);
    if (addon) {
      total += addon.price;
    }
  }
  return total;
}

/**
 * Formats selected add-on names into a clean note string
 */
export function formatAddonNotes(selectedAddonIds: string[]): string {
  const parts: string[] = [];
  for (const id of selectedAddonIds) {
    const addon = CHEESECORNER_ADDONS.find((a) => a.id === id);
    if (addon) {
      parts.push(`${addon.name} (+₹${addon.price})`);
    }
  }
  return parts.join(", ");
}

/**
 * Generates unique line item key for cart deduplication
 */
export function getLineIdentityKey(menuItemId: string, selectedAddonIds: string[]): string {
  const sorted = [...selectedAddonIds].sort();
  return sorted.length > 0 ? `${menuItemId}:${sorted.join(",")}` : menuItemId;
}
