import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { MenuRow } from "@/pages/counter/CounterPage";
import type { CatalogItem } from "@/types/counter";

describe("Counter POS MenuRow Click Hitbox & Propagation Test Suite", () => {
  const sampleItem: CatalogItem = {
    id: "item-1",
    name: "Espresso Coffee",
    price: 120,
    category: "Coffee",
    categoryId: "coffee",
    isVeg: true,
    isAvailable: true,
  };

  const burgerWithAddons: CatalogItem = {
    id: "burger-1",
    name: "Garden Fresh Burger",
    price: 180,
    category: "Burger",
    categoryId: "burger",
    isVeg: true,
    isAvailable: true,
  };

  const soldOutItem: CatalogItem = {
    id: "item-2",
    name: "Special Pastry",
    price: 150,
    category: "Dessert",
    categoryId: "dessert",
    isVeg: true,
    isAvailable: false,
  };

  it("1. Outer tile click calls onAdd(item)", () => {
    const onAdd = vi.fn();
    const { container } = render(
      React.createElement(MenuRow, { item: sampleItem, onAdd })
    );

    const outerTile = container.querySelector(".v8-menu-row");
    expect(outerTile).not.toBeNull();

    fireEvent.click(outerTile!);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(sampleItem);
  });

  it("2. Clicking the tile's normal content (item name) still calls onAdd exactly once", () => {
    const onAdd = vi.fn();
    const { getByText } = render(
      React.createElement(MenuRow, { item: sampleItem, onAdd })
    );

    const nameElement = getByText("Espresso Coffee");
    fireEvent.click(nameElement);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(sampleItem);
  });

  it("3. Clicking the price does not cause duplicate calls", () => {
    const onAdd = vi.fn();
    const { getByText } = render(
      React.createElement(MenuRow, { item: sampleItem, onAdd })
    );

    const priceElement = getByText("₹120.00");
    fireEvent.click(priceElement);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(sampleItem);
  });

  it("4. Clicking + ADD-ONS calls onAddWithAddons exactly once and does NOT call onAdd", () => {
    const onAdd = vi.fn();
    const onAddWithAddons = vi.fn();
    const { getByText } = render(
      React.createElement(MenuRow, { item: burgerWithAddons, onAdd, onAddWithAddons })
    );

    const addonBtn = getByText("+ ADD-ONS");
    fireEvent.click(addonBtn);

    expect(onAddWithAddons).toHaveBeenCalledTimes(1);
    expect(onAddWithAddons).toHaveBeenCalledWith(burgerWithAddons);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("5. Clicking the normal + button calls onAdd exactly once", () => {
    const onAdd = vi.fn();
    const { container } = render(
      React.createElement(MenuRow, { item: sampleItem, onAdd })
    );

    const plusBtn = container.querySelector(".v8-menu-add-btn");
    expect(plusBtn).not.toBeNull();

    fireEvent.click(plusBtn!);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(sampleItem);
  });

  it("6. Clicking a sold-out tile does not call onAdd", () => {
    const onAdd = vi.fn();
    const { container } = render(
      React.createElement(MenuRow, { item: soldOutItem, onAdd })
    );

    const outerTile = container.querySelector(".v8-menu-row");
    expect(outerTile).not.toBeNull();

    fireEvent.click(outerTile!);

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("7. Sold-out + button remains disabled/non-functional", () => {
    const onAdd = vi.fn();
    const { container } = render(
      React.createElement(MenuRow, { item: soldOutItem, onAdd })
    );

    const plusBtn = container.querySelector(".v8-menu-add-btn") as HTMLButtonElement;
    expect(plusBtn).not.toBeNull();
    expect(plusBtn.disabled).toBe(true);

    fireEvent.click(plusBtn);

    expect(onAdd).not.toHaveBeenCalled();
  });
});
