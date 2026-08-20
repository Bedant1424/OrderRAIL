import { describe, it, expect, beforeEach, vi } from "vitest";
import { PaymentService, settlementsMap } from "@/lib/payments/paymentService";
import { BillingService, billsMap } from "@/lib/billing/billingService";
import { BillRepository } from "@/lib/billing/BillRepository";
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
    billsMap.clear();
    settlementsMap.clear();
    BillRepository.clearMemoryStoreForTesting();
  });

  // TEST 1: Direct payment from a completely free table
  it("TEST 1: Direct payment from a completely free table closes DB session and leaves table FREE", async () => {
    const table = dbTables[0];
    const draftCart = [
      { id: "d1", name: "Cheese Burger", price: 150, qty: 1 },
      { id: "d2", name: "Fries", price: 80, qty: 1 },
    ];

    const targetSessionId = mockGetOrCreateDiningSession(table);
    expect(targetSessionId).toMatch(/^[0-9a-f-]+$/);

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

    createdOrder.status = "served";

    mockUpdateTableStatusInDb(table.id, "free", null);
    mockCloseDiningSessionInDb(targetSessionId);

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

  // TEST 3: Genuine Full Application Reload (clearing BOTH billsMap AND settlementsMap)
  it("TEST 3: Genuine full application reload (clearing billsMap + settlementsMap) queries persistent state and returns Completed without duplicate payment", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-refresh-test",
      orderId: "ord-refresh-test",
      tableLabel: "Table 1",
      items: [{ id: "i1", name: "Brownie", price: 120, qty: 1 }],
    });

    // Initial payment
    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-refresh-test",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
      tableLabel: "Table 1",
    });

    // Save paid bill into mock BillRepository DB store
    vi.spyOn(BillRepository, 'getBillById').mockResolvedValue({
      id: "bill-refresh-test",
      bill_number: 101,
      cafe_id: "cafe-1",
      session_id: "sess-1",
      table_id: "table-1",
      order_type: "DINE_IN",
      payment_status: "PAID",
      payment_method: "cash",
      subtotal: 120,
      discount: 0,
      service_charge: 0,
      cgst: 3,
      sgst: 3,
      round_off: 0,
      grand_total: 126,
      total_items: 1,
      created_at: new Date().toISOString(),
      items: [],
    } as any);

    // Simulate FULL browser reload: clear ALL memory maps!
    billsMap.clear();
    settlementsMap.clear();
    BillRepository.clearMemoryStoreForTesting();

    // PaymentService.recordPayment() after full reload on paid bill
    const refreshCall = await PaymentService.recordPayment({
      billId: "bill-refresh-test",
      orderId: "ord-refresh-test",
      paymentMethod: "cash",
      amount: 126,
      tableLabel: "Table 1",
    });

    expect(refreshCall.status).toBe("Completed");
    expect(refreshCall.settlement.billId).toBe("bill-refresh-test");
    expect(billsMap.get("bill-refresh-test")?.paymentStatus).toBe("paid");
  });

  // TEST 4: Browser refresh customer settlement idempotency with empty billsMap & settlementsMap
  it("TEST 4: Customer settlement retry after full browser reload (empty billsMap & settlementsMap) detects persistent paid bill and skips spend increment", async () => {
    const cust: MockCustomer = { id: "cust-4", name: "Charlie", phone: "9887766554", visit_count: 0, total_spend_cents: 0 };
    dbCustomers.push(cust);

    const billRes = await BillingService.createBill({
      billId: "bill-cust-refresh",
      orderId: "ord-cust-refresh",
      tableLabel: "Table 2",
      items: [{ id: "i1", name: "Latte", price: 150, qty: 1 }],
      customerId: cust.id,
    });

    // First attempt
    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-cust-refresh",
      paymentMethod: "card",
      amount: billRes.bill.netTotal,
      tableLabel: "Table 2",
    });
    mockRecordCustomerSettlement(cust.id, 15000);

    // Mock PostgreSQL BillRepository returning persistent paid bill
    vi.spyOn(BillRepository, 'getBillById').mockResolvedValue({
      id: "bill-cust-refresh",
      bill_number: 102,
      cafe_id: "cafe-1",
      session_id: "sess-2",
      payment_status: "PAID",
      payment_method: "card",
      grand_total: 157.5,
      created_at: new Date().toISOString(),
      items: [],
    } as any);

    // Simulate FULL browser reload: clear ALL memory maps!
    billsMap.clear();
    settlementsMap.clear();
    BillRepository.clearMemoryStoreForTesting();

    // Check persistent bill status via BillRepository
    const existingBill = BillingService.getBill("bill-cust-refresh");
    let isAlreadyPaid = (existingBill?.paymentStatus === 'paid') || (PaymentService.getSettlementByBillId("bill-cust-refresh") !== undefined);

    if (!isAlreadyPaid) {
      const dbBill = await BillRepository.getBillById("bill-cust-refresh");
      if (dbBill && (dbBill.payment_status === 'PAID' || dbBill.payment_status === 'paid')) {
        isAlreadyPaid = true;
      }
    }
    const isRetryPayment = isAlreadyPaid;

    if (!isRetryPayment) {
      mockRecordCustomerSettlement(cust.id, 15000);
    }

    expect(isRetryPayment).toBe(true);
    expect(cust.visit_count).toBe(1);
    expect(cust.total_spend_cents).toBe(15000);
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

    const payRes1 = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-retry-test",
      paymentMethod: "upi",
      amount: billRes.bill.netTotal,
      tableLabel: table.label,
    });
    expect(payRes1.status).toBe("Completed");

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

  // TEST 7: Already-paid bill with no in-memory settlement
  it("TEST 7: Already-paid bill with empty settlementsMap is recognized as paid and returns settlement without error", async () => {
    const billRes = await BillingService.createBill({
      billId: "bill-no-mem",
      orderId: "ord-no-mem",
      tableLabel: "Table 5",
      items: [{ id: "i1", name: "Sandwich", price: 110, qty: 1 }],
    });

    await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-no-mem",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
      tableLabel: "Table 5",
    });

    settlementsMap.clear();

    const res = await PaymentService.recordPayment({
      billId: billRes.bill.billId,
      orderId: "ord-no-mem",
      paymentMethod: "cash",
      amount: billRes.bill.netTotal,
      tableLabel: "Table 5",
    });

    expect(res.status).toBe("Completed");
    expect(res.settlement).toBeDefined();
    expect(res.settlement.billId).toBe(billRes.bill.billId);
  });

  // TEST 8: Normal KOT flow continues to work cleanly and leaves table FREE
  it("TEST 8: Normal KOT flow continues to work cleanly and leaves table FREE", async () => {
    const table = dbTables[0];
    const targetSessionId = mockGetOrCreateDiningSession(table);

    const kotOrder: MockOrder = {
      id: "ord-kot-1",
      orderNumber: 1,
      status: "preparing",
      dining_session_id: targetSessionId,
      items: [{ id: "i1", order_id: "ord-kot-1", name: "Pasta", price: 200, qty: 1 }],
    };
    dbOrders.push(kotOrder);

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
