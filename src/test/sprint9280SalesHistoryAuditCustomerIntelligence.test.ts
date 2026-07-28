import { describe, it, expect } from "vitest";
import type { Order } from "@/lib/db";
import { calculateOperationalSummary } from "@/lib/orders/metrics";
import { aggregateCustomerProfiles } from "@/lib/customers/customerService";
import { generateOrdersCSV, STANDARDIZED_CSV_HEADERS } from "@/lib/orders/csvExporter";

describe("Sprint 9.2.8.0 — Sales History Audit & Customer Intelligence Tests", () => {
  const mockOrders: Order[] = [
    {
      id: "ord-1",
      cafe_id: "cafe-1",
      order_number: 101,
      table_id: "tbl-1",
      status: "served",
      total_cents: 45000, // ₹450.00
      customer_name: "Rahul Das",
      customer_phone: "+919876543210",
      order_source: "dine_in",
      created_at: "2026-07-20T10:00:00Z",
      updated_at: "2026-07-20T10:30:00Z",
      payment_status: "paid",
    },
    {
      id: "ord-2",
      cafe_id: "cafe-1",
      order_number: 102,
      table_id: "tbl-2",
      status: "served",
      total_cents: 35000, // ₹350.00
      customer_name: "Rahul Das",
      customer_phone: "+919876543210",
      order_source: "swiggy",
      created_at: "2026-07-25T14:00:00Z",
      updated_at: "2026-07-25T14:25:00Z",
      payment_status: "paid",
    },
    {
      id: "ord-3",
      cafe_id: "cafe-1",
      order_number: 103,
      table_id: "tbl-3",
      status: "served",
      total_cents: 20000, // ₹200.00
      customer_name: "",
      customer_phone: "",
      order_source: "takeaway",
      created_at: "2026-07-26T18:00:00Z",
      updated_at: "2026-07-26T18:15:00Z",
      payment_status: "paid",
    },
    {
      id: "ord-4",
      cafe_id: "cafe-1",
      order_number: 104,
      table_id: "tbl-4",
      status: "cancelled",
      total_cents: 15000, // ₹150.00
      customer_name: "Priya Sharma",
      customer_phone: "+919123456789",
      order_source: "zomato",
      created_at: "2026-07-27T19:00:00Z",
      updated_at: "2026-07-27T19:05:00Z",
      payment_status: "unpaid",
    },
  ];

  it("1. Operational summary matches dataset across historical date range", () => {
    const summary = calculateOperationalSummary(mockOrders);

    expect(summary.totalOrdersCount).toBe(4);
    expect(summary.completedCount).toBe(3); // ord-1, ord-2, ord-3
    expect(summary.cancelledCount).toBe(1); // ord-4
    expect(summary.totalRevenue).toBe(100000); // 45000 + 35000 + 20000
  });

  it("2. Aggregates customer profiles by phone number with lifetime metrics", () => {
    const profiles = aggregateCustomerProfiles(mockOrders);

    expect(profiles.length).toBeGreaterThan(0);

    const rahul = profiles.find((p) => p.phone === "+919876543210");
    expect(rahul).toBeDefined();
    expect(rahul?.name).toBe("Rahul Das");
    expect(rahul?.visitCount).toBe(2);
    expect(rahul?.lifetimeSpendCents).toBe(80000); // 45000 + 35000
    expect(rahul?.averageBillCents).toBe(40000); // 80000 / 2
    expect(rahul?.firstVisit).toBe("2026-07-20T10:00:00.000Z");
    expect(rahul?.lastVisit).toBe("2026-07-25T14:00:00.000Z");
  });

  it("3. Handles Walk-in Customers without phone or name gracefully", () => {
    const profiles = aggregateCustomerProfiles(mockOrders);
    const walkin = profiles.find((p) => p.name === "Walk-in Customer");

    expect(walkin).toBeDefined();
    expect(walkin?.visitCount).toBe(1);
    expect(walkin?.lifetimeSpendCents).toBe(20000);
  });

  it("4. Generates CSV export containing Customer Name, Phone, and Channel headers", () => {
    const tableMap = new Map([
      ["tbl-1", "1"],
      ["tbl-2", "2"],
      ["tbl-3", "3"],
      ["tbl-4", "4"],
    ]);

    const csv = generateOrdersCSV(mockOrders, tableMap);

    expect(STANDARDIZED_CSV_HEADERS).toContain("Customer Name");
    expect(STANDARDIZED_CSV_HEADERS).toContain("Customer Phone");
    expect(STANDARDIZED_CSV_HEADERS).toContain("Channel");

    expect(csv).toContain('"Customer Name"');
    expect(csv).toContain('"Customer Phone"');
    expect(csv).toContain('"Channel"');
    expect(csv).toContain('"Rahul Das"');
    expect(csv).toContain('"+919876543210"');
    expect(csv).toContain('"Walk-in Customer"');
  });
});
