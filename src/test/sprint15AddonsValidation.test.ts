import { describe, it, expect } from "vitest";
import {
  getEligibleAddons,
  calculateCombinedUnitPrice,
  formatAddonNotes,
  getLineIdentityKey,
} from "@/lib/addons";
import { KotBuilder } from "@/lib/printing/kotBuilder";
import { ReceiptBuilder } from "@/lib/printing/receiptBuilder";

describe("Sprint 15: Cheese Corner Add-ons Integration Suite", () => {
  it("1. Category-Based Add-on Eligibility", () => {
    const burgerItem = { categoryId: "burger", name: "Corn Cheese Burger" };
    const shakeItem = { categoryId: "shakes", name: "Kit Kat Shake" };
    const waterItem = { categoryId: "beverages", name: "Mineral Water Bottle" };

    const burgerAddons = getEligibleAddons(burgerItem);
    const shakeAddons = getEligibleAddons(shakeItem);
    const waterAddons = getEligibleAddons(waterItem);

    expect(burgerAddons.some((a) => a.id === "cheese-slice")).toBe(true);
    expect(burgerAddons.some((a) => a.id === "cheese-injector")).toBe(true);
    expect(burgerAddons.some((a) => a.id === "ice-cream-scoop")).toBe(false);

    expect(shakeAddons.some((a) => a.id === "ice-cream-scoop")).toBe(true);
    expect(shakeAddons.some((a) => a.id === "cheese-injector")).toBe(false);

    expect(waterAddons.length).toBe(0);
  });

  it("2. Combined Unit Price & Notes Formatting", () => {
    const basePrice = 89; // Cheese Garlic Bread ₹89
    const selectedAddons = ["double-cheese"]; // ₹40

    const totalPrice = calculateCombinedUnitPrice(basePrice, selectedAddons);
    const formattedNote = formatAddonNotes(selectedAddons);

    expect(totalPrice).toBe(129);
    expect(formattedNote).toBe("Double Cheese (+₹40)");
  });

  it("3. Line Identity & Cart Deduplication Keys", () => {
    const itemId = "menu-item-123";
    const keyNoAddons = getLineIdentityKey(itemId, []);
    const keyWithCheese = getLineIdentityKey(itemId, ["cheese-slice"]);
    const keyWithDoubleCheese = getLineIdentityKey(itemId, ["double-cheese", "cheese-slice"]);
    const keyReordered = getLineIdentityKey(itemId, ["cheese-slice", "double-cheese"]);

    expect(keyNoAddons).toBe("menu-item-123");
    expect(keyWithCheese).toBe("menu-item-123:cheese-slice");
    expect(keyWithDoubleCheese).toBe("menu-item-123:cheese-slice,double-cheese");
    expect(keyReordered).toBe("menu-item-123:cheese-slice,double-cheese"); // Sorted match!
    expect(keyWithCheese).not.toBe(keyNoAddons);
  });

  it("4. KOT Formatting with Item Add-on Modifiers", () => {
    const kotResult = KotBuilder.buildText({
      type: "KOT",
      orderNumber: 101,
      tableLabel: "T-04",
      timestamp: "12:30 PM",
      items: [
        {
          id: "item-1",
          name: "Cheese Garlic Bread",
          price: 129,
          qty: 1,
          modifiers: ["Double Cheese (+₹40)"],
        },
      ],
    });

    expect(kotResult).toContain("Cheese Garlic Bread");
    expect(kotResult).toContain("> Double Cheese (+₹40)");
  });

  it("5. Receipt Formatting with Item Add-on Notes", () => {
    const receiptResult = ReceiptBuilder.buildText({
      billNumber: "B-1001",
      tableLabel: "T-04",
      cashierName: "Staff",
      timestamp: "12:35 PM",
      items: [
        {
          name: "Cheese Garlic Bread",
          price: 129,
          qty: 1,
          notes: "Double Cheese (+₹40)",
        },
      ],
      subtotal: 129,
      tax: 6.45,
      netTotal: 135.45,
    });

    expect(receiptResult).toContain("Cheese Garlic");
    expect(receiptResult).toContain("+ Double Cheese (+₹40)");
    expect(receiptResult).toContain("Rs.129.00");
  });
});
