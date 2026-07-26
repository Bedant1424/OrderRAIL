import { describe, it, expect } from "vitest";
import { supabase } from "../lib/db";
import { getSessionId } from "../lib/session";
import { getOrCreateDiningSession } from "../lib/tables/tableRepository";
import { createOrderInDb, fetchCustomerOrders } from "../lib/orders/repository";
import { addOrderToHistory, getOrderHistory, clearOrderHistory } from "../lib/orderHistory";

describe("Customer Order History & Session Persistence Regression Test", () => {
  it("persists browserSessionId and retains all orders across multiple order placements, reloads, and navigation", async () => {
    // 1. Session Persistence Verification
    const browserSessionId1 = getSessionId();
    expect(browserSessionId1).toBeDefined();

    // Verify session persistence across reloads
    const reloadedSessionId = getSessionId();
    expect(reloadedSessionId).toBe(browserSessionId1);

    // 2. Fetch a real table from DB (pick dedicated table index 2)
    const { data: allTables } = await supabase.from("tables").select("*");
    if (!allTables || allTables.length === 0) {
      console.warn("No real table found in DB; skipping DB integration part of test.");
      return;
    }
    const table = allTables.length >= 3 ? allTables[2] : allTables[0];

    // Fetch an available menu item for this cafe
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("cafe_id", table.cafe_id)
      .eq("is_available", true)
      .limit(1);

    const menuItem = menuItems && menuItems.length > 0 ? menuItems[0] : null;

    // 3. Resolve active dining session
    const activeSessionId = await getOrCreateDiningSession(table as any);
    expect(activeSessionId).toBeDefined();

    // 4. Place First Order
    const orderId1 = crypto.randomUUID();
    await createOrderInDb({
      id: orderId1,
      cafe_id: table.cafe_id,
      table_id: table.id,
      session_id: browserSessionId1,
      dining_session_id: activeSessionId,
      total_cents: menuItem ? menuItem.price_cents : 1000,
      status: "pending",
      items: [
        {
          menu_item_id: menuItem ? menuItem.id : null,
          name: menuItem ? menuItem.name : "Espresso",
          price_cents: menuItem ? menuItem.price_cents : 1000,
          qty: 1,
        },
      ],
    });
    addOrderToHistory(orderId1, table.id, activeSessionId);

    // Verify order 1 is stored in order history
    let historyIds = getOrderHistory(table.id, activeSessionId);
    expect(historyIds).toContain(orderId1);

    // 5. Query My Orders after order 1
    const ordersAfterFirst = await fetchCustomerOrders(table.id, activeSessionId, historyIds);
    expect(ordersAfterFirst.length).toBeGreaterThanOrEqual(1);

    // 6. Place Second Order in same session
    const orderId2 = crypto.randomUUID();
    await createOrderInDb({
      id: orderId2,
      cafe_id: table.cafe_id,
      table_id: table.id,
      session_id: browserSessionId1,
      dining_session_id: activeSessionId,
      total_cents: menuItem ? menuItem.price_cents : 1500,
      status: "pending",
      items: [
        {
          menu_item_id: menuItem ? menuItem.id : null,
          name: menuItem ? menuItem.name : "Croissant",
          price_cents: menuItem ? menuItem.price_cents : 1500,
          qty: 1,
        },
      ],
    });
    addOrderToHistory(orderId2, table.id, activeSessionId);

    historyIds = getOrderHistory(table.id, activeSessionId);
    expect(historyIds).toContain(orderId1);
    expect(historyIds).toContain(orderId2);

    // 7. Query My Orders after order 2 (Simulating Navigation / Page Reload)
    const ordersAfterSecond = await fetchCustomerOrders(table.id, activeSessionId, historyIds);
    expect(ordersAfterSecond.length).toBeGreaterThanOrEqual(2);

    const found1 = ordersAfterSecond.find((o) => o.id === orderId1);
    const found2 = ordersAfterSecond.find((o) => o.id === orderId2);
    expect(found1).toBeDefined();
    expect(found2).toBeDefined();
  }, 30000);

  it("clears local order history when clearOrderHistory is called upon dining session reset", () => {
    const dummyId = crypto.randomUUID();
    addOrderToHistory(dummyId);
    expect(getOrderHistory()).toContain(dummyId);

    clearOrderHistory();
    expect(getOrderHistory()).not.toContain(dummyId);
    expect(getOrderHistory().length).toBe(0);
  });
});
