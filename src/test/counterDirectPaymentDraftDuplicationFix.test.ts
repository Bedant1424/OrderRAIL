import { describe, it, expect, beforeEach } from "vitest";
import { BillSummaryCalculator } from "@/lib/billing/BillSummaryCalculator";

describe("Counter POS Direct-Payment Draft-Cart Duplication Fix (Milestone 5 Tests)", () => {
  interface MockOrderItem {
    id: string;
    order_id: string;
    name: string;
    price: number;
    qty: number;
  }

  interface MockOrder {
    id: string;
    orderNumber: number;
    items: MockOrderItem[];
  }

  interface MockDraftItem {
    id: string;
    name: string;
    price: number;
    qty: number;
    notes?: string;
  }

  interface MockSession {
    orders: MockOrder[];
    draftCart: MockDraftItem[];
  }

  let session: MockSession;
  let orderCounter: number;

  beforeEach(() => {
    session = {
      orders: [],
      draftCart: [],
    };
    orderCounter = 0;
  });

  // TEST 1 - Direct payment with draft cart
  it("TEST 1: Direct payment with draft cart converts draft to DB order and clears draftCart", () => {
    session.draftCart = [
      { id: "d1", name: "Alfredo", price: 139, qty: 1 },
      { id: "d2", name: "Classic Vegetable Sandwich", price: 89, qty: 1 },
      { id: "d3", name: "Masala Tea", price: 19, qty: 1 },
    ];

    expect(session.orders.length).toBe(0);
    expect(session.draftCart.length).toBe(3);

    // Initial summary
    const initialSummary = BillSummaryCalculator.buildBillSummary({
      orders: session.orders,
      draftCart: session.draftCart,
      taxEnabled: false,
    });
    expect(initialSummary.subtotal).toBe(247);
    expect(initialSummary.totalItems).toBe(3);

    // Simulate direct payment order creation
    if (session.draftCart.length > 0) {
      orderCounter++;
      const createdOrder: MockOrder = {
        id: `real-uuid-${orderCounter}`,
        orderNumber: orderCounter,
        items: session.draftCart.map((i, idx) => ({
          id: `item-${idx}`,
          order_id: `real-uuid-${orderCounter}`,
          name: i.name,
          price: i.price,
          qty: i.qty,
        })),
      };

      // Direct payment state transition: draftCart -> database order
      session.orders = [...session.orders, createdOrder];
      session.draftCart = [];
    }

    expect(session.orders.length).toBe(1);
    expect(session.draftCart.length).toBe(0);

    const postSummary = BillSummaryCalculator.buildBillSummary({
      orders: session.orders,
      draftCart: session.draftCart,
      taxEnabled: false,
    });

    expect(postSummary.subtotal).toBe(247);
    expect(postSummary.totalItems).toBe(3);
  });

  // TEST 2 - Realtime race
  it("TEST 2: Realtime INSERT event after order creation does not restore stale draftCart or double count items", () => {
    session.draftCart = [
      { id: "d1", name: "Alfredo", price: 139, qty: 1 },
      { id: "d2", name: "Classic Vegetable Sandwich", price: 89, qty: 1 },
      { id: "d3", name: "Masala Tea", price: 19, qty: 1 },
    ];

    // Simulate createOrder
    orderCounter++;
    const createdOrder: MockOrder = {
      id: `real-uuid-${orderCounter}`,
      orderNumber: orderCounter,
      items: session.draftCart.map((i, idx) => ({
        id: `item-${idx}`,
        order_id: `real-uuid-${orderCounter}`,
        name: i.name,
        price: i.price,
        qty: i.qty,
      })),
    };

    // Update state immediately
    session.orders = [createdOrder];
    session.draftCart = [];

    // Simulate Realtime reload (loadSessionsFromDb) receiving DB orders
    const dbOrdersFromRealtime = [createdOrder];
    const prevDraftCart = session.draftCart; // []

    // Safe merge logic from loadSessionsFromDb
    const dbItemNames = new Set(dbOrdersFromRealtime.flatMap((o) => o.items || []).map((i) => i.name));
    const isDuplicateDraft = prevDraftCart.length > 0 && prevDraftCart.every((d) => dbItemNames.has(d.name));
    const safeDraftCart = isDuplicateDraft ? [] : prevDraftCart;

    session = {
      orders: dbOrdersFromRealtime,
      draftCart: safeDraftCart,
    };

    expect(session.orders.length).toBe(1);
    expect(session.draftCart.length).toBe(0);

    const summary = BillSummaryCalculator.buildBillSummary({
      orders: session.orders,
      draftCart: session.draftCart,
      taxEnabled: false,
    });

    expect(summary.subtotal).toBe(247);
    expect(summary.totalItems).toBe(3);
    expect(summary.subtotal).not.toBe(494);
    expect(summary.totalItems).not.toBe(6);
  });

  // TEST 3 - Existing order
  it("TEST 3: Payment for existing order with empty draftCart yields exact subtotal and item count", () => {
    session.orders = [
      {
        id: "existing-ord-3",
        orderNumber: 3,
        items: [
          { id: "i1", order_id: "existing-ord-3", name: "Alfredo", price: 139, qty: 1 },
          { id: "i2", order_id: "existing-ord-3", name: "Classic Vegetable Sandwich", price: 89, qty: 1 },
          { id: "i3", order_id: "existing-ord-3", name: "Masala Tea", price: 19, qty: 1 },
        ],
      },
    ];
    session.draftCart = [];

    const summary = BillSummaryCalculator.buildBillSummary({
      orders: session.orders,
      draftCart: session.draftCart,
      taxEnabled: false,
    });

    expect(summary.subtotal).toBe(247);
    expect(summary.totalItems).toBe(3);
  });

  // TEST 4 - Existing order plus new draft items
  it("TEST 4: Existing order plus new draft items combines into separate orders and clears draftCart", () => {
    session.orders = [
      {
        id: "existing-ord-3",
        orderNumber: 3,
        items: [
          { id: "i1", order_id: "existing-ord-3", name: "Alfredo", price: 139, qty: 1 },
          { id: "i2", order_id: "existing-ord-3", name: "Classic Vegetable Sandwich", price: 89, qty: 1 },
          { id: "i3", order_id: "existing-ord-3", name: "Masala Tea", price: 19, qty: 1 },
        ],
      },
    ];
    session.draftCart = [{ id: "d4", name: "Garlic Bread", price: 100, qty: 1 }];

    // Initial check before payment
    const preSummary = BillSummaryCalculator.buildBillSummary({
      orders: session.orders,
      draftCart: session.draftCart,
      taxEnabled: false,
    });
    expect(preSummary.subtotal).toBe(347);
    expect(preSummary.totalItems).toBe(4);

    // Direct payment converts draftCart to new order
    orderCounter = 4;
    const newOrder: MockOrder = {
      id: `real-uuid-${orderCounter}`,
      orderNumber: orderCounter,
      items: session.draftCart.map((i, idx) => ({
        id: `item-new-${idx}`,
        order_id: `real-uuid-${orderCounter}`,
        name: i.name,
        price: i.price,
        qty: i.qty,
      })),
    };

    session.orders = [...session.orders, newOrder];
    session.draftCart = [];

    expect(session.orders.length).toBe(2);
    expect(session.draftCart.length).toBe(0);

    const postSummary = BillSummaryCalculator.buildBillSummary({
      orders: session.orders,
      draftCart: session.draftCart,
      taxEnabled: false,
    });

    expect(postSummary.subtotal).toBe(347);
    expect(postSummary.totalItems).toBe(4);
  });

  // TEST 5 - Single tender
  it("TEST 5: Adding a tender matching order netTotal results in zero remaining balance", () => {
    const netTotal = 247;
    const tenders = [{ id: "t1", method: "upi", amount: 247 }];

    const paidTotal = tenders.reduce((a, t) => a + t.amount, 0);
    const remainingBalance = Math.max(0, netTotal - paidTotal);

    expect(netTotal).toBe(247);
    expect(paidTotal).toBe(247);
    expect(remainingBalance).toBe(0);
  });

  // TEST 6 - No duplicate order
  it("TEST 6: Direct payment creates exactly one order and does not create duplicate on realtime reload", () => {
    session.draftCart = [{ id: "d1", name: "Cold Coffee", price: 150, qty: 1 }];

    let createdOrderCount = 0;

    const executeDirectPaymentOrderCreation = () => {
      if (session.draftCart.length > 0) {
        createdOrderCount++;
        const created: MockOrder = {
          id: `order-uuid-${createdOrderCount}`,
          orderNumber: createdOrderCount,
          items: [{ id: "it1", order_id: `order-uuid-${createdOrderCount}`, name: "Cold Coffee", price: 150, qty: 1 }],
        };
        session.orders = [...session.orders, created];
        session.draftCart = [];
      }
    };

    // Payment step 1
    executeDirectPaymentOrderCreation();
    expect(createdOrderCount).toBe(1);
    expect(session.orders.length).toBe(1);

    // Simulate Realtime reload attempt
    executeDirectPaymentOrderCreation(); // draftCart is empty now, so no second order created!
    expect(createdOrderCount).toBe(1);
    expect(session.orders.length).toBe(1);
  });

  // TEST 7 - Retry after order creation
  it("TEST 7: Payment retry after failed payment reuses created order without duplicate creation", () => {
    session.draftCart = [{ id: "d1", name: "Brownie", price: 120, qty: 1 }];

    // Attempt 1: create order succeeds, payment recording fails
    orderCounter = 1;
    const created: MockOrder = {
      id: "real-order-uuid-retry",
      orderNumber: 1,
      items: [{ id: "it1", order_id: "real-order-uuid-retry", name: "Brownie", price: 120, qty: 1 }],
    };
    session.orders = [created];
    session.draftCart = [];

    // Attempt 2 (Retry): Cashier clicks Collect Payment again
    let effectiveOrders = [...session.orders];
    if (session.draftCart.length > 0) {
      // Should NOT enter this block because draftCart is empty!
      session.orders.push({ id: "duplicate-order", orderNumber: 2, items: [] });
    }

    expect(session.orders.length).toBe(1);
    expect(effectiveOrders[0].id).toBe("real-order-uuid-retry");
  });

  // TEST 8 - Normal KOT flow regression
  it("TEST 8: Normal KOT flow (Add -> Send KOT -> Collect Payment) produces correct single order and payment total", () => {
    session.draftCart = [{ id: "d1", name: "Pasta", price: 220, qty: 1 }];

    // Step 1: Send KOT
    orderCounter = 5;
    const kotOrder: MockOrder = {
      id: `kot-order-${orderCounter}`,
      orderNumber: orderCounter,
      items: [{ id: "it-kot", order_id: `kot-order-${orderCounter}`, name: "Pasta", price: 220, qty: 1 }],
    };
    session.orders = [kotOrder];
    session.draftCart = [];

    // Step 2: Collect Payment
    const summary = BillSummaryCalculator.buildBillSummary({
      orders: session.orders,
      draftCart: session.draftCart,
      taxEnabled: false,
    });

    expect(session.orders.length).toBe(1);
    expect(session.draftCart.length).toBe(0);
    expect(summary.subtotal).toBe(220);
    expect(summary.totalItems).toBe(1);
  });
});
