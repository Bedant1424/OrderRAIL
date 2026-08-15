import { describe, it, expect } from "vitest";
import {
  CHEESECORNER_ADDONS,
  getEligibleAddons,
  calculateCombinedUnitPrice,
  formatAddonNotes,
  getLineIdentityKey,
} from "@/lib/addons";
import { KotBuilder } from "@/lib/printing/kotBuilder";
import { ReceiptBuilder } from "@/lib/printing/receiptBuilder";
import { buildInvoiceRecords } from "@/lib/billing/invoiceService";

describe("Sprint 15: Cheese Corner Add-ons Integration Suite", () => {
  it("1. Strict Category Eligibility Rules", () => {
    const burgerItem = { categoryId: "burger", name: "Garden Fresh Burger" };
    const shakeItem = { categoryId: "shakes", name: "Kit Kat Shake" };
    const iceCreamItem = { categoryId: "dessert", name: "Vanilla Ice Cream" };
    const friesItem = { categoryId: "fries", name: "French Fries" };
    const pizzaItem = { categoryId: "pizza", name: "Margherita Pizza" };
    const sandwichItem = { categoryId: "sandwich", name: "Veg Sandwich" };
    const garlicBreadItem = { categoryId: "garlic-bread", name: "Garlic Bread" };
    const beverageItem = { categoryId: "beverages", name: "Mineral Water Bottle" };
    const unknownItem = { categoryId: "unknown-category", name: "Mystery Snack" };

    const burgerAddons = getEligibleAddons(burgerItem);
    const shakeAddons = getEligibleAddons(shakeItem);
    const iceCreamAddons = getEligibleAddons(iceCreamItem);
    const friesAddons = getEligibleAddons(friesItem);
    const pizzaAddons = getEligibleAddons(pizzaItem);
    const sandwichAddons = getEligibleAddons(sandwichItem);
    const garlicBreadAddons = getEligibleAddons(garlicBreadItem);
    const beverageAddons = getEligibleAddons(beverageItem);
    const unknownAddons = getEligibleAddons(unknownItem);

    // 1. Burger returns Cheese Slice and Cheese Injector
    expect(burgerAddons.some((a) => a.id === "cheese-slice")).toBe(true);
    expect(burgerAddons.some((a) => a.id === "cheese-injector")).toBe(true);
    expect(burgerAddons.length).toBe(2);

    // 2. Burger does NOT return Double Cheese
    expect(burgerAddons.some((a) => a.id === "double-cheese")).toBe(false);

    // 3. Shake returns Ice Cream Scoop
    expect(shakeAddons.some((a) => a.id === "ice-cream-scoop")).toBe(true);
    expect(shakeAddons.length).toBe(1);

    // 4. Ice Cream returns no add-ons
    expect(iceCreamAddons.length).toBe(0);

    // 5. Fries return no add-ons
    expect(friesAddons.length).toBe(0);

    // 6. Pizza returns no add-ons
    expect(pizzaAddons.length).toBe(0);

    // 7. Sandwich returns no add-ons
    expect(sandwichAddons.length).toBe(0);

    // 8. Garlic Bread returns no add-ons
    expect(garlicBreadAddons.length).toBe(0);

    // 9. Beverages return no add-ons
    expect(beverageAddons.length).toBe(0);

    // 10. Unknown/unmatched category returns no add-ons
    expect(unknownAddons.length).toBe(0);
  });

  it("2. double-cheese is no longer present in the active add-on list", () => {
    // 11. double-cheese is no longer present in active list
    expect(CHEESECORNER_ADDONS.some((a) => a.id === "double-cheese")).toBe(false);
    expect(CHEESECORNER_ADDONS.map((a) => a.id)).toEqual([
      "cheese-slice",
      "cheese-injector",
      "ice-cream-scoop",
    ]);
  });

  it("3. Combined Unit Price & Notes Formatting", () => {
    const basePrice = 69; // Garden Fresh Burger ₹69
    const selectedAddons = ["cheese-slice"]; // ₹20

    const totalPrice = calculateCombinedUnitPrice(basePrice, selectedAddons);
    const formattedNote = formatAddonNotes(selectedAddons);

    expect(totalPrice).toBe(89);
    expect(formattedNote).toBe("Cheese Slice (+₹20)");
  });

  it("4. Line Identity & Cart Deduplication Keys", () => {
    const itemId = "garden-fresh-burger";
    const keyNoAddons = getLineIdentityKey(itemId, []);
    const keyWithCheese = getLineIdentityKey(itemId, ["cheese-slice"]);
    const keyWithBoth = getLineIdentityKey(itemId, ["cheese-injector", "cheese-slice"]);
    const keyReordered = getLineIdentityKey(itemId, ["cheese-slice", "cheese-injector"]);

    expect(keyNoAddons).toBe("garden-fresh-burger");
    expect(keyWithCheese).toBe("garden-fresh-burger:cheese-slice");
    expect(keyWithBoth).toBe("garden-fresh-burger:cheese-injector,cheese-slice");
    expect(keyReordered).toBe("garden-fresh-burger:cheese-injector,cheese-slice"); // Sorted match!
    expect(keyWithCheese).not.toBe(keyNoAddons);
  });

  it("5. KOT Formatting with Item Add-on Modifiers", () => {
    const kotResult = KotBuilder.buildText({
      type: "KOT",
      orderNumber: 101,
      tableLabel: "T-04",
      timestamp: "12:30 PM",
      items: [
        {
          id: "item-1",
          name: "Garden Fresh Burger",
          price: 89,
          qty: 1,
          modifiers: ["Cheese Slice (+₹20)"],
        },
      ],
    });

    expect(kotResult).toContain("Garden Fresh Burger");
    expect(kotResult).toContain("> Cheese Slice (+₹20)");
  });

  it("6. Receipt Formatting with Item Add-on Notes", () => {
    const receiptResult = ReceiptBuilder.buildText({
      billNumber: "B-1001",
      tableLabel: "T-04",
      cashierName: "Staff",
      timestamp: "12:35 PM",
      items: [
        {
          name: "Garden Fresh Burger",
          price: 89,
          qty: 1,
          notes: "Cheese Slice (+₹20)",
        },
      ],
      subtotal: 89,
      tax: 4.45,
      netTotal: 93.45,
    });

    expect(receiptResult).toContain("Garden Fresh");
    expect(receiptResult).toContain("+ Cheese Slice (+₹20)");
    expect(receiptResult).toContain("Rs.89.00");
  });

  it("7. Invoice Record Data Mapping Preserves Add-on Note & Handles Clean Items", () => {
    const mockOrder: any = {
      id: "ord-1001",
      order_number: 101,
      created_at: new Date().toISOString(),
      status: "served",
      total_cents: 16800,
      order_items: [
        {
          id: "item-1",
          name: "Garden Fresh Burger",
          qty: 1,
          price_cents: 8900,
          note: "Cheese Slice (+₹20)",
        },
        {
          id: "item-2",
          name: "French Fries",
          qty: 1,
          price_cents: 7900,
          note: null,
        },
      ],
    };

    const records = buildInvoiceRecords([mockOrder]);
    expect(records.length).toBe(1);
    expect(records[0].items[0].note).toBe("Cheese Slice (+₹20)");
    expect(records[0].items[1].note).toBeUndefined();
  });
});
