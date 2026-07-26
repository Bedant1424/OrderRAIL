import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { supabase } from "@/lib/db";
import { generateUUID } from "@/lib/uuid";
import { getOrCreateGuestSession, validateGuestSession, expireGuestSessionsForDiningSession, clearGuestSession } from "@/lib/guestSession";
import { createOrderInDb, editOrderInDb, cancelOrderInDb, fetchCustomerOrders } from "@/lib/orders/repository";
import { RestaurantOperationsService } from "@/lib/operations/RestaurantOperationsService";

describe("Sprint 9.1 — Guest Sessions & Secure Table Access Integration Test Suite", () => {
  let testTableId = "550e8400-e29b-41d4-a716-446655440000";
  let testCafeId = "550e8400-e29b-41d4-a716-446655440001";
  let testMenuItemId: string | null = null;
  let testMenuItemName = "Test Coffee";
  let testMenuItemPrice = 1200;

  beforeEach(async () => {
    localStorage.clear();
    const { data: realTable } = await supabase.from("tables").select("id, cafe_id").limit(1).maybeSingle();
    if (realTable) {
      testTableId = realTable.id;
      testCafeId = realTable.cafe_id;
    }
    const { data: realItem } = await supabase.from("menu_items").select("*").eq("is_available", true).limit(1).maybeSingle();
    if (realItem) {
      testMenuItemId = realItem.id;
      testMenuItemName = realItem.name;
      testMenuItemPrice = realItem.price_cents;
    }
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("1. Single Guest Lifecycle: Scan QR -> Guest Session created -> Order -> Edit -> Cancel -> Reset Table -> Session Expired", async () => {
    // 1. Open a Dining Session for table via Counter/Operations service
    const openRes = await RestaurantOperationsService.openSession(testTableId, testCafeId, "T-91");
    expect(openRes.sessionId).toBeDefined();
    const diningSessionId = openRes.sessionId;

    // 2. Scan QR & Establish Guest Session A
    const guestSessionIdA = await getOrCreateGuestSession(testTableId, diningSessionId);
    expect(guestSessionIdA).toBeDefined();
    expect(guestSessionIdA.length).toBeGreaterThan(10);

    // Verify Guest Session is ACTIVE
    const valA = await validateGuestSession(guestSessionIdA, diningSessionId);
    expect(valA.valid).toBe(true);

    // 3. Order food under Guest Session A
    const orderId1 = await createOrderInDb({
      cafe_id: testCafeId,
      table_id: testTableId,
      dining_session_id: diningSessionId,
      guest_session_id: guestSessionIdA,
      total_cents: testMenuItemPrice,
      note: "Extra hot",
      items: [
        { menu_item_id: testMenuItemId, name: testMenuItemName, price_cents: testMenuItemPrice, qty: 1 }
      ]
    });
    expect(orderId1).toBeDefined();

    // 4. Edit own order under Guest Session A
    await expect(
      editOrderInDb({
        orderId: orderId1,
        items: [{ menu_item_id: testMenuItemId, name: testMenuItemName, price_cents: testMenuItemPrice, qty: 2 }],
        notes: "Extra hot x2",
        updatedBy: "customer",
        guestSessionId: guestSessionIdA,
      })
    ).resolves.not.toThrow();

    // 5. Cancel own order under Guest Session A
    await expect(
      cancelOrderInDb(orderId1, "customer", guestSessionIdA)
    ).resolves.not.toThrow();

    // 6. Reset table (Counter closes Dining Session)
    await RestaurantOperationsService.resetTable(testTableId, testCafeId, diningSessionId);

    // 7. Verify Guest Session A is expired and rejects future operations
    const valAAfterReset = await validateGuestSession(guestSessionIdA, diningSessionId);
    expect(valAAfterReset.valid).toBe(false);
    expect(valAAfterReset.reason).toMatch(/expired|different/i);
  }, 30000);

  test("2. Multiple Guests Scoping: Phones A, B, C place orders, view table history, but edit/cancel ONLY own orders", async () => {
    // 1. Open Dining Session
    const openRes = await RestaurantOperationsService.openSession(testTableId, testCafeId, "T-91");
    const diningSessionId = openRes.sessionId;

    // 2. Establish Guest Sessions for Phone A, Phone B, Phone C
    const guestSessionA = await getOrCreateGuestSession(testTableId, diningSessionId);
    
    // Simulate distinct client devices
    localStorage.clear();
    const guestSessionB = await getOrCreateGuestSession(testTableId, diningSessionId);
    
    localStorage.clear();
    const guestSessionC = await getOrCreateGuestSession(testTableId, diningSessionId);

    expect(guestSessionA).not.toBe(guestSessionB);
    expect(guestSessionB).not.toBe(guestSessionC);

    // 3. Place orders from Phone A and Phone B
    const orderA = await createOrderInDb({
      cafe_id: testCafeId,
      table_id: testTableId,
      dining_session_id: diningSessionId,
      guest_session_id: guestSessionA,
      total_cents: testMenuItemPrice,
      items: [{ menu_item_id: testMenuItemId, name: testMenuItemName, price_cents: testMenuItemPrice, qty: 1 }],
    });

    const orderB = await createOrderInDb({
      cafe_id: testCafeId,
      table_id: testTableId,
      dining_session_id: diningSessionId,
      guest_session_id: guestSessionB,
      total_cents: testMenuItemPrice,
      items: [{ menu_item_id: testMenuItemId, name: testMenuItemName, price_cents: testMenuItemPrice, qty: 1 }],
    });

    // 4. Everyone sees full table order history
    const customerOrdersForA = await fetchCustomerOrders(testTableId, diningSessionId, [], guestSessionA);
    expect(customerOrdersForA.length).toBeGreaterThanOrEqual(2);

    const orderAInA = customerOrdersForA.find((o) => o.id === orderA);
    const orderBInA = customerOrdersForA.find((o) => o.id === orderB);

    expect(orderAInA?.isOwner).toBe(true);
    expect(orderBInA?.isOwner).toBe(false);

    // 5. Phone A can edit/cancel Order A, but NOT Order B
    await expect(
      editOrderInDb({
        orderId: orderA,
        items: [{ menu_item_id: testMenuItemId, name: testMenuItemName, price_cents: testMenuItemPrice, qty: 2 }],
        updatedBy: "customer",
        guestSessionId: guestSessionA,
      })
    ).resolves.not.toThrow();

    await expect(
      editOrderInDb({
        orderId: orderB,
        items: [{ menu_item_id: testMenuItemId, name: testMenuItemName, price_cents: testMenuItemPrice, qty: 2 }],
        updatedBy: "customer",
        guestSessionId: guestSessionA,
      })
    ).rejects.toThrow(/403 Forbidden/i);

    // Phone A trying to cancel Phone B's order
    await expect(
      cancelOrderInDb(orderB, "customer", guestSessionA)
    ).rejects.toThrow(/403 Forbidden/i);

    // Phone B can cancel Order B
    await expect(
      cancelOrderInDb(orderB, "customer", guestSessionB)
    ).resolves.not.toThrow();
  }, 30000);

  test("3. Security Enforcement: Expired or cross-session Guest Sessions are strictly rejected (403)", async () => {
    // Dining Session 1
    const s1 = await RestaurantOperationsService.openSession(testTableId, testCafeId, "T-91");
    const oldGuestSession = await getOrCreateGuestSession(testTableId, s1.sessionId);

    const oldOrder = await createOrderInDb({
      cafe_id: testCafeId,
      table_id: testTableId,
      dining_session_id: s1.sessionId,
      guest_session_id: oldGuestSession,
      total_cents: testMenuItemPrice,
      items: [{ menu_item_id: testMenuItemId, name: testMenuItemName, price_cents: testMenuItemPrice, qty: 1 }],
    });

    // Reset Table -> Closes Session 1 & Expires oldGuestSession
    await RestaurantOperationsService.resetTable(testTableId, testCafeId, s1.sessionId);

    // Dining Session 2
    const s2 = await RestaurantOperationsService.openSession(testTableId, testCafeId, "T-91");

    // Attempt 1: Old guest session trying to place order in New Dining Session 2
    await expect(
      createOrderInDb({
        cafe_id: testCafeId,
        table_id: testTableId,
        dining_session_id: s2.sessionId,
        guest_session_id: oldGuestSession,
        total_cents: testMenuItemPrice,
        items: [{ menu_item_id: testMenuItemId, name: testMenuItemName, price_cents: testMenuItemPrice, qty: 1 }],
      })
    ).rejects.toThrow(/403 Forbidden/i);

    // Attempt 2: Old guest session trying to edit old order
    await expect(
      editOrderInDb({
        orderId: oldOrder,
        items: [{ menu_item_id: testMenuItemId, name: testMenuItemName, price_cents: testMenuItemPrice, qty: 2 }],
        updatedBy: "customer",
        guestSessionId: oldGuestSession,
      })
    ).rejects.toThrow(/403 Forbidden/i);

    // Attempt 3: Old guest session trying to cancel old order
    await expect(
      cancelOrderInDb(oldOrder, "customer", oldGuestSession)
    ).rejects.toThrow(/403 Forbidden/i);

    // Restore on table QR scan should automatically issue a NEW active guest session for Dining Session 2
    const newGuestSession = await getOrCreateGuestSession(testTableId, s2.sessionId);
    expect(newGuestSession).not.toBe(oldGuestSession);
    const valNew = await validateGuestSession(newGuestSession, s2.sessionId);
    expect(valNew.valid).toBe(true);
  }, 30000);
});
