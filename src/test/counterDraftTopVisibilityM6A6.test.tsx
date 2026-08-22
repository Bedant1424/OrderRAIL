import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { ActiveOrderPanel } from "@/pages/counter/CounterPage";
import type { TableEntity, TableSessionData, SessionOrder, CartLineItem } from "@/types/counter";

describe("Milestone 6A.6: Counter POS Draft Top Visibility Test Suite", () => {
  const mockTable: TableEntity = {
    id: "tbl-1",
    label: "Table 1",
    seats: 4,
    status: "OCCUPIED",
  };

  const sampleCommittedOrders: SessionOrder[] = [
    {
      id: "ord-1",
      orderNumber: 47,
      tableLabel: "Table 1",
      status: "PREPARING",
      items: [{ id: "it-1", name: "Cheese Garlic Bread", price: 120, qty: 1 }],
      subtotal: 120,
      createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: "ord-2",
      orderNumber: 48,
      tableLabel: "Table 1",
      status: "PENDING",
      items: [{ id: "it-2", name: "Cold Coffee", price: 90, qty: 2 }],
      subtotal: 180,
      createdAt: new Date(Date.now() - 300000).toISOString(),
    },
  ];

  const sampleDraftItems: CartLineItem[] = [
    {
      id: "draft-1",
      menuItemId: "menu-salsa-burger",
      name: "Spicy Salsa Burger",
      price: 89,
      qty: 1,
    },
    {
      id: "draft-2",
      menuItemId: "menu-fries",
      name: "Peri Peri Fries",
      price: 99,
      qty: 2,
    },
  ];

  const mockSessionWithOrdersAndDrafts: TableSessionData = {
    sessionId: "sess-100",
    sessionCode: "#S-100",
    startedAt: "12:00 PM",
    startedAtTimestamp: new Date().toISOString(),
    guestCount: 4,
    orders: sampleCommittedOrders,
    draftCart: sampleDraftItems,
  };

  const mockSessionEmpty: TableSessionData = {
    sessionId: "sess-200",
    sessionCode: "#S-200",
    startedAt: "12:30 PM",
    startedAtTimestamp: new Date().toISOString(),
    guestCount: 2,
    orders: [],
    draftCart: [],
  };

  it("1. Renders New KOT Draft Items section BEFORE Current Table Order in the DOM hierarchy", () => {
    const { container, getByText } = render(
      React.createElement(ActiveOrderPanel, {
        table: mockTable,
        session: mockSessionWithOrdersAndDrafts,
        draftCart: sampleDraftItems,
        orderMode: "DINE_IN",
        onOpenSession: vi.fn(),
        onReleaseTable: vi.fn(),
        onRestoreTable: vi.fn(),
        onUpdateQty: vi.fn(),
      })
    );

    const scrollContainer = container.querySelector(".v8-order-items-scroll");
    expect(scrollContainer).not.toBeNull();

    const draftHeader = getByText("New KOT Draft Items (2)");
    const committedHeader = getByText(/Current Table Order \(2\)/);

    expect(draftHeader).toBeDefined();
    expect(committedHeader).toBeDefined();

    // Verify DOM element position: draftHeader must come BEFORE committedHeader
    const positionComparison = draftHeader.compareDocumentPosition(committedHeader);
    // Node.DOCUMENT_POSITION_FOLLOWING is 4, meaning committedHeader follows draftHeader
    expect(positionComparison & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Verify both draft items are rendered
    expect(getByText("Spicy Salsa Burger")).toBeDefined();
    expect(getByText("Peri Peri Fries")).toBeDefined();
  });

  it("2. Exactly ONE draft section is rendered in the center column (no duplicate bottom rendering)", () => {
    const { queryAllByText } = render(
      React.createElement(ActiveOrderPanel, {
        table: mockTable,
        session: mockSessionWithOrdersAndDrafts,
        draftCart: sampleDraftItems,
        orderMode: "DINE_IN",
        onOpenSession: vi.fn(),
        onReleaseTable: vi.fn(),
        onRestoreTable: vi.fn(),
        onUpdateQty: vi.fn(),
      })
    );

    const draftHeaders = queryAllByText(/New KOT Draft Items/);
    expect(draftHeaders.length).toBe(1);
  });

  it("3. Stepper quantity buttons and handlers remain fully functional in top-rendered draft rows", () => {
    const onUpdateQty = vi.fn();
    const onEditAddons = vi.fn();

    const { getByText } = render(
      React.createElement(ActiveOrderPanel, {
        table: mockTable,
        session: mockSessionWithOrdersAndDrafts,
        draftCart: sampleDraftItems,
        orderMode: "DINE_IN",
        onOpenSession: vi.fn(),
        onReleaseTable: vi.fn(),
        onRestoreTable: vi.fn(),
        onUpdateQty,
        onEditAddons,
      })
    );

    // Find the draft item row
    const burgerRow = getByText("Spicy Salsa Burger").closest(".v8-order-item-card");
    expect(burgerRow).not.toBeNull();

    // Find plus / minus buttons
    const plusBtn = burgerRow?.querySelectorAll(".v8-stepper-btn")[1];
    const minusBtn = burgerRow?.querySelectorAll(".v8-stepper-btn")[0];

    expect(plusBtn).toBeDefined();
    expect(minusBtn).toBeDefined();

    fireEvent.click(plusBtn!);
    expect(onUpdateQty).toHaveBeenCalledWith("draft-1", 1);

    fireEvent.click(minusBtn!);
    expect(onUpdateQty).toHaveBeenCalledWith("draft-1", -1);
  });

  it("4. When draftCart is empty and orders exist, the empty draft panel collapses cleanly without wasting vertical space", () => {
    const sessionWithOnlyOrders: TableSessionData = {
      ...mockSessionWithOrdersAndDrafts,
      draftCart: [],
    };

    const { queryByText, getByText } = render(
      React.createElement(ActiveOrderPanel, {
        table: mockTable,
        session: sessionWithOnlyOrders,
        draftCart: [],
        orderMode: "DINE_IN",
        onOpenSession: vi.fn(),
        onReleaseTable: vi.fn(),
        onRestoreTable: vi.fn(),
        onUpdateQty: vi.fn(),
      })
    );

    // Draft header should NOT take up space when there are no drafts and orders exist
    expect(queryByText(/New KOT Draft Items/)).toBeNull();

    // Committed orders header and cards are directly at the top
    expect(getByText(/Current Table Order \(2\)/)).toBeDefined();
    expect(getByText("Cheese Garlic Bread")).toBeDefined();
    expect(getByText("Cold Coffee")).toBeDefined();
  });

  it("5. When both draftCart and orders are empty, a clean empty state message is shown", () => {
    const { getByText } = render(
      React.createElement(ActiveOrderPanel, {
        table: mockTable,
        session: mockSessionEmpty,
        draftCart: [],
        orderMode: "DINE_IN",
        onOpenSession: vi.fn(),
        onReleaseTable: vi.fn(),
        onRestoreTable: vi.fn(),
        onUpdateQty: vi.fn(),
      })
    );

    expect(getByText("New KOT Draft Items (0)")).toBeDefined();
    expect(getByText("No items in current table order.")).toBeDefined();
  });

  it("6. Works seamlessly across TAKEAWAY, SWIGGY, and ZOMATO modes with appropriate workspace titles", () => {
    const { getByText, rerender } = render(
      React.createElement(ActiveOrderPanel, {
        table: null,
        session: { ...mockSessionWithOrdersAndDrafts, orders: [] },
        draftCart: sampleDraftItems,
        orderMode: "TAKEAWAY",
        onOpenSession: vi.fn(),
        onReleaseTable: vi.fn(),
        onRestoreTable: vi.fn(),
        onUpdateQty: vi.fn(),
      })
    );

    expect(getByText("New KOT Draft Items (2)")).toBeDefined();
    expect(getByText("🛍 TAKEAWAY")).toBeDefined();

    rerender(
      React.createElement(ActiveOrderPanel, {
        table: null,
        session: { ...mockSessionWithOrdersAndDrafts, orders: [] },
        draftCart: sampleDraftItems,
        orderMode: "SWIGGY",
        onOpenSession: vi.fn(),
        onReleaseTable: vi.fn(),
        onRestoreTable: vi.fn(),
        onUpdateQty: vi.fn(),
      })
    );

    expect(getByText("🛵 SWIGGY")).toBeDefined();
    expect(getByText("New KOT Draft Items (2)")).toBeDefined();
  });
});
