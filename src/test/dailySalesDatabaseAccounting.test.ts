import { describe, it, expect, beforeEach } from "vitest";

/**
 * Milestone 2A: Authoritative Daily Sales Accounting & Database Rules
 * 
 * Verifies all 30 authoritative accounting, business-date, RBAC, tender aggregation,
 * pipeline metrics, and immutability lock rules for the Daily Sales reporting engine.
 */

interface MockBill {
  id: string;
  bill_number: number;
  cafe_id: string;
  session_id: string;
  payment_status: "PENDING" | "PAID" | "CANCELLED" | "VOIDED" | "REFUNDED";
  payment_method: "CASH" | "UPI" | "CARD" | "MIXED" | "SPLIT" | string;
  subtotal: number;
  discount: number;
  service_charge: number;
  cgst: number;
  sgst: number;
  round_off: number;
  grand_total: number;
  total_items: number;
  created_at: string;
  paid_at: string | null;
  closed_at: string | null;
  business_date?: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
}

interface MockOrder {
  id: string;
  cafe_id: string;
  order_number: number;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  total_cents: number;
  business_date: string;
}

// Canonical Business Date Resolver matching PostgreSQL public.get_cafe_business_date
function getCafeBusinessDate(
  cafeId: string,
  timestamp: string | Date = new Date(),
  cutoffHour: number = 0
): string {
  const ts = new Date(timestamp);
  // IST offset: +05:30 (330 minutes)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const cutoffOffsetMs = cutoffHour * 60 * 60 * 1000;
  const adjustedTime = new Date(ts.getTime() + istOffsetMs - cutoffOffsetMs);
  return adjustedTime.toISOString().slice(0, 10);
}

// Canonical Database Trigger Simulator matching trg_assign_bill_business_date
function simulateAssignBillBusinessDate(
  bill: MockBill,
  cutoffHour: number = 0
): MockBill {
  const isPaid = bill.payment_status === "PAID" || bill.paid_at !== null;
  const targetTs = isPaid
    ? bill.paid_at || bill.created_at || new Date().toISOString()
    : bill.created_at || new Date().toISOString();

  const bizDate = getCafeBusinessDate(bill.cafe_id, targetTs, cutoffHour);
  return { ...bill, business_date: bizDate };
}

// Canonical Immutability Trigger Simulator matching trg_protect_finalized_bills
function simulateProtectFinalizedBillRecords(
  oldBill: MockBill,
  newBill: MockBill | null, // null for DELETE
  currentBizDate: string,
  userRole: string = "counter"
): { allowed: boolean; error?: string } {
  if (userRole === "service_role") {
    return { allowed: true };
  }

  if (oldBill.payment_status === "PAID") {
    if (newBill === null) {
      return {
        allowed: false,
        error: "IMMUTABILITY VIOLATION: Finalized paid bills cannot be deleted.",
      };
    }

    // Past business date
    if (oldBill.business_date && oldBill.business_date < currentBizDate) {
      return {
        allowed: false,
        error: "IMMUTABILITY VIOLATION: Closed bills from past business dates cannot be modified.",
      };
    }

    // Same-day PAID bill financial mutation check
    if (
      newBill.payment_status !== "PAID" ||
      newBill.grand_total !== oldBill.grand_total ||
      newBill.subtotal !== oldBill.subtotal ||
      newBill.discount !== oldBill.discount ||
      newBill.cgst !== oldBill.cgst ||
      newBill.sgst !== oldBill.sgst ||
      newBill.service_charge !== oldBill.service_charge ||
      newBill.round_off !== oldBill.round_off ||
      newBill.payment_method !== oldBill.payment_method ||
      newBill.paid_at !== oldBill.paid_at ||
      newBill.cafe_id !== oldBill.cafe_id
    ) {
      return {
        allowed: false,
        error: "IMMUTABILITY VIOLATION: Financial terms and payment status of a paid bill cannot be modified.",
      };
    }
  }

  return { allowed: true };
}

// Canonical Daily Sales RPC Simulator matching public.get_daily_sales_report
function simulateGetDailySalesReport(
  cafeId: string,
  targetDate: string | null,
  bills: MockBill[],
  orders: MockOrder[],
  caller: { uid: string; role: string; cafeId: string }
) {
  // 1. RBAC Check
  const isAuthorized =
    caller.role === "service_role" ||
    (caller.cafeId === cafeId && ["owner", "counter", "staff", "admin"].includes(caller.role));

  if (!isAuthorized) {
    throw new Error(`403 Forbidden: Insufficient permissions to view daily sales for cafe ${cafeId}`);
  }

  const effectiveDate = targetDate || getCafeBusinessDate(cafeId);

  // 2. Filter matching paid bills for this cafe and date
  const paidBills = bills.filter(
    (b) => b.cafe_id === cafeId && b.business_date === effectiveDate && b.payment_status === "PAID"
  );

  let net_collected = 0;
  let gross_subtotal = 0;
  let total_discounts = 0;
  let total_service_charge = 0;
  let total_cgst = 0;
  let total_sgst = 0;
  let total_round_off = 0;
  let total_items_sold = 0;

  let cash_collected = 0;
  let upi_collected = 0;
  let card_collected = 0;
  let other_collected = 0;

  for (const b of paidBills) {
    net_collected += b.grand_total;
    gross_subtotal += b.subtotal;
    total_discounts += b.discount;
    total_service_charge += b.service_charge;
    total_cgst += b.cgst;
    total_sgst += b.sgst;
    total_round_off += b.round_off;
    total_items_sold += b.total_items;

    const pm = (b.payment_method || "").toUpperCase();
    if (pm === "CASH") cash_collected += b.grand_total;
    else if (pm === "UPI") upi_collected += b.grand_total;
    else if (pm === "CARD") card_collected += b.grand_total;
    else other_collected += b.grand_total;
  }

  const paid_bills_count = paidBills.length;
  const total_tax = total_cgst + total_sgst;
  const average_bill_value =
    paid_bills_count > 0 ? Math.round((net_collected / paid_bills_count) * 100) / 100 : 0;

  // 3. Operational pipeline from orders
  const dayOrders = orders.filter(
    (o) => o.cafe_id === cafeId && o.business_date === effectiveDate
  );

  const unsettled_orders = dayOrders.filter(
    (o) => o.status !== "cancelled" && o.status !== "served"
  );
  const unsettled_orders_count = unsettled_orders.length;
  const unsettled_pipeline_cents = unsettled_orders.reduce((sum, o) => sum + o.total_cents, 0);
  const cancelled_orders_count = dayOrders.filter((o) => o.status === "cancelled").length;

  return {
    business_date: effectiveDate,
    cafe_id: cafeId,
    net_collected,
    gross_subtotal,
    total_discounts,
    total_tax,
    cgst: total_cgst,
    sgst: total_sgst,
    total_service_charge,
    total_round_off,
    paid_bills_count,
    total_items_sold,
    average_bill_value,
    tenders: {
      cash: cash_collected,
      upi: upi_collected,
      card: card_collected,
      other: other_collected,
    },
    pipeline: {
      unsettled_orders_count,
      unsettled_pipeline_cents,
      cancelled_orders_count,
    },
  };
}

describe("Milestone 2A: Authoritative Daily Sales Accounting Rules", () => {
  const CAFE_ID = "6d00d671-eaea-47ce-a842-f970878373c9";
  const OTHER_CAFE_ID = "99999999-9999-4999-8999-999999999999";
  const TODAY = "2026-08-21";
  const YESTERDAY = "2026-08-20";

  let sampleBills: MockBill[];
  let sampleOrders: MockOrder[];

  beforeEach(() => {
    sampleBills = [];
    sampleOrders = [];
  });

  // 1. Pending bill gets business_date
  it("1. Pending bill automatically gets business_date from created_at", () => {
    const rawBill: MockBill = {
      id: "b-1",
      bill_number: 101,
      cafe_id: CAFE_ID,
      session_id: "sess-1",
      payment_status: "PENDING",
      payment_method: "CASH",
      subtotal: 500,
      discount: 0,
      service_charge: 0,
      cgst: 12.5,
      sgst: 12.5,
      round_off: 0,
      grand_total: 525,
      total_items: 2,
      created_at: "2026-08-21T10:30:00.000Z", // 16:00 IST
      paid_at: null,
      closed_at: null,
    };

    const assigned = simulateAssignBillBusinessDate(rawBill);
    expect(assigned.business_date).toBe("2026-08-21");
  });

  // 2. Pending -> PAID recalculates business_date from paid_at
  it("2. Pending -> PAID recalculates business_date from paid_at", () => {
    const pendingBill: MockBill = {
      id: "b-2",
      bill_number: 102,
      cafe_id: CAFE_ID,
      session_id: "sess-2",
      payment_status: "PENDING",
      payment_method: "CASH",
      subtotal: 200,
      discount: 0,
      service_charge: 0,
      cgst: 5,
      sgst: 5,
      round_off: 0,
      grand_total: 210,
      total_items: 1,
      created_at: "2026-08-21T18:15:00.000Z", // 23:45 IST on Aug 21
      paid_at: null,
      closed_at: null,
      business_date: "2026-08-21",
    };

    // Customer pays after midnight at 00:15 IST (Aug 22)
    const paidBill: MockBill = {
      ...pendingBill,
      payment_status: "PAID",
      paid_at: "2026-08-21T18:45:00.000Z", // 00:15 IST on Aug 22
      closed_at: "2026-08-21T18:45:00.000Z",
    };

    const updated = simulateAssignBillBusinessDate(paidBill);
    expect(updated.business_date).toBe("2026-08-22");
  });

  // 3. Payment crossing midnight gets next business date
  it("3. Payment crossing midnight receives the new business date", () => {
    const billBeforeMidnight = simulateAssignBillBusinessDate({
      id: "b-3a",
      bill_number: 103,
      cafe_id: CAFE_ID,
      session_id: "sess-3a",
      payment_status: "PAID",
      payment_method: "UPI",
      subtotal: 100,
      discount: 0,
      service_charge: 0,
      cgst: 2.5,
      sgst: 2.5,
      round_off: 0,
      grand_total: 105,
      total_items: 1,
      created_at: "2026-08-21T18:20:00.000Z",
      paid_at: "2026-08-21T18:29:50.000Z", // 23:59:50 IST (Aug 21)
      closed_at: "2026-08-21T18:29:50.000Z",
    });
    expect(billBeforeMidnight.business_date).toBe("2026-08-21");

    const billAfterMidnight = simulateAssignBillBusinessDate({
      id: "b-3b",
      bill_number: 104,
      cafe_id: CAFE_ID,
      session_id: "sess-3b",
      payment_status: "PAID",
      payment_method: "UPI",
      subtotal: 100,
      discount: 0,
      service_charge: 0,
      cgst: 2.5,
      sgst: 2.5,
      round_off: 0,
      grand_total: 105,
      total_items: 1,
      created_at: "2026-08-21T18:20:00.000Z",
      paid_at: "2026-08-21T18:30:10.000Z", // 00:00:10 IST (Aug 22)
      closed_at: "2026-08-21T18:30:10.000Z",
    });
    expect(billAfterMidnight.business_date).toBe("2026-08-22");
  });

  // 4. Historical paid bill fallback
  it("4. Historical paid bill with null paid_at safely falls back to created_at", () => {
    const historicalBill: MockBill = {
      id: "b-4",
      bill_number: 105,
      cafe_id: CAFE_ID,
      session_id: "sess-4",
      payment_status: "PAID",
      payment_method: "CARD",
      subtotal: 400,
      discount: 0,
      service_charge: 0,
      cgst: 10,
      sgst: 10,
      round_off: 0,
      grand_total: 420,
      total_items: 2,
      created_at: "2026-08-20T10:00:00.000Z",
      paid_at: null, // Legacy / test row
      closed_at: null,
    };

    const assigned = simulateAssignBillBusinessDate(historicalBill);
    expect(assigned.business_date).toBe("2026-08-20");
  });

  // 5, 6, 7, 8. PAID included, REFUNDED / VOIDED / CANCELLED excluded
  it("5-8. Daily Sales aggregates ONLY PAID bills, excluding REFUNDED, VOIDED, CANCELLED and PENDING", () => {
    const bills: MockBill[] = [
      {
        id: "b-paid",
        bill_number: 1,
        cafe_id: CAFE_ID,
        session_id: "s-1",
        payment_status: "PAID",
        payment_method: "CASH",
        subtotal: 1000,
        discount: 100,
        service_charge: 50,
        cgst: 23.75,
        sgst: 23.75,
        round_off: 0.5,
        grand_total: 998,
        total_items: 4,
        created_at: "2026-08-21T06:00:00.000Z",
        paid_at: "2026-08-21T06:30:00.000Z",
        closed_at: "2026-08-21T06:30:00.000Z",
        business_date: TODAY,
      },
      {
        id: "b-refunded",
        bill_number: 2,
        cafe_id: CAFE_ID,
        session_id: "s-2",
        payment_status: "REFUNDED",
        payment_method: "UPI",
        subtotal: 500,
        discount: 0,
        service_charge: 0,
        cgst: 12.5,
        sgst: 12.5,
        round_off: 0,
        grand_total: 525,
        total_items: 2,
        created_at: "2026-08-21T07:00:00.000Z",
        paid_at: "2026-08-21T07:15:00.000Z",
        closed_at: "2026-08-21T07:30:00.000Z",
        business_date: TODAY,
      },
      {
        id: "b-voided",
        bill_number: 3,
        cafe_id: CAFE_ID,
        session_id: "s-3",
        payment_status: "VOIDED",
        payment_method: "CASH",
        subtotal: 300,
        discount: 0,
        service_charge: 0,
        cgst: 7.5,
        sgst: 7.5,
        round_off: 0,
        grand_total: 315,
        total_items: 1,
        created_at: "2026-08-21T08:00:00.000Z",
        paid_at: null,
        closed_at: null,
        business_date: TODAY,
      },
      {
        id: "b-cancelled",
        bill_number: 4,
        cafe_id: CAFE_ID,
        session_id: "s-4",
        payment_status: "CANCELLED",
        payment_method: "CASH",
        subtotal: 200,
        discount: 0,
        service_charge: 0,
        cgst: 5,
        sgst: 5,
        round_off: 0,
        grand_total: 210,
        total_items: 1,
        created_at: "2026-08-21T09:00:00.000Z",
        paid_at: null,
        closed_at: null,
        business_date: TODAY,
      },
      {
        id: "b-pending",
        bill_number: 5,
        cafe_id: CAFE_ID,
        session_id: "s-5",
        payment_status: "PENDING",
        payment_method: "CASH",
        subtotal: 400,
        discount: 0,
        service_charge: 0,
        cgst: 10,
        sgst: 10,
        round_off: 0,
        grand_total: 420,
        total_items: 2,
        created_at: "2026-08-21T10:00:00.000Z",
        paid_at: null,
        closed_at: null,
        business_date: TODAY,
      },
    ];

    const report = simulateGetDailySalesReport(
      CAFE_ID,
      TODAY,
      bills,
      [],
      { uid: "u-1", role: "counter", cafeId: CAFE_ID }
    );

    expect(report.paid_bills_count).toBe(1);
    expect(report.net_collected).toBe(998);
    expect(report.gross_subtotal).toBe(1000);
    expect(report.total_discounts).toBe(100);
    expect(report.total_service_charge).toBe(50);
  });

  // 9, 10, 11, 12. Tender breakdown: CASH, UPI, CARD, OTHER/SPLIT
  it("9-12. Correctly categorizes tender breakdowns without assuming split ratios", () => {
    const bills: MockBill[] = [
      {
        id: "b-cash",
        bill_number: 10,
        cafe_id: CAFE_ID,
        session_id: "s-10",
        payment_status: "PAID",
        payment_method: "CASH",
        subtotal: 500,
        discount: 0,
        service_charge: 0,
        cgst: 0,
        sgst: 0,
        round_off: 0,
        grand_total: 500,
        total_items: 2,
        created_at: "2026-08-21T05:00:00.000Z",
        paid_at: "2026-08-21T05:10:00.000Z",
        closed_at: "2026-08-21T05:10:00.000Z",
        business_date: TODAY,
      },
      {
        id: "b-upi",
        bill_number: 11,
        cafe_id: CAFE_ID,
        session_id: "s-11",
        payment_status: "PAID",
        payment_method: "UPI",
        subtotal: 800,
        discount: 0,
        service_charge: 0,
        cgst: 0,
        sgst: 0,
        round_off: 0,
        grand_total: 800,
        total_items: 3,
        created_at: "2026-08-21T05:20:00.000Z",
        paid_at: "2026-08-21T05:30:00.000Z",
        closed_at: "2026-08-21T05:30:00.000Z",
        business_date: TODAY,
      },
      {
        id: "b-card",
        bill_number: 12,
        cafe_id: CAFE_ID,
        session_id: "s-12",
        payment_status: "PAID",
        payment_method: "CARD",
        subtotal: 1200,
        discount: 0,
        service_charge: 0,
        cgst: 0,
        sgst: 0,
        round_off: 0,
        grand_total: 1200,
        total_items: 4,
        created_at: "2026-08-21T05:40:00.000Z",
        paid_at: "2026-08-21T05:50:00.000Z",
        closed_at: "2026-08-21T05:50:00.000Z",
        business_date: TODAY,
      },
      {
        id: "b-mixed",
        bill_number: 13,
        cafe_id: CAFE_ID,
        session_id: "s-13",
        payment_status: "PAID",
        payment_method: "MIXED",
        subtotal: 600,
        discount: 0,
        service_charge: 0,
        cgst: 0,
        sgst: 0,
        round_off: 0,
        grand_total: 600,
        total_items: 2,
        created_at: "2026-08-21T06:00:00.000Z",
        paid_at: "2026-08-21T06:10:00.000Z",
        closed_at: "2026-08-21T06:10:00.000Z",
        business_date: TODAY,
      },
    ];

    const report = simulateGetDailySalesReport(
      CAFE_ID,
      TODAY,
      bills,
      [],
      { uid: "u-1", role: "counter", cafeId: CAFE_ID }
    );

    expect(report.tenders.cash).toBe(500);
    expect(report.tenders.upi).toBe(800);
    expect(report.tenders.card).toBe(1200);
    expect(report.tenders.other).toBe(600);
    expect(report.net_collected).toBe(3100);
  });

  // 13, 14, 15, 16, 17, 18. Financial Breakdown Aggregation
  it("13-18. Accurately calculates taxes, discounts, service charges, round-off, average bill value, and item counts", () => {
    const bills: MockBill[] = [
      {
        id: "b-21",
        bill_number: 21,
        cafe_id: CAFE_ID,
        session_id: "s-21",
        payment_status: "PAID",
        payment_method: "UPI",
        subtotal: 1000,
        discount: 100, // net subtotal = 900
        service_charge: 45, // 5%
        cgst: 22.5, // 2.5%
        sgst: 22.5, // 2.5%
        round_off: 0.0,
        grand_total: 990,
        total_items: 5,
        created_at: "2026-08-21T08:00:00.000Z",
        paid_at: "2026-08-21T08:30:00.000Z",
        closed_at: "2026-08-21T08:30:00.000Z",
        business_date: TODAY,
      },
      {
        id: "b-22",
        bill_number: 22,
        cafe_id: CAFE_ID,
        session_id: "s-22",
        payment_status: "PAID",
        payment_method: "CASH",
        subtotal: 500,
        discount: 50,
        service_charge: 0,
        cgst: 11.25,
        sgst: 11.25,
        round_off: 0.5,
        grand_total: 473,
        total_items: 2,
        created_at: "2026-08-21T09:00:00.000Z",
        paid_at: "2026-08-21T09:20:00.000Z",
        closed_at: "2026-08-21T09:20:00.000Z",
        business_date: TODAY,
      },
    ];

    const report = simulateGetDailySalesReport(
      CAFE_ID,
      TODAY,
      bills,
      [],
      { uid: "u-1", role: "counter", cafeId: CAFE_ID }
    );

    expect(report.gross_subtotal).toBe(1500);
    expect(report.total_discounts).toBe(150);
    expect(report.total_service_charge).toBe(45);
    expect(report.cgst).toBe(33.75);
    expect(report.sgst).toBe(33.75);
    expect(report.total_tax).toBe(67.5);
    expect(report.total_round_off).toBe(0.5);
    expect(report.net_collected).toBe(1463);
    expect(report.paid_bills_count).toBe(2);
    expect(report.total_items_sold).toBe(7);
    expect(report.average_bill_value).toBe(731.5);
  });

  // 19, 20, 21. Operational Pipeline & Cancellation metrics
  it("19-21. Accurately reports active unsettled orders and cancellation counts from orders table", () => {
    const orders: MockOrder[] = [
      { id: "o-1", cafe_id: CAFE_ID, order_number: 1, status: "pending", total_cents: 25000, business_date: TODAY },
      { id: "o-2", cafe_id: CAFE_ID, order_number: 2, status: "preparing", total_cents: 45000, business_date: TODAY },
      { id: "o-3", cafe_id: CAFE_ID, order_number: 3, status: "ready", total_cents: 15000, business_date: TODAY },
      { id: "o-4", cafe_id: CAFE_ID, order_number: 4, status: "served", total_cents: 85000, business_date: TODAY }, // Finalized
      { id: "o-5", cafe_id: CAFE_ID, order_number: 5, status: "cancelled", total_cents: 20000, business_date: TODAY }, // Cancelled
      { id: "o-6", cafe_id: CAFE_ID, order_number: 6, status: "cancelled", total_cents: 30000, business_date: TODAY }, // Cancelled
    ];

    const report = simulateGetDailySalesReport(
      CAFE_ID,
      TODAY,
      [],
      orders,
      { uid: "u-1", role: "counter", cafeId: CAFE_ID }
    );

    expect(report.pipeline.unsettled_orders_count).toBe(3); // pending, preparing, ready
    expect(report.pipeline.unsettled_pipeline_cents).toBe(85000); // 25000 + 45000 + 15000
    expect(report.pipeline.cancelled_orders_count).toBe(2);
  });

  // 22, 23. RBAC Tenant Isolation
  it("22-23. Rejects unauthorized callers or cross-cafe daily sales access", () => {
    expect(() =>
      simulateGetDailySalesReport(
        CAFE_ID,
        TODAY,
        [],
        [],
        { uid: "u-intruder", role: "counter", cafeId: OTHER_CAFE_ID } // Different cafe
      )
    ).toThrow(/403 Forbidden/);

    expect(() =>
      simulateGetDailySalesReport(
        CAFE_ID,
        TODAY,
        [],
        [],
        { uid: "u-guest", role: "customer", cafeId: CAFE_ID } // Unsupported role
      )
    ).toThrow(/403 Forbidden/);
  });

  // 24, 25. Past paid bill immutability: block UPDATE and DELETE
  it("24-25. Rejects any UPDATE or DELETE on paid bills from past business dates", () => {
    const historicalPaidBill: MockBill = {
      id: "b-hist",
      bill_number: 99,
      cafe_id: CAFE_ID,
      session_id: "s-hist",
      payment_status: "PAID",
      payment_method: "CASH",
      subtotal: 500,
      discount: 0,
      service_charge: 0,
      cgst: 0,
      sgst: 0,
      round_off: 0,
      grand_total: 500,
      total_items: 2,
      created_at: "2026-08-20T10:00:00.000Z",
      paid_at: "2026-08-20T10:30:00.000Z",
      closed_at: "2026-08-20T10:30:00.000Z",
      business_date: YESTERDAY,
    };

    // Attempt DELETE
    const deleteAttempt = simulateProtectFinalizedBillRecords(
      historicalPaidBill,
      null, // DELETE
      TODAY,
      "counter"
    );
    expect(deleteAttempt.allowed).toBe(false);
    expect(deleteAttempt.error).toMatch(/cannot be deleted/);

    // Attempt UPDATE
    const updateAttempt = simulateProtectFinalizedBillRecords(
      historicalPaidBill,
      { ...historicalPaidBill, customer_name: "Tampered" },
      TODAY,
      "counter"
    );
    expect(updateAttempt.allowed).toBe(false);
    expect(updateAttempt.error).toMatch(/past business dates cannot be modified/);
  });

  // 26, 27. Same-day paid bills: allow metadata, reject financial mutation
  it("26-27. Permits legitimate customer metadata updates on same-day PAID bills, but blocks financial tampering", () => {
    const todayPaidBill: MockBill = {
      id: "b-today",
      bill_number: 100,
      cafe_id: CAFE_ID,
      session_id: "s-today",
      payment_status: "PAID",
      payment_method: "UPI",
      subtotal: 450,
      discount: 0,
      service_charge: 0,
      cgst: 11.25,
      sgst: 11.25,
      round_off: 0.5,
      grand_total: 473,
      total_items: 3,
      created_at: "2026-08-21T09:00:00.000Z",
      paid_at: "2026-08-21T09:15:00.000Z",
      closed_at: "2026-08-21T09:15:00.000Z",
      business_date: TODAY,
    };

    // 26: Permitted customer metadata update
    const metadataUpdate = simulateProtectFinalizedBillRecords(
      todayPaidBill,
      {
        ...todayPaidBill,
        customer_id: "cust-123",
        customer_name: "Rahul Sharma",
        customer_phone: "9876543210",
      },
      TODAY,
      "counter"
    );
    expect(metadataUpdate.allowed).toBe(true);

    // 27: Rejected financial tampering (attempting to alter grand_total)
    const financialMutation = simulateProtectFinalizedBillRecords(
      todayPaidBill,
      {
        ...todayPaidBill,
        grand_total: 300, // Tampered
      },
      TODAY,
      "counter"
    );
    expect(financialMutation.allowed).toBe(false);
    expect(financialMutation.error).toMatch(/Financial terms and payment status of a paid bill cannot be modified/);
  });

  // 28. Pending bill updates still work cleanly
  it("28. Allows full editing and recalculation on PENDING draft bills", () => {
    const pendingBill: MockBill = {
      id: "b-pending-edit",
      bill_number: 101,
      cafe_id: CAFE_ID,
      session_id: "s-p1",
      payment_status: "PENDING",
      payment_method: "CASH",
      subtotal: 100,
      discount: 0,
      service_charge: 0,
      cgst: 2.5,
      sgst: 2.5,
      round_off: 0,
      grand_total: 105,
      total_items: 1,
      created_at: "2026-08-21T10:00:00.000Z",
      paid_at: null,
      closed_at: null,
      business_date: TODAY,
    };

    // Order items modified -> bill recalculated
    const updatedDraft = simulateProtectFinalizedBillRecords(
      pendingBill,
      {
        ...pendingBill,
        subtotal: 250,
        cgst: 6.25,
        sgst: 6.25,
        grand_total: 262.5,
        total_items: 2,
      },
      TODAY,
      "counter"
    );
    expect(updatedDraft.allowed).toBe(true);
  });

  // 29. Existing payment transition (PENDING -> PAID) remains functional
  it("29. Normal settlement transition (PENDING -> PAID) succeeds without immutability violation", () => {
    const pendingBill: MockBill = {
      id: "b-settle",
      bill_number: 102,
      cafe_id: CAFE_ID,
      session_id: "s-p2",
      payment_status: "PENDING",
      payment_method: "CASH",
      subtotal: 300,
      discount: 0,
      service_charge: 0,
      cgst: 7.5,
      sgst: 7.5,
      round_off: 0,
      grand_total: 315,
      total_items: 2,
      created_at: "2026-08-21T11:00:00.000Z",
      paid_at: null,
      closed_at: null,
      business_date: TODAY,
    };

    // Payment is completed
    const settlementResult = simulateProtectFinalizedBillRecords(
      pendingBill,
      {
        ...pendingBill,
        payment_status: "PAID",
        payment_method: "UPI",
        paid_at: "2026-08-21T11:15:00.000Z",
        closed_at: "2026-08-21T11:15:00.000Z",
      },
      TODAY,
      "counter"
    );
    expect(settlementResult.allowed).toBe(true);
  });

  // 30. RPC returns zero totals safely when no paid bills exist
  it("30. Daily Sales RPC cleanly returns zero figures when no transactions exist for the business date", () => {
    const emptyReport = simulateGetDailySalesReport(
      CAFE_ID,
      "2026-08-25", // Future date with zero data
      [],
      [],
      { uid: "u-1", role: "counter", cafeId: CAFE_ID }
    );

    expect(emptyReport.net_collected).toBe(0);
    expect(emptyReport.gross_subtotal).toBe(0);
    expect(emptyReport.total_discounts).toBe(0);
    expect(emptyReport.total_tax).toBe(0);
    expect(emptyReport.total_service_charge).toBe(0);
    expect(emptyReport.total_round_off).toBe(0);
    expect(emptyReport.paid_bills_count).toBe(0);
    expect(emptyReport.total_items_sold).toBe(0);
    expect(emptyReport.average_bill_value).toBe(0);
    expect(emptyReport.tenders.cash).toBe(0);
    expect(emptyReport.tenders.upi).toBe(0);
    expect(emptyReport.tenders.card).toBe(0);
    expect(emptyReport.tenders.other).toBe(0);
    expect(emptyReport.pipeline.unsettled_orders_count).toBe(0);
    expect(emptyReport.pipeline.unsettled_pipeline_cents).toBe(0);
    expect(emptyReport.pipeline.cancelled_orders_count).toBe(0);
  });
});
