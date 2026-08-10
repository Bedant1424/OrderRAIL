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
    id: "double-cheese",
    name: "Double Cheese",
    price: 40,
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

const SAVORY_CATEGORIES = [
  "burger",
  "fries",
  "sandwich",
  "wrap",
  "momos",
  "maggi",
  "garlic-bread",
  "pizza",
];

const SWEET_CATEGORIES = [
  "cold-coffee",
  "shakes",
  "beverages",
  "desserts",
  "coffee",
];

/**
 * Returns available add-ons for a given item based on its category ID or item name.
 */
export function getEligibleAddons(item: { categoryId?: string | null; name?: string }): Addon[] {
  if (!item) return [];

  const catId = (item.categoryId || "").toLowerCase();
  const name = (item.name || "").toLowerCase();

  // Non-customizable exclusions
  if (name.includes("water") || name.includes("bottle") || name.includes("combo")) {
    return [];
  }

  const isSavory = SAVORY_CATEGORIES.some((c) => catId.includes(c) || name.includes(c));
  const isSweet = SWEET_CATEGORIES.some((c) => catId.includes(c) || name.includes(c));

  if (isSavory) {
    return CHEESECORNER_ADDONS.filter((a) => a.id !== "ice-cream-scoop" && a.status === "available");
  }

  if (isSweet) {
    return CHEESECORNER_ADDONS.filter((a) => a.id === "ice-cream-scoop" && a.status === "available");
  }

  // Default fallback for ambiguous items: return savory cheese add-ons if it contains savory keywords
  return CHEESECORNER_ADDONS.filter((a) => a.status === "available");
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
