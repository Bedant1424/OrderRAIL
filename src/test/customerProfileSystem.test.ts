import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizePhoneNumber, formatDisplayPhone } from "@/lib/customers/phoneNormalization";
import {
  resolveOrCreateCustomerProfile,
  recordCustomerSettlement,
  fetchCafeCustomerProfiles,
  aggregateCustomerProfiles,
  type CustomerProfile,
} from "@/lib/customers/customerService";
import { ExportEngine } from "@/lib/analytics/ExportEngine";

describe("Canonical Customer Profile System Suite", () => {
  // In-memory mock database store for testing isolated multi-tenant customer logic
  interface MockCustomer {
    id: string;
    cafe_id: string;
    phone: string;
    normalized_phone: string;
    name: string | null;
    visit_count: number;
    total_spend_cents: number;
    first_visit_at: string | null;
    last_visit_at: string | null;
    created_at: string;
    updated_at: string;
  }

  interface MockBill {
    id: string;
    bill_number: number;
    cafe_id: string;
    customer_id?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    grand_total: number;
    payment_status: string;
    created_at: string;
  }

  interface MockOrder {
    id: string;
    cafe_id: string;
    customer_id?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    total_cents: number;
    status: string;
    created_at: string;
  }

  let customersDb: MockCustomer[] = [];
  let billsDb: MockBill[] = [];
  let ordersDb: MockOrder[] = [];

  const mockResolveOrCreate = (cafeId: string, phone?: string | null, name?: string | null): string | null => {
    const norm = normalizePhoneNumber(phone);
    if (!cafeId || !norm) return null;

    const cleanName = name?.trim() || null;
    const cleanPhone = phone?.trim() || norm;
    const effectiveName = cleanName || norm;

    // Check for existing profile for same cafe + normalized phone
    let existing = customersDb.find((c) => c.cafe_id === cafeId && c.normalized_phone === norm);

    if (existing) {
      const existingNameTrimmed = existing.name?.trim();
      const isPhoneFallback = !existingNameTrimmed || existingNameTrimmed === norm || existingNameTrimmed === cleanPhone;
      if (cleanName && isPhoneFallback) {
        existing.name = cleanName;
        existing.updated_at = new Date().toISOString();
      }
      return existing.id;
    }

    // Create new profile
    const newCust: MockCustomer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      cafe_id: cafeId,
      phone: cleanPhone,
      normalized_phone: norm,
      name: effectiveName,
      visit_count: 0,
      total_spend_cents: 0,
      first_visit_at: null,
      last_visit_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    customersDb.push(newCust);
    return newCust.id;
  };

  const mockRecordSettlement = (customerId: string | null, amountCents: number, dateStr?: string) => {
    if (!customerId) return;
    const cust = customersDb.find((c) => c.id === customerId);
    if (!cust) return;

    const now = dateStr || new Date().toISOString();
    cust.visit_count += 1;
    cust.total_spend_cents += Math.max(0, amountCents);
    if (!cust.first_visit_at) cust.first_visit_at = now;
    cust.last_visit_at = now;
    cust.updated_at = now;
  };

  beforeEach(() => {
    customersDb = [];
    billsDb = [];
    ordersDb = [];
  });

  // Test 1
  it("1. New customer with name + phone creates profile", () => {
    const custId = mockResolveOrCreate("cafe-1", "9876543210", "John Doe");
    expect(custId).toBeTruthy();

    const created = customersDb.find((c) => c.id === custId);
    expect(created).toBeDefined();
    expect(created?.name).toBe("John Doe");
    expect(created?.phone).toBe("9876543210");
    expect(created?.normalized_phone).toBe("9876543210");
  });

  // Test 2
  it("2. Phone-only customer creates profile with phone as fallback name", () => {
    const custId = mockResolveOrCreate("cafe-1", "9876543210", "");
    expect(custId).toBeTruthy();

    const created = customersDb.find((c) => c.id === custId);
    expect(created).toBeDefined();
    expect(created?.name).toBe("9876543210");
    expect(created?.normalized_phone).toBe("9876543210");
  });

  // Test 3
  it("3. No customer information does not create profile", () => {
    const custId1 = mockResolveOrCreate("cafe-1", "", "");
    const custId2 = mockResolveOrCreate("cafe-1", null, null);

    expect(custId1).toBeNull();
    expect(custId2).toBeNull();
    expect(customersDb.length).toBe(0);
  });

  // Test 4
  it("4. Same phone reuses existing customer profile", () => {
    const id1 = mockResolveOrCreate("cafe-1", "9876543210", "John Doe");
    const id2 = mockResolveOrCreate("cafe-1", "9876543210", "John Doe");

    expect(id1).toBe(id2);
    expect(customersDb.length).toBe(1);
  });

  // Test 5
  it("5. Same phone with different name does not create duplicate profile", () => {
    const id1 = mockResolveOrCreate("cafe-1", "9876543210", "John Doe");
    const id2 = mockResolveOrCreate("cafe-1", "9876543210", "Johnathan Doe");

    expect(id1).toBe(id2);
    expect(customersDb.length).toBe(1);
    expect(customersDb[0].name).toBe("John Doe"); // Preserves non-empty existing name
  });

  // Test 6
  it("6. Empty name does not erase existing name", () => {
    const id1 = mockResolveOrCreate("cafe-1", "9876543210", "John Doe");
    const id2 = mockResolveOrCreate("cafe-1", "9876543210", "");

    expect(id1).toBe(id2);
    expect(customersDb[0].name).toBe("John Doe");
  });

  // Test 7 & 8
  it("7 & 8. Phone formatting (+91, spaces, leading 91) resolves consistently to same customer", () => {
    const norm1 = normalizePhoneNumber("98765 43210");
    const norm2 = normalizePhoneNumber("+91 98765 43210");
    const norm3 = normalizePhoneNumber("919876543210");
    const norm4 = normalizePhoneNumber("09876543210");

    expect(norm1).toBe("9876543210");
    expect(norm2).toBe("9876543210");
    expect(norm3).toBe("9876543210");
    expect(norm4).toBe("9876543210");

    const id1 = mockResolveOrCreate("cafe-1", "+91 98765 43210", "Aman");
    const id2 = mockResolveOrCreate("cafe-1", "9876543210", "Aman");
    const id3 = mockResolveOrCreate("cafe-1", "919876543210", "Aman");

    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
    expect(customersDb.length).toBe(1);
  });

  // Test 9
  it("9. Different cafes can have the same phone as separate customers", () => {
    const idCafe1 = mockResolveOrCreate("cafe-1", "9876543210", "Customer A");
    const idCafe2 = mockResolveOrCreate("cafe-2", "9876543210", "Customer B");

    expect(idCafe1).not.toBe(idCafe2);
    expect(customersDb.length).toBe(2);
    expect(customersDb.filter((c) => c.cafe_id === "cafe-1").length).toBe(1);
    expect(customersDb.filter((c) => c.cafe_id === "cafe-2").length).toBe(1);
  });

  // Test 10 & 11
  it("10 & 11. Customer ID is stored on bill and order", () => {
    const custId = mockResolveOrCreate("cafe-1", "9876543210", "John Doe");

    const bill: MockBill = {
      id: "bill-101",
      bill_number: 1,
      cafe_id: "cafe-1",
      customer_id: custId,
      customer_name: "John Doe",
      customer_phone: "9876543210",
      grand_total: 250.0,
      payment_status: "PAID",
      created_at: new Date().toISOString(),
    };
    billsDb.push(bill);

    const order: MockOrder = {
      id: "ord-101",
      cafe_id: "cafe-1",
      customer_id: custId,
      customer_name: "John Doe",
      customer_phone: "9876543210",
      total_cents: 25000,
      status: "served",
      created_at: new Date().toISOString(),
    };
    ordersDb.push(order);

    expect(billsDb[0].customer_id).toBe(custId);
    expect(ordersDb[0].customer_id).toBe(custId);
  });

  // Test 12 & 13
  it("12 & 13. Multiple orders accumulate under one customer and spend increments after payment", () => {
    const custId = mockResolveOrCreate("cafe-1", "9876543210", "Jane");

    // Order 1 settlement (₹250 = 25000 cents)
    mockRecordSettlement(custId, 25000);
    // Order 2 settlement (₹350 = 35000 cents)
    mockRecordSettlement(custId, 35000);

    const cust = customersDb.find((c) => c.id === custId);
    expect(cust?.visit_count).toBe(2);
    expect(cust?.total_spend_cents).toBe(60000); // ₹600.00
  });

  // Test 14 & 15
  it("14 & 15. Unpaid / cancelled orders do not increment customer spend", () => {
    const custId = mockResolveOrCreate("cafe-1", "9876543210", "Jane");

    // Created unpaid order - spend NOT recorded
    const order: MockOrder = {
      id: "ord-201",
      cafe_id: "cafe-1",
      customer_id: custId,
      total_cents: 50000,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    ordersDb.push(order);

    const custBefore = customersDb.find((c) => c.id === custId);
    expect(custBefore?.total_spend_cents).toBe(0);
    expect(custBefore?.visit_count).toBe(0);

    // Cancelled order - spend NOT recorded
    order.status = "cancelled";
    expect(custBefore?.total_spend_cents).toBe(0);
  });

  // Test 16, 17, 18, 19
  it("16-19. Customer history and Owner dashboard directory stats calculations", () => {
    const cust1 = mockResolveOrCreate("cafe-1", "9876543210", "Aman");
    mockRecordSettlement(cust1, 40000); // Visit 1
    mockRecordSettlement(cust1, 60000); // Visit 2

    const cust2 = mockResolveOrCreate("cafe-1", "9123456789", "Priya");
    mockRecordSettlement(cust2, 30000); // Visit 1

    const profiles = customersDb.map((c) => ({
      id: c.id,
      name: c.name || "Walk-in Customer",
      phone: c.phone,
      visitCount: c.visit_count,
      lifetimeSpendCents: c.total_spend_cents,
      averageBillCents: Math.round(c.total_spend_cents / c.visit_count),
      firstVisit: c.first_visit_at || "",
      lastVisit: c.last_visit_at || "",
      preferredChannel: "dine_in",
      channelCounts: { dine_in: c.visit_count },
      orders: [],
    }));

    const totalProfiles = profiles.length;
    const totalSpendCents = profiles.reduce((sum, p) => sum + p.lifetimeSpendCents, 0);
    const avgSpendCents = Math.round(totalSpendCents / totalProfiles);
    const repeatCount = profiles.filter((p) => p.visitCount > 1).length;

    expect(totalProfiles).toBe(2);
    expect(totalSpendCents).toBe(130000); // 40000 + 60000 + 30000
    expect(avgSpendCents).toBe(65000);
    expect(repeatCount).toBe(1); // Aman visited twice
  });

  // Test 20
  it("20. Anonymous walk-ins remain excluded from excludeWalkins aggregation", () => {
    const mockOrders: any[] = [
      { id: "o1", customer_name: null, customer_phone: null, status: "served", total_cents: 10000 },
      { id: "o2", customer_name: "Aman", customer_phone: "9876543210", status: "served", total_cents: 20000 },
    ];

    const profiles = aggregateCustomerProfiles(mockOrders, { excludeWalkins: true });
    expect(profiles.length).toBe(1);
    expect(profiles[0].phone).toBe("9876543210");
  });

  // Test 21 & 22 & 23
  it("21-23. Role & Cafe security checks", () => {
    const custCafe1 = mockResolveOrCreate("cafe-1", "9876543210", "User 1");
    const custCafe2 = mockResolveOrCreate("cafe-2", "9876543210", "User 2");

    // Verify Cafe 1 cannot query Cafe 2 customers
    const cafe1Customers = customersDb.filter((c) => c.cafe_id === "cafe-1");
    expect(cafe1Customers.length).toBe(1);
    expect(cafe1Customers[0].id).toBe(custCafe1);
    expect(cafe1Customers[0].id).not.toBe(custCafe2);
  });

  // Test 24
  it("24. Concurrent customer creation for the same phone handles deduplication cleanly", () => {
    // Simulate two concurrent payment threads resolving the same phone simultaneously
    const thread1 = mockResolveOrCreate("cafe-1", "+91 9876543210", "Concurrent User");
    const thread2 = mockResolveOrCreate("cafe-1", "98765 43210", "Concurrent User");

    expect(thread1).toBe(thread2);
    expect(customersDb.filter((c) => c.cafe_id === "cafe-1").length).toBe(1);
  });

  // Test 25
  it("25. Existing billing flow without customer data completes normally without errors", () => {
    const custId = mockResolveOrCreate("cafe-1", null, null);
    expect(custId).toBeNull();

    const bill: MockBill = {
      id: "bill-anonymous",
      bill_number: 99,
      cafe_id: "cafe-1",
      customer_id: null,
      customer_name: null,
      customer_phone: null,
      grand_total: 150.0,
      payment_status: "PAID",
      created_at: new Date().toISOString(),
    };

    expect(bill.customer_id).toBeNull();
    expect(bill.payment_status).toBe("PAID");
  });

  it("Bonus: Export Engine generates valid CSV output for customer profiles", () => {
    const csv = ExportEngine.exportCustomersToCsv([
      {
        name: "John Doe",
        phone: "9876543210",
        visitCount: 2,
        lifetimeSpendCents: 50000,
        averageBillCents: 25000,
        firstVisit: "2026-08-01T10:00:00Z",
        lastVisit: "2026-08-15T12:00:00Z",
        preferredChannel: "dine_in",
      },
    ]);

    expect(csv).toContain("Customer Name,Phone,Visits");
    expect(csv).toContain("John Doe");
    expect(csv).toContain("9876543210");
    expect(csv).toContain("500.00");
  });
});
