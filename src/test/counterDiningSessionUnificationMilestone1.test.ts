import { describe, it, expect } from "vitest";
import { supabase } from "../lib/db";
import { getOrCreateDiningSession, markTableFreeInDb } from "../lib/tables/tableRepository";
import { getSessionId } from "../lib/session";
import { createOrderInDb, fetchCustomerOrders, fetchActiveDiningSessionOrders } from "../lib/orders/repository";
import { addOrderToHistory, getOrderHistory, clearOrderHistory } from "../lib/orderHistory";

describe("Milestone 1: Unify Counter POS with the Dining Engine", () => {
  it("verifies Counter POS orders join the PostgreSQL dining session, promote table to occupied, and appear on Customer QR My Orders", async () => {
    // 1. Pick a dedicated table from DB (index 3 to avoid collision with other test files)
    const { data: realTables } = await supabase.from("tables").select("*");
    if (!realTables || realTables.length === 0) return;
    const table = realTables.length >= 4 ? realTables[3] : realTables[realTables.length - 1];
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

    // Close lingering sessions and ensure table is reset to free via RPC
    if (table.active_session_id) {
      await markTableFreeInDb(tableId, table.active_session_id);
    }

    // Re-fetch clean table
    const { data: freeTable } = await supabase
      .from("tables")
      .select("*")
      .eq("id", tableId)
      .single();

    // ==========================================
    // STEP 1: Counter POS Selects Available Table & Resolves Browsing Session
    // ==========================================
    const targetSessionId = await getOrCreateDiningSession(freeTable as any);
    expect(targetSessionId).toBeDefined();

    // Verify session status is 'browsing' and table status remains 'free'
    const { data: browsingSess } = await supabase
      .from("dining_sessions")
      .select("status")
      .eq("id", targetSessionId)
      .single();
    expect(browsingSess?.status).toBe("browsing");

    const { data: tableAfterScan } = await supabase
      .from("tables")
      .select("status, active_session_id")
      .eq("id", tableId)
      .single();
    expect(tableAfterScan?.status).toBe("free");
    expect(tableAfterScan?.active_session_id).toBe(targetSessionId);

    // ==========================================
    // STEP 2: Counter POS Submits First KOT Order
    // ==========================================
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("cafe_id", table.cafe_id)
      .eq("is_available", true)
      .limit(1);
    const menuItem = menuItems && menuItems.length > 0 ? menuItems[0] : null;

    const counterOrderId = crypto.randomUUID();
    const browserSessionId = getSessionId();

    await createOrderInDb({
      id: counterOrderId,
      cafe_id: table.cafe_id,
      table_id: tableId,
      session_id: browserSessionId,
      dining_session_id: targetSessionId,
      total_cents: menuItem ? menuItem.price_cents : 1800,
      status: "pending",
      items: [
        {
          menu_item_id: menuItem ? menuItem.id : null,
          name: menuItem ? menuItem.name : "Cappuccino",
          price_cents: menuItem ? menuItem.price_cents : 1800,
          qty: 1,
        },
      ],
    });

    // ==========================================
    // STEP 3: Verify Session Promotion & Table Occupancy
    // ==========================================
    const { data: activeSess } = await supabase
      .from("dining_sessions")
      .select("status")
      .eq("id", targetSessionId)
      .single();
    expect(activeSess?.status).toBe("active");

    const { data: occupiedTable } = await supabase
      .from("tables")
      .select("status, active_session_id")
      .eq("id", tableId)
      .single();
    expect(occupiedTable?.status).toBe("occupied");
    expect(occupiedTable?.active_session_id).toBe(targetSessionId);

    // ==========================================
    // STEP 4: Counter POS Active Orders Query (fetchActiveDiningSessionOrders)
    // ==========================================
    const { activeSessions, orders: activeOrders } = await fetchActiveDiningSessionOrders(table.cafe_id);
    const counterOrderFound = activeOrders.find((o) => o.id === counterOrderId);
    expect(counterOrderFound).toBeDefined();
    expect(counterOrderFound?.dining_session_id).toBe(targetSessionId);

    // ==========================================
    // STEP 5: Customer QR My Orders Query (fetchCustomerOrders)
    // ==========================================
    addOrderToHistory(counterOrderId, tableId, targetSessionId);
    const customerOrders = await fetchCustomerOrders(tableId, targetSessionId, [counterOrderId]);
    expect(customerOrders.some((o) => o.id === counterOrderId)).toBe(true);

    // Cleanup Order & Reset Table
    await supabase.rpc("cancel_order", { p_order_id: counterOrderId, p_session_id: browserSessionId });
    await markTableFreeInDb(tableId, targetSessionId);
    clearOrderHistory(tableId, targetSessionId);
  }, 15000);
});
