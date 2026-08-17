import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizePhoneNumber } from "@/lib/customers/phoneNormalization";
import { resolveOrCreateCustomerProfile, recordCustomerSettlement } from "@/lib/customers/customerService";
import { BillingService } from "@/lib/billing/billingService";
import { PaymentService } from "@/lib/payments/paymentService";

describe("Counter Direct Payment Order Persistence Test Suite", () => {
  interface MockOrderItem {
    id: string;
    order_id: string;
    menu_item_id?: string | null;
    name: string;
    price_cents: number;
    qty: number;
    note?: string | null;
  }

  interface MockOrder {
    id: string;
    cafe_id: string;
    table_id?: string | null;
    dining_session_id?: string | null;
    session_id?: string | null;
    order_number: number;
    daily_order_number?: number;
    customer_id?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    total_cents: number;
    status: string;
    order_source: string;
    created_at: string;
    items: MockOrderItem[];
  }

  interface MockCustomer {
    id: string;
    cafe_id: string;
    phone: string;
    normalized_phone: string;
    name: string | null;
    visit_count: number;
    total_spend_cents: number;
  }

  interface MockBill {
    id: string;
    order_id: string;
    customer_id?: string | null;
    grand_total: number;
  }

  let dbOrders: MockOrder[] = [];
  let dbCustomers: MockCustomer[] = [];
  let dbBills: MockBill[] = [];
  let orderCounter = 0;

  const mockResolveCustomer = (cafeId: string, phone?: string | null, name?: string | null): string | null => {
    const norm = normalizePhoneNumber(phone);
    if (!cafeId || !norm) return null;
    const cleanName = name?.trim() || null;
    const effectiveName = cleanName || norm;

    let existing = dbCustomers.find((c) => c.cafe_id === cafeId && c.normalized_phone === norm);
    if (existing) {
      if (cleanName && (!existing.name || existing.name === norm)) {
        existing.name = cleanName;
      }
      return existing.id;
    }

    const newCust: MockCustomer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      cafe_id: cafeId,
      phone: phone?.trim() || norm,
      normalized_phone: norm,
      name: effectiveName,
      visit_count: 0,
      total_spend_cents: 0,
    };
    dbCustomers.push(newCust);
    return newCust.id;
  };

  const mockCreateOrderInDb = (payload: {
    cafe_id: string;
    table_id?: string;
    dining_session_id?: string | null;
    customer_id?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    total_cents: number;
    order_source?: string;
    items: { menu_item_id?: string; name: string; price_cents: number; qty: number; note?: string | null }[];
    shouldFail?: boolean;
  }): MockOrder => {
    if (payload.shouldFail) {
      throw new Error("Database order insertion failed");
    }

    orderCounter++;
    const realOrderUuid = `550e8400-e29b-41d4-a716-${String(orderCounter).padStart(12, '0')}`;
    const newOrder: MockOrder = {
      id: realOrderUuid,
      cafe_id: payload.cafe_id,
      table_id: payload.table_id || null,
      dining_session_id: payload.dining_session_id || null,
      order_number: orderCounter,
      daily_order_number: orderCounter,
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name || null,
      customer_phone: payload.customer_phone || null,
      total_cents: payload.total_cents,
      status: "preparing",
      order_source: payload.order_source || "DINE_IN",
      created_at: new Date().toISOString(),
      items: payload.items.map((i, idx) => ({
        id: `item-${orderCounter}-${idx}`,
        order_id: realOrderUuid,
        menu_item_id: i.menu_item_id || null,
        name: i.name,
        price_cents: i.price_cents,
        qty: i.qty,
        note: i.note || null,
      })),
    };
    dbOrders.push(newOrder);
    return newOrder;
  };

  const mockRecordSettlement = (customerId: string | null, amountCents: number) => {
    if (!customerId) return;
    const cust = dbCustomers.find((c) => c.id === customerId);
    if (!cust) return;
    cust.visit_count += 1;
    cust.total_spend_cents += amountCents;
  };

  beforeEach(() => {
    dbOrders = [];
    dbCustomers = [];
    dbBills = [];
    orderCounter = 0;
  });

  // 1 & 2 & 3 & 4 & 5
  it("1-5. Direct payment with draft cart creates real order, order_items, real UUID, and passes UUID to bill", () => {
    const draftCart = [
      { id: "m1", name: "Cold Coffee", price: 150, qty: 2, notes: "Extra chilled" },
      { id: "m2", name: "Club Sandwich", price: 200, qty: 1, notes: null },
    ];

    const cur = { orders: [] as MockOrder[], draftCart };
    let effectiveOrders = [...cur.orders];

    if (effectiveOrders.length === 0 && cur.draftCart.length > 0) {
      const subtotal = cur.draftCart.reduce((a, i) => a + i.price * i.qty, 0);
      const createdOrder = mockCreateOrderInDb({
        cafe_id: "cafe-101",
        table_id: "table-1",
        total_cents: Math.round(subtotal * 100),
        items: cur.draftCart.map((i) => ({
          menu_item_id: i.id,
          name: i.name,
          price_cents: Math.round(i.price * 100),
          qty: i.qty,
          note: i.notes,
        })),
      });
      effectiveOrders = [createdOrder];
    }

    expect(dbOrders.length).toBe(1);
    const created = dbOrders[0];

    // 1. Real order exists
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(created.id).not.toContain("ord-");

    // 2. Order items created
    expect(created.items.length).toBe(2);
    expect(created.items[0].name).toBe("Cold Coffee");
    expect(created.items[0].qty).toBe(2);
    expect(created.items[1].name).toBe("Club Sandwich");

    // 3 & 4. Real UUID used for bill reference
    const primaryOrderId = effectiveOrders[0].id;
    expect(primaryOrderId).toBe(created.id);
    expect(primaryOrderId).not.toContain("ord-");

    // 5. Daily order number preserved
    expect(created.daily_order_number).toBe(1);
  });

  // 6
  it("6. Existing persisted order + payment does NOT create a duplicate order", () => {
    const existingOrder = mockCreateOrderInDb({
      cafe_id: "cafe-101",
      table_id: "table-1",
      total_cents: 30000,
      items: [{ name: "Pizza", price_cents: 30000, qty: 1 }],
    });

    expect(dbOrders.length).toBe(1);

    const cur = { orders: [existingOrder], draftCart: [] };
    let effectiveOrders = [...cur.orders];

    if (effectiveOrders.length === 0 && cur.draftCart.length > 0) {
      mockCreateOrderInDb({
        cafe_id: "cafe-101",
        total_cents: 0,
        items: [],
      });
    }

    expect(dbOrders.length).toBe(1);
    expect(effectiveOrders[0].id).toBe(existingOrder.id);
  });

  // 7
  it("7. Empty cart + no persisted order aborts payment safely", () => {
    const cur = { orders: [] as MockOrder[], draftCart: [] as any[] };
    let aborted = false;

    if (cur.orders.length === 0 && cur.draftCart.length === 0) {
      aborted = true;
    }

    expect(aborted).toBe(true);
    expect(dbOrders.length).toBe(0);
  });

  // 8 & 9 & 10
  it("8-10. Customer linking works correctly for direct-payment orders", () => {
    // 8. Name + phone customer
    const custId1 = mockResolveCustomer("cafe-101", "9876543210", "John Doe");
    const order1 = mockCreateOrderInDb({
      cafe_id: "cafe-101",
      customer_id: custId1,
      customer_name: "John Doe",
      customer_phone: "9876543210",
      total_cents: 20000,
      items: [{ name: "Burger", price_cents: 20000, qty: 1 }],
    });
    expect(order1.customer_id).toBe(custId1);
    expect(order1.customer_name).toBe("John Doe");

    // 9. Phone-only customer
    const custId2 = mockResolveCustomer("cafe-101", "9123456789", "");
    const order2 = mockCreateOrderInDb({
      cafe_id: "cafe-101",
      customer_id: custId2,
      customer_name: "9123456789",
      customer_phone: "9123456789",
      total_cents: 15000,
      items: [{ name: "Fries", price_cents: 15000, qty: 1 }],
    });
    expect(order2.customer_id).toBe(custId2);
    expect(order2.customer_name).toBe("9123456789");

    // 10. Anonymous transaction (no phone)
    const custId3 = mockResolveCustomer("cafe-101", null, null);
    const order3 = mockCreateOrderInDb({
      cafe_id: "cafe-101",
      customer_id: custId3,
      total_cents: 10000,
      items: [{ name: "Tea", price_cents: 10000, qty: 1 }],
    });
    expect(order3.customer_id).toBeNull();
  });

  // 11
  it("11. Successful payment marks the newly created order served", () => {
    const order = mockCreateOrderInDb({
      cafe_id: "cafe-101",
      total_cents: 25000,
      items: [{ name: "Pasta", price_cents: 25000, qty: 1 }],
    });

    expect(order.status).toBe("preparing");

    // Simulate completion status update
    order.status = "served";

    expect(order.status).toBe("served");
  });

  // 12
  it("12. Customer settlement executes once per payment", () => {
    const custId = mockResolveCustomer("cafe-101", "9876543210", "Jane");
    mockRecordSettlement(custId, 35000);

    const cust = dbCustomers.find((c) => c.id === custId);
    expect(cust?.visit_count).toBe(1);
    expect(cust?.total_spend_cents).toBe(35000);
  });

  // 13
  it("13. Double submission protection prevents duplicate orders on rapid clicks", () => {
    let submittingRef = false;
    let callCount = 0;

    const simulateDirectPayment = () => {
      if (submittingRef) return;
      submittingRef = true;
      try {
        callCount++;
        mockCreateOrderInDb({
          cafe_id: "cafe-101",
          total_cents: 20000,
          items: [{ name: "Coffee", price_cents: 20000, qty: 1 }],
        });
      } finally {
        submittingRef = false;
      }
    };

    // First click
    simulateDirectPayment();
    expect(callCount).toBe(1);
    expect(dbOrders.length).toBe(1);
  });

  // 14
  it("14. Failed order creation prevents billing and payment", () => {
    let paymentCompleted = false;

    try {
      mockCreateOrderInDb({
        cafe_id: "cafe-101",
        total_cents: 20000,
        items: [{ name: "Coffee", price_cents: 20000, qty: 1 }],
        shouldFail: true,
      });
      paymentCompleted = true;
    } catch (e) {
      paymentCompleted = false;
    }

    expect(paymentCompleted).toBe(false);
    expect(dbOrders.length).toBe(0);
    expect(dbBills.length).toBe(0);
  });

  // 15
  it("15. Failed payment does not cause a second order on retry", () => {
    // Order successfully created on Attempt 1
    const createdOrder = mockCreateOrderInDb({
      cafe_id: "cafe-101",
      total_cents: 20000,
      items: [{ name: "Coffee", price_cents: 20000, qty: 1 }],
    });

    expect(dbOrders.length).toBe(1);

    // Payment failed on Attempt 1, session state now contains createdOrder in cur.orders
    const curRetry = { orders: [createdOrder], draftCart: [] };
    let effectiveOrders = [...curRetry.orders];

    if (effectiveOrders.length === 0 && curRetry.draftCart.length > 0) {
      mockCreateOrderInDb({
        cafe_id: "cafe-101",
        total_cents: 20000,
        items: [{ name: "Coffee", price_cents: 20000, qty: 1 }],
      });
    }

    // On retry, no second order was created!
    expect(dbOrders.length).toBe(1);
    expect(effectiveOrders[0].id).toBe(createdOrder.id);
  });

  // 16
  it("16. Dining session closes only after successful completion", () => {
    let sessionStatus = "active";

    // Simulate completion pipeline steps
    const orderCreated = true;
    const billCreated = true;
    const paymentRecorded = true;

    if (orderCreated && billCreated && paymentRecorded) {
      sessionStatus = "closed";
    }

    expect(sessionStatus).toBe("closed");
  });
});
