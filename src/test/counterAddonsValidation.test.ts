import { describe, it, expect } from "vitest";
import {
  getEligibleAddons,
  calculateCombinedUnitPrice,
  formatAddonNotes,
  getLineIdentityKey,
} from "@/lib/addons";
import { KotBuilder } from "@/lib/printing/kotBuilder";
import { mapOrderToSessionOrder } from "@/pages/counter/CounterPage";

describe("Part D: Counter POS Add-ons Validation Suite", () => {
  it("1. Burger exposes Cheese Slice and Cheese Injector", () => {
    const burger = { categoryId: "burger", name: "Garden Fresh Burger" };
    const addons = getEligibleAddons(burger);
    expect(addons.map((a) => a.id)).toEqual(["cheese-slice", "cheese-injector"]);
  });

  it("2. Shake exposes Ice Cream Scoop", () => {
    const shake = { categoryId: "shakes", name: "Kit Kat Shake" };
    const addons = getEligibleAddons(shake);
    expect(addons.map((a) => a.id)).toEqual(["ice-cream-scoop"]);
  });

  it("3. Ice Cream exposes no add-ons", () => {
    const iceCream = { categoryId: "dessert", name: "Vanilla Ice Cream" };
    const addons = getEligibleAddons(iceCream);
    expect(addons.length).toBe(0);
  });

  it("4. Unrelated items expose no Add-ons control", () => {
    const fries = { categoryId: "fries", name: "French Fries" };
    const pizza = { categoryId: "pizza", name: "Margherita" };
    expect(getEligibleAddons(fries).length).toBe(0);
    expect(getEligibleAddons(pizza).length).toBe(0);
  });

  it("5. Selecting Cheese Slice updates line price correctly", () => {
    const basePrice = 59;
    const selected = ["cheese-slice"]; // ₹20
    const price = calculateCombinedUnitPrice(basePrice, selected);
    expect(price).toBe(79);
  });

  it("6. Selecting Cheese Slice + Cheese Injector updates line price correctly", () => {
    const basePrice = 59;
    const selected = ["cheese-slice", "cheese-injector"]; // ₹20 + ₹30 = ₹50
    const price = calculateCombinedUnitPrice(basePrice, selected);
    expect(price).toBe(109);
  });

  it("7. Removing an add-on restores the correct price", () => {
    const basePrice = 59;
    const selected: string[] = [];
    const price = calculateCombinedUnitPrice(basePrice, selected);
    expect(price).toBe(59);
    expect(formatAddonNotes(selected)).toBe("");
  });

  it("8. Different add-on combinations remain separate lines", () => {
    const itemId = "garden-fresh-burger";
    const key1 = getLineIdentityKey(itemId, ["cheese-slice"]);
    const key2 = getLineIdentityKey(itemId, ["cheese-injector"]);
    const key3 = getLineIdentityKey(itemId, ["cheese-slice", "cheese-injector"]);

    expect(key1).toBe("garden-fresh-burger:cheese-slice");
    expect(key2).toBe("garden-fresh-burger:cheese-injector");
    expect(key3).toBe("garden-fresh-burger:cheese-injector,cheese-slice");
    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
  });

  it("9. Identical add-on combinations merge correctly", () => {
    const itemId = "garden-fresh-burger";
    const keyA = getLineIdentityKey(itemId, ["cheese-slice", "cheese-injector"]);
    const keyB = getLineIdentityKey(itemId, ["cheese-injector", "cheese-slice"]);
    expect(keyA).toBe(keyB);
  });

  it("10. Counter-selected add-ons reach the KOT payload", () => {
    const basePrice = 59;
    const selected = ["cheese-slice", "cheese-injector"];
    const combinedPrice = calculateCombinedUnitPrice(basePrice, selected);
    const notes = formatAddonNotes(selected);

    const kot = KotBuilder.buildText({
      kotNumber: 101,
      orderNumber: 101,
      tableLabel: "T-01",
      items: [
        {
          name: "Garden Fresh Burger",
          qty: 1,
          price: combinedPrice,
          notes: notes,
        },
      ],
    });

    expect(kot).toContain("Garden Fresh Burger");
    expect(kot).toContain("> Cheese Slice (+₹20), Cheese Injector (+₹30)");
  });

  it("11. Existing orders without add-ons remain unchanged", () => {
    const ord: any = {
      id: "ord-1",
      order_number: 5,
      created_at: new Date().toISOString(),
      status: "preparing",
      total_cents: 5900,
      order_items: [
        {
          id: "it-1",
          name: "Garden Fresh Burger",
          price_cents: 5900,
          qty: 1,
          note: null,
        },
      ],
    };

    const sessionOrd = mapOrderToSessionOrder(ord);
    expect(sessionOrd.items[0].price).toBe(59);
    expect(sessionOrd.items[0].notes).toBeUndefined();
  });
});
