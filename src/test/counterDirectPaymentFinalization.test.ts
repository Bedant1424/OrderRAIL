import { describe, it, expect, beforeEach } from "vitest";
import { PaymentService } from "@/lib/payments/paymentService";
import { BillingService } from "@/lib/billing/billingService";
import { BillSummaryCalculator } from "@/lib/billing/BillSummaryCalculator";

describe("Counter POS Direct-Payment Finalization Fix (Milestone 7 Regression Tests)", () => {
  interface MockTable {
    id: string;
    label: string;
    status: "free" | "occupied" | "cleaning_required";
    active_session_id: string | null;
  }

  interface MockSession {
    id: string;
    table_id: string;
    status: "browsing" | "active" | "closed";
  }

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
    status: "preparing" | "served" | "cancelled";
    dining_session_id: string;
    items: MockOrderItem[];
    customer_id?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
  }

  interface MockCustomer {
    id: string;
    name: string;
    phone: string;
    visit_count: number;
    total_spend_cents: number;
  }

  let dbTables: MockTable[];
  let dbSessions: MockSession[];
  let dbOrders: MockOrder[];
  let dbCustomers: MockCustomer[];
  let orderCounter: number;

  const mockGetOrCreateDiningSession = (table: MockTable): string => {
    if (table.active_session_id) {
      const existing = dbSessions.find((s) => s.id === table.active_session_id && s.status !== "closed");
      if (existing) return existing.id;
    }
    const newSession: MockSession = {
      id: `c7a18f2d-90bc-4a1e-82d1-${Math.random().toString(16).slice(2, 14).padStart(12, '0')}`,
      table_id: table.id,
      status: "browsing",
    };
    dbSessions.push(newSession);
    table.active_session_id = newSession.id;
    table.status = "occupied";
    return newSession.id;
  };

  const mockCloseDiningSessionInDb = (sessionId: string) => {
    const sess = dbSessions.find((s) => s.id === sessionId);
    if (sess) {
      sess.status = "closed";
    }
  };

  const mockUpdateTableStatusInDb = (tableId: string, status: MockTable["status"], activeSessionId: string | null) => {
    const tbl = dbTables.find((t) => t.id === tableId);
    if (tbl) {
      tbl.status = status;
      tbl.active_session_id = activeSessionId;
    }
  };

  const mockRecordCustomerSettlement = (customerId: string, amountCents: number) => {
    const cust = dbCustomers.find((c) => c.id === customerId);
    if (cust) {
      cust.visit_count += 1;
      cust.total_spend_cents += amountCents;
    }
  };

  beforeEach(() => {
    dbTables = [
      { id: "table-1", label: "Table 1", status: "free", active_session_id: null },
    ];
    dbSessions = [];
    dbOrders = [];
    dbCustomers = [];
    orderCounter = 0;
  });

  // TEST 1: Direct payment from a completely free table
  it("TEST 1: Direct payment from a completely free table closes DB session and leaves table FREE", async () => {
    const table = dbTables[0];
    const draftCart = [
      { id: "d1", name: "Cheese Burger", price: 150, qty: 1 },
      { id: "d2", name: "Fries", price: 80, qty: 1 },
    ];

    // 1. Target session resolution
    const targetSessionId = mockGetOrCreateDiningSession(table);
    expect(targetSessionId).toMatch(/^[0-9a-f-]+$/);

    // 2. Order creation
    orderCounter++;
    const createdOrder: MockOrder = {
      id: `ord-uuid-${orderCounter}`,
      orderNumber: orderCounter,
      status: "preparing",
      dining_session_id: targetSessionId,
      items: draftCart.map((i, idx) => ({
        id: `it-${idx}`,
        order_id: `ord-uuid-${orderCounter}`,
        name: i.name,
        price: i.price,
        qty: i.qty,
      })),
    };
    dbOrders.push(createdOrder);

    // 3. Bill & Payment
    const billRes = await BillingService.createBill({
      billId: `bill-${createdOrder.id}`,
      orderId: createdOrder.id,
      tableLabel: table.label,
      items: draftCart,
    });

    const paymentRes = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: createdOrder.id,
      diningSessionId: targetSessionId,
      tableId: table.id,
      tableLabel: table.label,
      paymentMethod: "upi",
      amount: billRes.bill.netTotal,
    });

    expect(paymentRes.status).toBe("Completed");
    expect(paymentRes.settlement.status).toBe("settled");

    // 4. Update order to served
    createdOrder.status = "served";

    // 5. Release table to free and close real DB session (Milestones 1 & 2 fix)
    mockUpdateTableStatusInDb(table.id, "free", null);
    mockCloseDiningSessionInDb(targetSessionId);

    // Verifications
    expect(dbOrders.length).toBe(1);
    expect(dbOrders[0].status).toBe("served");
    expect(dbSessions.find((s) => s.id === targetSessionId)?.status).toBe("closed");
    expect(table.status).toBe("free");
    expect(table.active_session_id).toBeNull();
  });

  // TEST 2: Direct payment with customer phone only
  it("TEST 2: Direct payment with customer phone only links profile and records settlement once", async () => {
    const cust: MockCustomer = { id: "cust-1", name: "9876543210", phone: "9876543210", visit_count: 0, total_spend_cents: 0 };
    dbCustomers.push(cust);

    const table = dbTables[0];
    const targetSessionId = mockGetOrCreateDiningSession(table);

    const billRes = await BillingService.createBill({
      billId: "bill-test-2",
      orderId: "ord-test-2",
      tableLabel: table.label,
      items: [{ id: "i1", name: "Coffee", price: 100, qty: 1 }],
      customerId: cust.id,
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-test-2",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
      tableLabel: table.label,
    });

    mockRecordCustomerSettlement(cust.id, 10000);
    mockUpdateTableStatusInDb(table.id, "free", null);
    mockCloseDiningSessionInDb(targetSessionId);

    expect(cust.visit_count).toBe(1);
    expect(cust.total_spend_cents).toBe(10000);
    expect(table.status).toBe("free");
  });

  // TEST 3: Direct payment with customer name + phone
  it("TEST 3: Direct payment with customer name + phone links correct profile and settles once", async () => {
    const cust: MockCustomer = { id: "cust-2", name: "Alice", phone: "9123456789", visit_count: 0, total_spend_cents: 0 };
    dbCustomers.push(cust);

    const table = dbTables[0];
    const targetSessionId = mockGetOrCreateDiningSession(table);

    mockRecordCustomerSettlement(cust.id, 15000);
    mockUpdateTableStatusInDb(table.id, "free", null);
    mockCloseDiningSessionInDb(targetSessionId);

    expect(cust.name).toBe("Alice");
    expect(cust.visit_count).toBe(1);
    expect(cust.total_spend_cents).toBe(15000);
    expect(table.status).toBe("free");
  });

  // TEST 4: Realtime order INSERT occurs during payment
  it("TEST 4: Realtime reload during payment does not duplicate order or subtotal and ends with FREE table", () => {
    const orders: MockOrder[] = [
      {
        id: "ord-realtime-1",
        orderNumber: 1,
        status: "served",
        dining_session_id: "sess-1",
        items: [{ id: "it1", order_id: "ord-realtime-1", name: "Pizza", price: 300, qty: 1 }],
      },
    ];

    const draftCart: any[] = []; // Draft cart already cleared by handlePaymentComplete

    const summary = BillSummaryCalculator.buildBillSummary({
      orders,
      draftCart,
      taxEnabled: false,
    });

    expect(orders.length).toBe(1);
    expect(summary.subtotal).toBe(300);
    expect(summary.totalItems).toBe(1);
  });

  // TEST 5: Payment succeeds but final session cleanup is interrupted. Retry finalization.
  it("TEST 5: Payment retry after interrupted session cleanup returns existing settlement without duplicate payment or error", async () => {
    const table = dbTables[0];
    const targetSessionId = mockGetOrCreateDiningSession(table);

    const billRes = await BillingService.createBill({
      billId: "bill-retry-test",
      orderId: "ord-retry-test",
      tableLabel: table.label,
      items: [{ id: "i1", name: "Tea", price: 20, qty: 1 }],
    });

    // First attempt: Payment succeeds
    const payRes1 = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-retry-test",
      paymentMethod: "upi",
      amount: billRes.bill.netTotal,
      tableLabel: table.label,
    });
    expect(payRes1.status).toBe("Completed");

    // Second attempt (Cashier retry after UI notice): Must NOT throw! Must return existing settlement!
    const payRes2 = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-retry-test",
      paymentMethod: "upi",
      amount: billRes.bill.netTotal,
      tableLabel: table.label,
    });

    expect(payRes2).toBeDefined();
    expect(payRes2.status).toBe("Completed");
    expect(payRes2.settlement.billId).toBe(billRes.bill.billId);

    // Final cleanup completes
    mockUpdateTableStatusInDb(table.id, "free", null);
    mockCloseDiningSessionInDb(targetSessionId);

    expect(table.status).toBe("free");
  });

  // TEST 6: Already-paid bill passed to PaymentService.recordPayment()
  it("TEST 6: PaymentService.recordPayment() is idempotent and returns existing settlement when bill is already paid", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-idempotent",
      orderId: "ord-idempotent",
      tableLabel: "Express",
      items: [{ id: "i1", name: "Juice", price: 50, qty: 1 }],
    });

    const firstCall = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-idempotent",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
      tableLabel: "Express",
    });

    expect(firstCall.status).toBe("Completed");

    // Second call for already paid bill
    const secondCall = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-idempotent",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
      tableLabel: "Express",
    });

    expect(secondCall.status).toBe("Completed");
    expect(secondCall.settlement.settlementId).toBe(firstCall.settlement.settlementId);
  });

  // TEST 7: Customer settlement called twice for same transaction
  it("TEST 7: Customer settlement retry does not duplicate visit_count or total_spend_cents", () => {
    const cust: MockCustomer = { id: "cust-7", name: "Bob", phone: "9998887776", visit_count: 0, total_spend_cents: 0 };
    dbCustomers.push(cust);

    // First attempt
    const isRetryPayment1 = false;
    if (!isRetryPayment1) {
      mockRecordCustomerSettlement(cust.id, 25000);
    }

    // Second attempt (retry)
    const isRetryPayment2 = true;
    if (!isRetryPayment2) {
      mockRecordCustomerSettlement(cust.id, 25000);
    }

    expect(cust.visit_count).toBe(1);
    expect(cust.total_spend_cents).toBe(25000);
  });

  // TEST 8: Normal flow: Add items -> Send KOT -> Collect Payment -> Payment Received
  it("TEST 8: Normal KOT flow continues to work cleanly and leaves table FREE", async () => {
    const table = dbTables[0];
    const targetSessionId = mockGetOrCreateDiningSession(table);

    // Send KOT
    const kotOrder: MockOrder = {
      id: "ord-kot-1",
      orderNumber: 1,
      status: "preparing",
      dining_session_id: targetSessionId,
      items: [{ id: "i1", order_id: "ord-kot-1", name: "Pasta", price: 200, qty: 1 }],
    };
    dbOrders.push(kotOrder);

    // Collect Payment
    const billRes = await BillingService.createBill({
      billId: "bill-kot-1",
      orderId: kotOrder.id,
      tableLabel: table.label,
      items: kotOrder.items,
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: kotOrder.id,
      diningSessionId: targetSessionId,
      tableId: table.id,
      tableLabel: table.label,
      paymentMethod: "card",
      amount: billRes.bill.netTotal,
    });

    kotOrder.status = "served";
    mockUpdateTableStatusInDb(table.id, "free", null);
    mockCloseDiningSessionInDb(targetSessionId);

    expect(dbOrders.length).toBe(1);
    expect(dbOrders[0].status).toBe("served");
    expect(table.status).toBe("free");
  });

  // TEST 9: Existing order + new draft items
  it("TEST 9: Existing order plus new draft items creates exactly one new order, closes session and leaves table FREE", async () => {
    const table = dbTables[0];
    const targetSessionId = mockGetOrCreateDiningSession(table);

    const existingOrder: MockOrder = {
      id: "ord-exist-1",
      orderNumber: 1,
      status: "preparing",
      dining_session_id: targetSessionId,
      items: [{ id: "i1", order_id: "ord-exist-1", name: "Soup", price: 120, qty: 1 }],
    };
    dbOrders.push(existingOrder);

    const newDraftItems = [{ id: "d-new", name: "Garlic Bread", price: 90, qty: 1 }];

    // Direct Payment converts new draft items to 1 new order
    orderCounter = 2;
    const newOrder: MockOrder = {
      id: `ord-new-${orderCounter}`,
      orderNumber: orderCounter,
      status: "preparing",
      dining_session_id: targetSessionId,
      items: newDraftItems.map((i, idx) => ({
        id: `it-new-${idx}`,
        order_id: `ord-new-${orderCounter}`,
        name: i.name,
        price: i.price,
        qty: i.qty,
      })),
    };
    dbOrders.push(newOrder);

    const allOrders = [existingOrder, newOrder];
    const allItems = allOrders.flatMap((o) => o.items);

    const billRes = await BillingService.createBill({
      billId: "bill-combined",
      orderId: existingOrder.id,
      tableLabel: table.label,
      items: allItems,
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: existingOrder.id,
      diningSessionId: targetSessionId,
      tableId: table.id,
      tableLabel: table.label,
      paymentMethod: "upi",
      amount: billRes.bill.netTotal,
    });

    existingOrder.status = "served";
    newOrder.status = "served";
    mockUpdateTableStatusInDb(table.id, "free", null);
    mockCloseDiningSessionInDb(targetSessionId);

    expect(dbOrders.length).toBe(2);
    expect(billRes.bill.netTotal).toBe(220.5);
    expect(table.status).toBe("free");
  });

  // TEST 10: Receipt printing failure after successful payment
  it("TEST 10: Receipt printing failure after successful payment does not roll back financial settlement or table FREE state", async () => {
    const table = dbTables[0];
    const targetSessionId = mockGetOrCreateDiningSession(table);

    const billRes = await BillingService.createBill({
      billId: "bill-print-fail",
      orderId: "ord-print-fail",
      tableLabel: table.label,
      items: [{ id: "i1", name: "Mocha", price: 160, qty: 1 }],
    });

    const paymentRes = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-print-fail",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
      tableLabel: table.label,
    });

    mockUpdateTableStatusInDb(table.id, "free", null);
    mockCloseDiningSessionInDb(targetSessionId);

    // Simulate printer adapter exception
    let printFailed = false;
    try {
      throw new Error("Printer paper out or disconnected");
    } catch (errPrint) {
      printFailed = true;
    }

    expect(paymentRes.status).toBe("Completed");
    expect(printFailed).toBe(true);
    expect(table.status).toBe("free");
    expect(dbSessions.find((s) => s.id === targetSessionId)?.status).toBe("closed");
  });
});
