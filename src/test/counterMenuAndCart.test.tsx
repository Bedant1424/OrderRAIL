import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CounterMenuImage } from "@/windows-pos/components/CounterMenuImage";
import { MenuCatalog } from "@/windows-pos/components/MenuCatalog";
import { CounterCart } from "@/windows-pos/components/CounterCart";
import { OrderEntryView } from "@/windows-pos/components/OrderEntryView";
import { TableGrid } from "@/windows-pos/components/TableGrid";
import { CounterOrderActionService } from "@/windows-pos/services/counterOrderActionService";
import { MockCounterPrinter } from "@/windows-pos/services/printer/counterPrinter";
import type { ProductionMenuItem } from "@/hooks/useMenu";
import type { CounterCartItem } from "@/windows-pos/services/counterOrderBuilderService";
import type { CounterTable, CounterOrder } from "@/windows-pos/types/counterTypes";

// Mock useMenu hook
const mockCategories = [
  { id: "cat-pizzas", name: "Pizzas", cafe_id: "test-cafe", sort_order: 1, created_at: "" },
  { id: "cat-beverages", name: "Beverages", cafe_id: "test-cafe", sort_order: 2, created_at: "" },
  { id: "cat-snacks", name: "Snacks", cafe_id: "test-cafe", sort_order: 3, created_at: "" },
];

const mockItems: ProductionMenuItem[] = [
  {
    id: "item-1",
    cafe_id: "test-cafe",
    category_id: "cat-pizzas",
    name: "Farmhouse Cheese Pizza",
    description: "Loaded with mozzarella and veggies",
    price_cents: 29900,
    image_url: "menu-images/test-cafe/pizza.jpg",
    is_available: true,
    is_vegetarian: true,
    created_at: "",
    updated_at: "",
    categoryName: "Pizzas",
  },
  {
    id: "item-2",
    cafe_id: "test-cafe",
    category_id: "cat-beverages",
    name: "Chilled Cold Coffee",
    description: "Thick brewed coffee with ice cream",
    price_cents: 12000,
    image_url: null,
    is_available: true,
    is_vegetarian: true,
    created_at: "",
    updated_at: "",
    categoryName: "Beverages",
  },
  {
    id: "item-3",
    cafe_id: "test-cafe",
    category_id: "cat-snacks",
    name: "Garlic Bread with Dip",
    description: "Crispy toast with garlic cheese spread",
    price_cents: 15000,
    image_url: "menu-images/test-cafe/garlic-bread.jpg",
    is_available: false, // Sold out
    is_vegetarian: true,
    created_at: "",
    updated_at: "",
    categoryName: "Snacks",
  },
];

vi.mock("@/hooks/useMenu", () => ({
  useMenu: vi.fn(() => ({
    categories: mockCategories,
    items: mockItems,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

// Mock useImageUrl
vi.mock("@/lib/useImageUrl", () => ({
  useImageUrl: (path: string | null | undefined) => {
    if (!path) return null;
    return `https://mock.supabase.co/storage/v1/object/public/${path}`;
  },
  resolveImageUrlSync: (path: string | null | undefined) => {
    if (!path) return null;
    return `https://mock.supabase.co/storage/v1/object/public/${path}`;
  },
}));

// Mock updateOrderStatusInDb for order state transitions
vi.mock("@/lib/orders/repository", () => ({
  updateOrderStatusInDb: vi.fn().mockResolvedValue({ id: "ord-accept-1", status: "preparing" }),
}));

// Mock DB for Order actions
vi.mock("@/lib/db", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe("Milestone 4 — Counter UI & Menu Integration Test Suite", () => {
  const sampleTables: CounterTable[] = [
    {
      id: "tbl-1",
      cafeId: "test-cafe",
      tableNumber: 1,
      label: "Table 1",
      status: "occupied",
      activeSessionId: "sess-1",
      sessionStartedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      activeSessionStartedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      unbilledTotalCents: 41900,
      orders: [
        {
          id: "ord-1",
          orderNumber: 101,
          dailyOrderNumber: 101,
          tableId: "tbl-1",
          diningSessionId: "sess-1",
          orderSource: "DINE_IN",
          status: "pending", // Has pending order!
          totalCents: 29900,
          createdAt: new Date().toISOString(),
          customerName: "Alice",
          items: [
            {
              id: "oi-1",
              orderId: "ord-1",
              name: "Farmhouse Cheese Pizza",
              priceCents: 29900,
              qty: 1,
            },
          ],
        },
      ],
    },
    {
      id: "tbl-2",
      cafeId: "test-cafe",
      tableNumber: 2,
      label: "Table 2",
      status: "vacant",
      activeSessionId: null,
      activeSessionStartedAt: null,
      unbilledTotalCents: 0,
      orders: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Menu Category Navigation & Filtering
  it("filters menu items when a category is selected", () => {
    render(
      <MenuCatalog
        cafeId="test-cafe"
        cartItems={[]}
        onAddToCart={vi.fn()}
      />
    );

    // Initial state: "All" is selected, so both available items are rendered
    expect(screen.getByText("Farmhouse Cheese Pizza")).toBeInTheDocument();
    expect(screen.getByText("Chilled Cold Coffee")).toBeInTheDocument();
    expect(screen.getByText("Garlic Bread with Dip")).toBeInTheDocument();

    // Click "Beverages" category tab
    const beveragesTab = screen.getByRole("button", { name: /Beverages/i });
    fireEvent.click(beveragesTab);

    // Now only Cold Coffee should be visible, Farmhouse Cheese Pizza hidden
    expect(screen.getByText("Chilled Cold Coffee")).toBeInTheDocument();
    expect(screen.queryByText("Farmhouse Cheese Pizza")).not.toBeInTheDocument();
    expect(screen.queryByText("Garlic Bread with Dip")).not.toBeInTheDocument();

    // Switch back to "All"
    const allTab = screen.getByRole("button", { name: /All/i });
    fireEvent.click(allTab);
    expect(screen.getByText("Farmhouse Cheese Pizza")).toBeInTheDocument();
  });

  // 2. Instant Search Filtering
  it("filters items in real time based on search query", () => {
    render(
      <MenuCatalog
        cafeId="test-cafe"
        cartItems={[]}
        onAddToCart={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search menu items/i);
    fireEvent.change(searchInput, { target: { value: "coffee" } });

    // Cold coffee should match
    expect(screen.getByText("Chilled Cold Coffee")).toBeInTheDocument();
    // Pizza should not match
    expect(screen.queryByText("Farmhouse Cheese Pizza")).not.toBeInTheDocument();
  });

  // 3. Item Card Rendering
  it("renders item name, category, and formatted price in ₹", () => {
    render(
      <MenuCatalog
        cafeId="test-cafe"
        cartItems={[]}
        onAddToCart={vi.fn()}
      />
    );

    expect(screen.getByText("Farmhouse Cheese Pizza")).toBeInTheDocument();
    expect(screen.getByText("Pizzas")).toBeInTheDocument();
    expect(screen.getByText("₹299.00")).toBeInTheDocument();

    // Sold out item renders badge
    expect(screen.getByText("Sold Out")).toBeInTheDocument();
  });

  // 4. CounterMenuImage fallback handling
  it("handles missing or broken image gracefully with a fallback dish icon", () => {
    const { container } = render(
      <CounterMenuImage
        imagePath={null}
        altText="Plain Water"
        categoryName="Beverages"
      />
    );

    // Should render a coffee/drink icon fallback without throwing
    const svgIcon = container.querySelector("svg");
    expect(svgIcon).toBeInTheDocument();
  });

  // 5. Cart Addition
  it("invokes onAddToCart when an available item is clicked", () => {
    const handleAddToCart = vi.fn();
    render(
      <MenuCatalog
        cafeId="test-cafe"
        cartItems={[]}
        onAddToCart={handleAddToCart}
      />
    );

    const pizzaCard = screen.getByText("Farmhouse Cheese Pizza");
    fireEvent.click(pizzaCard);

    expect(handleAddToCart).toHaveBeenCalledTimes(1);
    expect(handleAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Farmhouse Cheese Pizza", price_cents: 29900 })
    );
  });

  // 6. Quantity Increment
  it("increments item quantity when '+' is clicked in CounterCart", () => {
    const handleUpdateQty = vi.fn();
    const cartItems: CounterCartItem[] = [
      {
        id: "c-1",
        menuItemId: "item-1",
        name: "Farmhouse Cheese Pizza",
        priceCents: 29900,
        qty: 1,
      },
    ];

    render(
      <CounterCart
        channel="DINE_IN"
        cafeId="test-cafe"
        tables={sampleTables}
        cartItems={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={vi.fn()}
        onUpdateItemNote={vi.fn()}
        onClearCart={vi.fn()}
        onOrderSubmitted={vi.fn()}
      />
    );

    const plusBtn = screen.getByTitle("Increase quantity");
    fireEvent.click(plusBtn);

    expect(handleUpdateQty).toHaveBeenCalledWith("c-1", 1);
  });

  // 7. Quantity Decrement
  it("decrements item quantity when '-' is clicked in CounterCart", () => {
    const handleUpdateQty = vi.fn();
    const cartItems: CounterCartItem[] = [
      {
        id: "c-1",
        menuItemId: "item-1",
        name: "Farmhouse Cheese Pizza",
        priceCents: 29900,
        qty: 2,
      },
    ];

    render(
      <CounterCart
        channel="DINE_IN"
        cafeId="test-cafe"
        tables={sampleTables}
        cartItems={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={vi.fn()}
        onUpdateItemNote={vi.fn()}
        onClearCart={vi.fn()}
        onOrderSubmitted={vi.fn()}
      />
    );

    const minusBtn = screen.getByTitle("Decrease quantity");
    fireEvent.click(minusBtn);

    expect(handleUpdateQty).toHaveBeenCalledWith("c-1", -1);
  });

  // 8. Item Removal
  it("calls onRemoveItem when delete button is clicked", () => {
    const handleRemoveItem = vi.fn();
    const cartItems: CounterCartItem[] = [
      {
        id: "c-1",
        menuItemId: "item-1",
        name: "Farmhouse Cheese Pizza",
        priceCents: 29900,
        qty: 1,
      },
    ];

    render(
      <CounterCart
        channel="DINE_IN"
        cafeId="test-cafe"
        tables={sampleTables}
        cartItems={cartItems}
        onUpdateQty={vi.fn()}
        onRemoveItem={handleRemoveItem}
        onUpdateItemNote={vi.fn()}
        onClearCart={vi.fn()}
        onOrderSubmitted={vi.fn()}
      />
    );

    const removeBtn = screen.getByTitle("Remove item");
    fireEvent.click(removeBtn);

    expect(handleRemoveItem).toHaveBeenCalledWith("c-1");
  });

  // 9. Subtotal Calculation
  it("accurately calculates subtotal and item totals across multiple lines", () => {
    const cartItems: CounterCartItem[] = [
      {
        id: "c-1",
        menuItemId: "item-1",
        name: "Farmhouse Cheese Pizza",
        priceCents: 29900,
        qty: 2, // 59800
      },
      {
        id: "c-2",
        menuItemId: "item-2",
        name: "Chilled Cold Coffee",
        priceCents: 12000,
        qty: 1, // 12000
      },
    ];

    render(
      <CounterCart
        channel="DINE_IN"
        cafeId="test-cafe"
        tables={sampleTables}
        cartItems={cartItems}
        onUpdateQty={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateItemNote={vi.fn()}
        onClearCart={vi.fn()}
        onOrderSubmitted={vi.fn()}
      />
    );

    // Total should be 59800 + 12000 = 71800 = ₹718.00
    // Header cart count: "3 Items"
    expect(screen.getByText(/3\s+items/i)).toBeInTheDocument();
    // Subtotal in summary: ₹718.00
    const subtotals = screen.getAllByText("₹718.00");
    expect(subtotals.length).toBeGreaterThanOrEqual(1);
  });

  // 10. Dine-In Pre-Selected Table Carried Over
  it("pre-selects the specified table in the Dine-In cart", () => {
    render(
      <CounterCart
        channel="DINE_IN"
        cafeId="test-cafe"
        tables={sampleTables}
        selectedTableId="tbl-1"
        cartItems={[]}
        onUpdateQty={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateItemNote={vi.fn()}
        onClearCart={vi.fn()}
        onOrderSubmitted={vi.fn()}
      />
    );

    // The table selector dropdown should have tbl-1 selected
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("tbl-1");
  });

  // 11. Swiggy External Reference Requirement
  it("requires external order reference when channel is SWIGGY", () => {
    render(
      <CounterCart
        channel="SWIGGY"
        cafeId="test-cafe"
        tables={sampleTables}
        cartItems={[
          {
            id: "c-1",
            menuItemId: "item-1",
            name: "Farmhouse Cheese Pizza",
            priceCents: 29900,
            qty: 1,
          },
        ]}
        onUpdateQty={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateItemNote={vi.fn()}
        onClearCart={vi.fn()}
        onOrderSubmitted={vi.fn()}
      />
    );

    // Swiggy header badge
    expect(screen.getByText(/SWIGGY Order Reference/i)).toBeInTheDocument();

    // Check placeholder for external order ref
    const refInput = screen.getByPlaceholderText(/#8821/i);
    expect(refInput).toBeInTheDocument();

    // Click submit without entering ref
    const submitBtn = screen.getByText(/submit & fire kot/i);
    fireEvent.click(submitBtn);

    // Should display validation error
    expect(screen.getByText(/Please enter an external order reference for SWIGGY/i)).toBeInTheDocument();
  });

  // 12. Zomato External Reference Requirement
  it("requires external order reference when channel is ZOMATO", () => {
    render(
      <CounterCart
        channel="ZOMATO"
        cafeId="test-cafe"
        tables={sampleTables}
        cartItems={[
          {
            id: "c-1",
            menuItemId: "item-1",
            name: "Farmhouse Cheese Pizza",
            priceCents: 29900,
            qty: 1,
          },
        ]}
        onUpdateQty={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateItemNote={vi.fn()}
        onClearCart={vi.fn()}
        onOrderSubmitted={vi.fn()}
      />
    );

    // Zomato header badge
    expect(screen.getByText(/ZOMATO Order Reference/i)).toBeInTheDocument();

    const refInput = screen.getByPlaceholderText(/#4419/i);
    expect(refInput).toBeInTheDocument();

    // Click submit without entering ref
    const submitBtn = screen.getByText(/submit & fire kot/i);
    fireEvent.click(submitBtn);

    // Should display validation error
    expect(screen.getByText(/Please enter an external order reference for ZOMATO/i)).toBeInTheDocument();
  });

  // 13. TableGrid Pending Order Highlight
  it("displays pending order alert badge on tables with pending orders", () => {
    render(
      <TableGrid
        tables={sampleTables}
        selectedTableId="tbl-1"
        onSelectTable={vi.fn()}
      />
    );

    // Table 1 has 1 pending order, so it should have the alert badge
    expect(screen.getByText(/1 Pending/i)).toBeInTheDocument();
    // Also elapsed time: 25m ago
    expect(screen.getByText(/25m ago/i)).toBeInTheDocument();
  });

  // 14. Existing Counter Order Acceptance & KOT Pipeline
  it("accepts pending order and generates KOT via CounterOrderActionService", async () => {
    const mockPrinter = new MockCounterPrinter();
    const pendingOrder: CounterOrder = {
      id: "ord-accept-1",
      orderNumber: 202,
      dailyOrderNumber: 202,
      tableId: "tbl-1",
      diningSessionId: "sess-1",
      orderSource: "DINE_IN",
      status: "pending",
      totalCents: 29900,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: "oi-2",
          orderId: "ord-accept-1",
          name: "Farmhouse Cheese Pizza",
          priceCents: 29900,
          qty: 1,
        },
      ],
    };

    const result = await CounterOrderActionService.acceptOrder(
      pendingOrder,
      "Table 1",
      "Cheese Corner",
      mockPrinter
    );

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("preparing");
    expect(mockPrinter.getHistory().length).toBe(1);
    expect(mockPrinter.getHistory()[0].context?.orderNumber).toBe(202);
  });

  // Integrated OrderEntryView flow
  it("integrates MenuCatalog and CounterCart in OrderEntryView", () => {
    render(
      <OrderEntryView
        channel="DINE_IN"
        cafeId="test-cafe"
        tables={sampleTables}
        selectedTableId="tbl-1"
        onOrderSubmitted={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // Breadcrumb bar
    expect(screen.getByText("Back to Workstation")).toBeInTheDocument();
    expect(screen.getByText("Punching New Ticket")).toBeInTheDocument();

    // Menu catalog items visible
    expect(screen.getByText("Farmhouse Cheese Pizza")).toBeInTheDocument();

    // Empty cart initial state
    expect(screen.getByText("Cart is Empty")).toBeInTheDocument();

    // Add item by clicking card
    fireEvent.click(screen.getByText("Farmhouse Cheese Pizza"));

    // Item should now appear in cart line items (Header shows "1 Item")
    expect(screen.getByText(/1 Item/i)).toBeInTheDocument();
    // Menu card shows "1 in cart"
    expect(screen.getByText("1 in cart")).toBeInTheDocument();
  });
});
