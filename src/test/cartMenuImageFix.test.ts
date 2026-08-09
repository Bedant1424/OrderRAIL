import { describe, it, expect } from "vitest";
import { resolveImageUrlSync } from "../lib/useImageUrl";

describe("Sprint 12E - Customer Cart Menu Item Image Fix", () => {
  it("resolves raw storage image_urls for items added to cart", () => {
    const cartItem = {
      id: "item-nachos-1",
      name: "Nachos With Cheese Dip",
      price_cents: 22000,
      image_url: "menu-images/6d00d671-eaea-47ce-a842-f970878373c9/nachos-cheese-dip.jpg",
    };

    // Before fix: CartView received raw storage string and failed to load
    expect(cartItem.image_url).toBe("menu-images/6d00d671-eaea-47ce-a842-f970878373c9/nachos-cheese-dip.jpg");

    // After fix: resolveImageUrlSync / MenuImage resolves storage path to valid public URL
    const resolvedUrl = resolveImageUrlSync(cartItem.image_url);
    expect(resolvedUrl).not.toBeNull();
    expect(resolvedUrl).toContain("/storage/v1/object/public/menu-images/6d00d671-eaea-47ce-a842-f970878373c9/nachos-cheese-dip.jpg");
  });

  it("handles null/missing image_urls cleanly with null fallback", () => {
    const itemWithoutImage = {
      id: "item-plain",
      name: "Plain Water",
      price_cents: 5000,
      image_url: null,
    };

    const resolvedUrl = resolveImageUrlSync(itemWithoutImage.image_url);
    expect(resolvedUrl).toBeNull();
  });
});
