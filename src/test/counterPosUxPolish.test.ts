import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { MenuRow, TableRail, OrderCard, MenuPanel } from "@/pages/counter/CounterPage";
import type { CatalogItem, SessionOrder } from "@/types/counter";
import type { TableEntity, TableSessionData } from "@/types/counter";

describe("Counter POS UX Polish Test Suite", () => {
  describe("1. OrderCard Action Layout (50/50 Grid & Full-Width Primary)", () => {
    const pendingOrder: SessionOrder = {
      id: "ord-1",
      orderNumber: 101,
      tableLabel: "Table 1",
      status: "PENDING",
      items: [
        { id: "item-1", name: "Margherita Pizza", price: 150, qty: 1 }
      ],
      subtotal: 150,
      createdAt: new Date().toISOString(),
    };

    const acceptedOrder: SessionOrder = {
      id: "ord-2",
      orderNumber: 102,
      tableLabel: "Table 1",
      status: "ACCEPTED",
      items: [
        { id: "item-2", name: "French Fries", price: 80, qty: 1 }
      ],
      subtotal: 80,
      createdAt: new Date().toISOString(),
    };

    it("renders Cancel and Modify in a 2-column grid and Accept Order full-width", () => {
      const onCancel = vi.fn();
      const onModify = vi.fn();
      const onAccept = vi.fn();

      const { getByText, container } = render(
        React.createElement(OrderCard, {
          order: pendingOrder,
          tableLabel: "Table 1",
          onCancelOrder: onCancel,
          onModifyOrder: onModify,
          onAcceptOrder: onAccept,
        })
      );

      // Check Cancel and Modify exist
      const cancelBtn = getByText("Cancel").closest("button");
      const modifyBtn = getByText("Modify").closest("button");
      const acceptBtn = getByText("Accept Order").closest("button");

      expect(cancelBtn).not.toBeNull();
      expect(modifyBtn).not.toBeNull();
      expect(acceptBtn).not.toBeNull();

      // Check 2-column grid container
      const gridContainer = container.querySelector(".grid.grid-cols-2");
      expect(gridContainer).not.toBeNull();
      expect(gridContainer?.contains(cancelBtn!)).toBe(true);
      expect(gridContainer?.contains(modifyBtn!)).toBe(true);

      // Verify Cancel visual classes (red theme)
      expect(cancelBtn?.className).toContain("text-red-600");
      expect(cancelBtn?.className).toContain("border-red-500/30");
      expect(cancelBtn?.className).toContain("bg-red-500/10");

      // Verify Modify visual classes (blue theme)
      expect(modifyBtn?.className).toContain("text-blue-600");
      expect(modifyBtn?.className).toContain("border-blue-500/30");
      expect(modifyBtn?.className).toContain("bg-blue-500/10");

      // Verify Accept Order is full width
      expect(acceptBtn?.className).toContain("w-full");
      expect(acceptBtn?.className).toContain("bg-amber-600");

      // Verify click handlers
      fireEvent.click(cancelBtn!);
      expect(onCancel).toHaveBeenCalledWith(pendingOrder, "Table 1");

      fireEvent.click(modifyBtn!);
      expect(onModify).toHaveBeenCalledWith(pendingOrder, "Table 1");

      fireEvent.click(acceptBtn!);
      expect(onAccept).toHaveBeenCalledWith("ord-1", 101, pendingOrder);
    });

    it("renders Cancel and Modify in a 2-column grid with Send KOT full-width for accepted orders", () => {
      const onCancel = vi.fn();
      const onModify = vi.fn();
      const onSendKot = vi.fn();

      const { getByText, container } = render(
        React.createElement(OrderCard, {
          order: acceptedOrder,
          tableLabel: "Table 1",
          onCancelOrder: onCancel,
          onModifyOrder: onModify,
          onSendKot: onSendKot,
        })
      );

      const cancelBtn = getByText("Cancel").closest("button");
      const modifyBtn = getByText("Modify").closest("button");
      const sendKotBtn = getByText("Send KOT").closest("button");

      const gridContainer = container.querySelector(".grid.grid-cols-2");
      expect(gridContainer).not.toBeNull();
      expect(gridContainer?.contains(cancelBtn!)).toBe(true);
      expect(gridContainer?.contains(modifyBtn!)).toBe(true);

      expect(sendKotBtn?.className).toContain("w-full");
      expect(sendKotBtn?.className).toContain("bg-primary");

      fireEvent.click(sendKotBtn!);
      expect(onSendKot).toHaveBeenCalledWith(acceptedOrder, "Table 1");
    });
  });

  describe("2. TableRail Overflow Structure & Chip Scrolling", () => {
    const mockTables: TableEntity[] = [
      { id: "t1", label: "T1", seats: 4, status: "AVAILABLE" },
      { id: "t2", label: "T2", seats: 2, status: "OCCUPIED" },
    ];
    const mockSessions: Record<string, TableSessionData> = {};

    it("outer rail does not have overflow-x-auto, but inner .v8-rail-chips retains scrolling", () => {
      const onSelect = vi.fn();
      const onSelectOrderMode = vi.fn();

      const { container } = render(
        React.createElement(TableRail, {
          tables: mockTables,
          tableSessions: mockSessions,
          nowMs: Date.now(),
          selectedId: "t1",
          onSelect,
          orderMode: "DINE_IN",
          onSelectOrderMode,
        })
      );

      const outerRail = container.querySelector(".v8-table-rail");
      expect(outerRail).not.toBeNull();
      // Outer rail MUST NOT have overflow-x-auto
      expect(outerRail?.className).not.toContain("overflow-x-auto");

      // Inner chips scroller MUST exist and have v8-rail-chips class
      const chipsScroller = container.querySelector(".v8-rail-chips");
      expect(chipsScroller).not.toBeNull();

      // Check order mode buttons render
      expect(container.textContent).toContain("Dine-In");
      expect(container.textContent).toContain("Takeaway");
      expect(container.textContent).toContain("Swiggy");
      expect(container.textContent).toContain("Zomato");

      // Check table chips render
      expect(container.textContent).toContain("T1");
      expect(container.textContent).toContain("T2");
    });
  });

  describe("3. MenuPanel Category Grouping, Sorting & Search", () => {
    const catalogItems: CatalogItem[] = [
      { id: "p2", name: "Farmhouse Pizza", price: 200, category: "Pizza", isVeg: true, isAvailable: true, sortOrder: 1 },
      { id: "p1", name: "Margherita Pizza", price: 150, category: "Pizza", isVeg: true, isAvailable: true, sortOrder: 0 },
      { id: "p3", name: "Cheese Burst Pizza", price: 250, category: "Pizza", isVeg: true, isAvailable: false, sortOrder: 0 },
      { id: "b1", name: "Veg Burger", price: 90, category: "Burger", isVeg: true, isAvailable: true, sortOrder: 0 },
      { id: "b2", name: "Cheese Burger", price: 120, category: "Burger", isVeg: true, isAvailable: true, sortOrder: 0 },
    ];
    const categoriesList = ["Burger", "Pizza"];
    const searchRef = { current: null };

    it("groups items by category with section headers when All is selected", () => {
      const onAdd = vi.fn();

      const { container } = render(
        React.createElement(MenuPanel, {
          catalog: catalogItems,
          categoriesList,
          searchRef,
          onAdd,
        })
      );

      // Category buttons in track
      const catButtons = Array.from(container.querySelectorAll(".v8-cat-btn")).map((b) => b.textContent?.trim());
      expect(catButtons).toEqual(["All", "Burger", "Pizza"]);

      // Section headers in menu scroll
      const sectionHeaders = Array.from(
        container.querySelectorAll(".v8-menu-scroll .sticky span:first-child")
      ).map((el) => el.textContent?.trim());
      expect(sectionHeaders).toEqual(["Burger", "Pizza"]);

      // Check items are rendered in order: Burger section first, Pizza section second
      const rowNames = Array.from(container.querySelectorAll(".v8-menu-row-name")).map(
        (el) => el.textContent?.trim()
      );

      // In Burger: Cheese Burger (sortOrder 0, A-Z), Veg Burger (sortOrder 0, A-Z)
      // In Pizza: Margherita (sort 0), Farmhouse (sort 1), Cheese Burst (sold out placed last)
      expect(rowNames).toEqual([
        "Cheese Burger",
        "Veg Burger",
        "Margherita Pizza",
        "Farmhouse Pizza",
        "Cheese Burst Pizza",
      ]);
    });

    it("filters to a specific category without redundant category headers", () => {
      const onAdd = vi.fn();

      const { container } = render(
        React.createElement(MenuPanel, {
          catalog: catalogItems,
          categoriesList,
          searchRef,
          onAdd,
        })
      );

      // Click on Burger category pill button
      const burgerPill = Array.from(container.querySelectorAll(".v8-cat-btn")).find(
        (el) => el.textContent?.trim() === "Burger"
      );
      expect(burgerPill).not.toBeUndefined();
      fireEvent.click(burgerPill!);

      // Redundant category section header should NOT exist
      const sectionHeaders = container.querySelectorAll(".v8-menu-scroll .sticky");
      expect(sectionHeaders.length).toBe(0);

      // Only burger items should be visible
      const rowNames = Array.from(container.querySelectorAll(".v8-menu-row-name")).map(
        (el) => el.textContent?.trim()
      );
      expect(rowNames).toEqual(["Cheese Burger", "Veg Burger"]);
    });

    it("preserves category grouping when searching across all categories", () => {
      const onAdd = vi.fn();

      const { container } = render(
        React.createElement(MenuPanel, {
          catalog: catalogItems,
          categoriesList,
          searchRef,
          onAdd,
        })
      );

      const searchInput = container.querySelector(".v8-search-input") as HTMLInputElement;
      expect(searchInput).not.toBeNull();

      fireEvent.change(searchInput, { target: { value: "Cheese" } });

      const rowNames = Array.from(container.querySelectorAll(".v8-menu-row-name")).map(
        (el) => el.textContent?.trim()
      );

      // Should find Cheese Burger in Burger section and Cheese Burst in Pizza section
      expect(rowNames).toEqual(["Cheese Burger", "Cheese Burst Pizza"]);
    });
  });

  describe("4. MenuRow 44px Row Height & 28px Add Button", () => {
    const item: CatalogItem = {
      id: "it-1",
      name: "Cold Coffee",
      price: 99,
      category: "Beverages",
      isVeg: true,
      isAvailable: true,
    };

    it("renders MenuRow with 44px height classes and 28px add button", () => {
      const onAdd = vi.fn();

      const { container } = render(
        React.createElement(MenuRow, {
          item,
          onAdd,
        })
      );

      const row = container.querySelector(".v8-menu-row");
      expect(row).not.toBeNull();
      expect(row?.className).toContain("min-h-[44px]");
      expect(row?.className).toContain("h-[44px]");

      const addBtn = container.querySelector(".v8-menu-add-btn");
      expect(addBtn).not.toBeNull();
      expect(addBtn?.className).toContain("w-7");
      expect(addBtn?.className).toContain("h-7");

      fireEvent.click(addBtn!);
      expect(onAdd).toHaveBeenCalledWith(item);
    });
  });
});
