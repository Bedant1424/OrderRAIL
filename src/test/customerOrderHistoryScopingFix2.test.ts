import { describe, it, expect } from "vitest";
import { supabase } from "../lib/db";
import { getOrCreateDiningSession, markTableFreeInDb } from "../lib/tables/tableRepository";
import { getSessionId } from "../lib/session";
import { createOrderInDb, fetchCustomerOrders, updateOrderStatusInDb } from "../lib/orders/repository";
import { addOrderToHistory, getOrderHistory, clearOrderHistory } from "../lib/orderHistory";

describe("Fix 2: Scope Customer Order History to Active Dining Session", () => {
  it("verifies order history is strictly scoped to active dining session and closed session orders never leak", async () => {
    // 1. Fetch a real table from DB
    const { data: realTables } = await supabase.from("tables").select("*");
    if (!realTables || realTables.length === 0) return;
    const table = realTables.length >= 5 ? realTables[4] : realTables[realTables.length - 1];
    const tableId = table.id;

    // Clean up active orders for initial setup
    const { data: openOrders } = await supabase
      .from("orders")
      .select("id, session_id")
      .eq("table_id", tableId)
      .in("status", ["pending", "preparing", "ready"]);

    if (openOrders && openOrders.length > 0) {
      for (const o of openOrders) {
        if (o.session_id) {
          await supabase.rpc("cancel_order", { p_order_id: o.id, p_session_id: o.session_id });
        }
      }
    }

    // Explicitly close all lingering non-closed dining sessions for this table
    await supabase
      .from("dining_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("table_id", tableId)
      .neq("status", "closed");

    await supabase
      .from("tables")
      .update({ active_session_id: null, status: "free" })
      .eq("id", tableId);

    // Re-fetch clean table
    const { data: freeTableData } = await supabase
      .from("tables")
      .select("*")
      .eq("id", tableId)
      .single();

    // ==========================================
    // STEP 1: Customer A Scans QR Code & Session 1 Starts
    // ==========================================
    const session1Id = await getOrCreateDiningSession(freeTableData as any);
    expect(session1Id).toBeDefined();

    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("cafe_id", table.cafe_id)
      .eq("is_available", true)
      .limit(1);
    const menuItem = menuItems && menuItems.length > 0 ? menuItems[0] : null;

    const browserSessionId = getSessionId();
    const order1Id = crypto.randomUUID();

    // Place Order 1 in Session 1
    await createOrderInDb({
      id: order1Id,
      cafe_id: table.cafe_id,
      table_id: tableId,
      session_id: browserSessionId,
      dining_session_id: session1Id,
      total_cents: menuItem ? menuItem.price_cents : 1000,
      status: "pending",
      items: [
        {
          menu_item_id: menuItem ? menuItem.id : null,
          name: menuItem ? menuItem.name : "Coffee",
          price_cents: menuItem ? menuItem.price_cents : 1000,
          qty: 1,
        },
      ],
    });

    addOrderToHistory(order1Id, tableId, session1Id);

    // Verify session 1 local order history
    const historySession1 = getOrderHistory(tableId, session1Id);
    expect(historySession1).toContain(order1Id);

    // Verify fetchCustomerOrders returns Order 1 for Session 1
    const customerOrdersS1 = await fetchCustomerOrders(tableId, session1Id, historySession1);
    expect(customerOrdersS1.some((o) => o.id === order1Id)).toBe(true);

    // ==========================================
    // STEP 2: Session 1 Ends & Staff Marks Table Free
    // ==========================================
    await supabase.rpc("cancel_order", { p_order_id: order1Id, p_session_id: browserSessionId });
    await markTableFreeInDb(tableId, session1Id);
    clearOrderHistory(tableId, session1Id);

    // Verify session 1 status is 'closed' in DB
    const { data: closedSessRow } = await supabase
      .from("dining_sessions")
      .select("status")
      .eq("id", session1Id)
      .single();

    expect(closedSessRow?.status).toBe("closed");

    // ==========================================
    // STEP 3: Customer B Scans QR Code & Session 2 Starts
    // ==========================================
    const { data: freedTableData } = await supabase
      .from("tables")
      .select("*")
      .eq("id", tableId)
      .single();

    const session2Id = await getOrCreateDiningSession(freedTableData as any);
    expect(session2Id).not.toBe(session1Id);

    // Verify Customer B's order history for Session 2 is empty
    const historySession2 = getOrderHistory(tableId, session2Id);
    expect(historySession2).not.toContain(order1Id);

    // CRITICAL REQUIREMENT VERIFICATION:
    // fetchCustomerOrders for Session 2 MUST NOT return Order 1 from closed Session 1
    const customerOrdersS2 = await fetchCustomerOrders(tableId, session2Id, historySession1);
    expect(customerOrdersS2.some((o) => o.id === order1Id)).toBe(false);
    expect(customerOrdersS2.length).toBe(0);

    // ==========================================
    // STEP 4: Customer B Places Order 2 in Session 2
    // ==========================================
    const order2Id = crypto.randomUUID();
    await createOrderInDb({
      id: order2Id,
      cafe_id: table.cafe_id,
      table_id: tableId,
      session_id: browserSessionId,
      dining_session_id: session2Id,
      total_cents: menuItem ? menuItem.price_cents : 1200,
      status: "pending",
      items: [
        {
          menu_item_id: menuItem ? menuItem.id : null,
          name: menuItem ? menuItem.name : "Latte",
          price_cents: menuItem ? menuItem.price_cents : 1200,
          qty: 1,
        },
      ],
    });

    addOrderToHistory(order2Id, tableId, session2Id);

    // Verify Session 2 history contains Order 2 but NOT Order 1
    const historyS2Final = getOrderHistory(tableId, session2Id);
    expect(historyS2Final).toContain(order2Id);
    expect(historyS2Final).not.toContain(order1Id);

    // Verify fetchCustomerOrders for Session 2 returns ONLY Order 2
    const s2OrdersFinal = await fetchCustomerOrders(tableId, session2Id, historyS2Final);
    expect(s2OrdersFinal.some((o) => o.id === order2Id)).toBe(true);
    expect(s2OrdersFinal.some((o) => o.id === order1Id)).toBe(false);

    // Cleanup Order 2
    await supabase.rpc("cancel_order", { p_order_id: order2Id, p_session_id: browserSessionId });
    await markTableFreeInDb(tableId, session2Id);
    clearOrderHistory(tableId, session2Id);
  }, 60000);
});
