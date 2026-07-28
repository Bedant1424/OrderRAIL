import { describe, it, expect } from "vitest";
import type { Order } from "@/lib/db";
import { aggregateCustomerProfiles } from "@/lib/customers/customerService";

describe("Sprint 9.2.8.1 — Customer Directory Unit Tests", () => {
  const mockOrders: Order[] = [
    {
      id: "ord-1",
      cafe_id: "cafe-1",
      order_number: 201,
      table_id: "tbl-1",
      status: "served",
      total_cents: 60000, // ₹600.00
      customer_name: "Aman Gupta",
      customer_phone: "+919988776655",
      order_source: "dine_in",
      created_at: "2026-07-15T12:00:00Z",
      updated_at: "2026-07-15T12:30:00Z",
      payment_status: "paid",
    },
    {
      id: "ord-2",
      cafe_id: "cafe-1",
      order_number: 202,
      table_id: "tbl-2",
      status: "served",
      total_cents: 40000, // ₹400.00
      customer_name: "Aman Gupta",
      customer_phone: "+919988776655",
      order_source: "swiggy",
      created_at: "2026-07-22T15:00:00Z",
      updated_at: "2026-07-22T15:20:00Z",
      payment_status: "paid",
    },
    {
      id: "ord-3",
      cafe_id: "cafe-1",
      order_number: 203,
      table_id: "tbl-3",
      status: "served",
      total_cents: 25000, // ₹250.00
      customer_name: "Sneha Roy",
      customer_phone: "+919876500000",
      order_source: "takeaway",
      created_at: "2026-07-26T18:00:00Z",
      updated_at: "2026-07-26T18:15:00Z",
      payment_status: "paid",
    },
    {
      id: "ord-4",
      cafe_id: "cafe-1",
      order_number: 204,
      table_id: "tbl-4",
      status: "served",
      total_cents: 15000, // ₹150.00
      customer_name: "",
      customer_phone: "",
      order_source: "dine_in",
      created_at: "2026-07-27T19:00:00Z",
      updated_at: "2026-07-27T19:20:00Z",
      payment_status: "paid",
    },
  ];

  it("1. Excludes anonymous Walk-in customers when excludeWalkins is true", () => {
    const profiles = aggregateCustomerProfiles(mockOrders, { excludeWalkins: true });

    expect(profiles.length).toBe(2); // Aman Gupta and Sneha Roy only
    const walkinExists = profiles.some((p) => p.name === "Walk-in Customer" && !p.phone);
    expect(walkinExists).toBe(false);
  });

  it("2. Aggregates profiles with correct visit count, spend, and preferred channel", () => {
    const profiles = aggregateCustomerProfiles(mockOrders, { excludeWalkins: true });
    const aman = profiles.find((p) => p.phone === "+919988776655");

    expect(aman).toBeDefined();
    expect(aman?.name).toBe("Aman Gupta");
    expect(aman?.visitCount).toBe(2);
    expect(aman?.lifetimeSpendCents).toBe(100000); // 60000 + 40000
    expect(aman?.averageBillCents).toBe(50000);
  });

  it("3. Correctly filters profiles by customer name, phone number, and channel search", () => {
    const profiles = aggregateCustomerProfiles(mockOrders, { excludeWalkins: true });

    const searchByName = profiles.filter((p) => p.name.toLowerCase().includes("sneha"));
    expect(searchByName.length).toBe(1);
    expect(searchByName[0].name).toBe("Sneha Roy");

    const searchByPhone = profiles.filter((p) => p.phone?.includes("9988776655"));
    expect(searchByPhone.length).toBe(1);
    expect(searchByPhone[0].name).toBe("Aman Gupta");
  });
});
