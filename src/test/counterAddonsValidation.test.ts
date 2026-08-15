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

  it("12. Handles numeric IDs safely without throwing on string operations", () => {
    const numericItem: any = { id: 101, name: "Garden Fresh Burger", price: 59, qty: 1 };
    const rawId = typeof numericItem.id === "string" ? numericItem.id : String(numericItem.id || "");
    const menuItemId = numericItem.menuItemId || (rawId.includes(":") ? rawId.split(":")[0] : rawId);
    expect(menuItemId).toBe("101");

    const eligible = getEligibleAddons({ categoryId: menuItemId, name: numericItem.name });
    expect(eligible.length).toBe(2);
  });

  it("13. Handles line identities containing ':' delimiter safely", () => {
    const lineItem: any = { id: "garden-fresh-burger:cheese-slice", name: "Garden Fresh Burger", price: 79, qty: 1 };
    const rawId = typeof lineItem.id === "string" ? lineItem.id : String(lineItem.id || "");
    const menuItemId = lineItem.menuItemId || (rawId.includes(":") ? rawId.split(":")[0] : rawId);
    expect(menuItemId).toBe("garden-fresh-burger");

    const eligible = getEligibleAddons({ categoryId: menuItemId, name: lineItem.name });
    expect(eligible.length).toBe(2);
  });

  it("14. Handles undefined or null item IDs safely without throwing", () => {
    const nullIdItem: any = { id: null, name: "Kit Kat Shake", price: 119, qty: 1 };
    const rawId = typeof nullIdItem.id === "string" ? nullIdItem.id : String(nullIdItem.id || "");
    const menuItemId = nullIdItem.menuItemId || (rawId.includes(":") ? rawId.split(":")[0] : rawId);
    expect(menuItemId).toBe("");

    const eligible = getEligibleAddons({ categoryId: menuItemId, name: nullIdItem.name });
    expect(eligible.length).toBe(1);
  });

  it("15. Draft cart preserves separate lines for customized Burger vs plain Quick Add Burger", () => {
    const burgerId = "garden-fresh-burger";
    const customizedKey = getLineIdentityKey(burgerId, ["cheese-slice"]);
    const plainKey = getLineIdentityKey(burgerId, []);

    expect(customizedKey).toBe("garden-fresh-burger:cheese-slice");
    expect(plainKey).toBe("garden-fresh-burger");

    // Simulate draftCart state
    let draftCart: any[] = [
      {
        id: customizedKey,
        menuItemId: burgerId,
        name: "Garden Fresh Burger",
        price: 79,
        basePrice: 59,
        qty: 1,
        selectedAddonIds: ["cheese-slice"],
        notes: "Cheese Slice (+₹20)",
      },
    ];

    // Quick Add plain Burger
    const existingIndex = draftCart.findIndex((i) => i.id === plainKey);
    if (existingIndex !== -1) {
      draftCart = draftCart.map((i, idx) => (idx === existingIndex ? { ...i, qty: i.qty + 1 } : i));
    } else {
      draftCart = [
        ...draftCart,
        {
          id: plainKey,
          menuItemId: burgerId,
          name: "Garden Fresh Burger",
          price: 59,
          basePrice: 59,
          qty: 1,
          selectedAddonIds: [],
        },
      ];
    }

    expect(draftCart.length).toBe(2);
    expect(draftCart[0].id).toBe("garden-fresh-burger:cheese-slice");
    expect(draftCart[0].qty).toBe(1);
    expect(draftCart[1].id).toBe("garden-fresh-burger");
    expect(draftCart[1].qty).toBe(1);
  });

  it("16. Draft cart preserves separate lines for customized Shake vs plain Quick Add Shake", () => {
    const shakeId = "kit-kat-shake";
    const customizedKey = getLineIdentityKey(shakeId, ["ice-cream-scoop"]);
    const plainKey = getLineIdentityKey(shakeId, []);

    expect(customizedKey).toBe("kit-kat-shake:ice-cream-scoop");
    expect(plainKey).toBe("kit-kat-shake");

    let draftCart: any[] = [
      {
        id: customizedKey,
        menuItemId: shakeId,
        name: "Kit Kat Shake",
        price: 149,
        basePrice: 119,
        qty: 1,
        selectedAddonIds: ["ice-cream-scoop"],
        notes: "Ice Cream Scoop (+₹30)",
      },
    ];

    const existingIndex = draftCart.findIndex((i) => i.id === plainKey);
    if (existingIndex !== -1) {
      draftCart = draftCart.map((i, idx) => (idx === existingIndex ? { ...i, qty: i.qty + 1 } : i));
    } else {
      draftCart = [
        ...draftCart,
        {
          id: plainKey,
          menuItemId: shakeId,
          name: "Kit Kat Shake",
          price: 119,
          basePrice: 119,
          qty: 1,
          selectedAddonIds: [],
        },
      ];
    }

    expect(draftCart.length).toBe(2);
    expect(draftCart[0].id).toBe("kit-kat-shake:ice-cream-scoop");
    expect(draftCart[0].qty).toBe(1);
    expect(draftCart[1].id).toBe("kit-kat-shake");
    expect(draftCart[1].qty).toBe(1);
  });

  it("17. Identical add-on combinations merge quantity into 1 line (qty 2)", () => {
    const burgerId = "garden-fresh-burger";
    const key = getLineIdentityKey(burgerId, ["cheese-slice"]);

    let draftCart: any[] = [
      {
        id: key,
        menuItemId: burgerId,
        name: "Garden Fresh Burger",
        price: 79,
        basePrice: 59,
        qty: 1,
        selectedAddonIds: ["cheese-slice"],
      },
    ];

    const existingIndex = draftCart.findIndex((i) => i.id === key);
    if (existingIndex !== -1) {
      draftCart = draftCart.map((i, idx) => (idx === existingIndex ? { ...i, qty: i.qty + 1 } : i));
    }

    expect(draftCart.length).toBe(1);
    expect(draftCart[0].id).toBe("garden-fresh-burger:cheese-slice");
    expect(draftCart[0].qty).toBe(2);
  });

  it("18. Plain items added twice merge quantity into 1 line (qty 2)", () => {
    const burgerId = "garden-fresh-burger";
    const key = getLineIdentityKey(burgerId, []);

    let draftCart: any[] = [
      {
        id: key,
        menuItemId: burgerId,
        name: "Garden Fresh Burger",
        price: 59,
        basePrice: 59,
        qty: 1,
        selectedAddonIds: [],
      },
    ];

    const existingIndex = draftCart.findIndex((i) => i.id === key);
    if (existingIndex !== -1) {
      draftCart = draftCart.map((i, idx) => (idx === existingIndex ? { ...i, qty: i.qty + 1 } : i));
    }

    expect(draftCart.length).toBe(1);
    expect(draftCart[0].id).toBe("garden-fresh-burger");
    expect(draftCart[0].qty).toBe(2);
  });

  it("19. Different add-on combinations create separate lines", () => {
    const burgerId = "garden-fresh-burger";
    const key1 = getLineIdentityKey(burgerId, ["cheese-slice"]);
    const key2 = getLineIdentityKey(burgerId, ["cheese-injector"]);

    let draftCart: any[] = [
      {
        id: key1,
        menuItemId: burgerId,
        name: "Garden Fresh Burger",
        price: 79,
        basePrice: 59,
        qty: 1,
        selectedAddonIds: ["cheese-slice"],
      },
    ];

    const existingIndex = draftCart.findIndex((i) => i.id === key2);
    if (existingIndex !== -1) {
      draftCart = draftCart.map((i, idx) => (idx === existingIndex ? { ...i, qty: i.qty + 1 } : i));
    } else {
      draftCart = [
        ...draftCart,
        {
          id: key2,
          menuItemId: burgerId,
          name: "Garden Fresh Burger",
          price: 89,
          basePrice: 59,
          qty: 1,
          selectedAddonIds: ["cheese-injector"],
        },
      ];
    }

    expect(draftCart.length).toBe(2);
    expect(draftCart[0].id).toBe("garden-fresh-burger:cheese-slice");
    expect(draftCart[1].id).toBe("garden-fresh-burger:cheese-injector");
  });
});
