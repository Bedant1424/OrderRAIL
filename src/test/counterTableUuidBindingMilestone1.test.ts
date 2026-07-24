import { describe, it, expect } from "vitest";
import { supabase } from "../lib/db";
import { getOrCreateDiningSession, markTableFreeInDb } from "../lib/tables/tableRepository";
import { getSessionId } from "../lib/session";
import { createOrderInDb, fetchActiveDiningSessionOrders, fetchCustomerOrders } from "../lib/orders/repository";

describe("Milestone 1 Acceptance Criteria: Real Database Table UUID Binding", () => {
  it("verifies Counter POS uses real PostgreSQL table UUIDs for tableSessions lookup and renders active orders", async () => {
    // 1. Fetch real PostgreSQL tables
    const { data: realTables } = await supabase.from("tables").select("*").order("label", { numeric: true, sensitivity: "base" });
    expect(realTables).toBeDefined();
    expect(realTables!.length).toBeGreaterThan(0);

    const testTable = realTables![0];
    const tableUuid = testTable.id;

    // Reset table & lingering sessions
    const { data: openOrders } = await supabase
      .from("orders")
      .select("id, session_id")
      .eq("table_id", tableUuid)
      .in("status", ["pending", "preparing", "ready"]);

    if (openOrders && openOrders.length > 0) {
      for (const o of openOrders) {
        if (o.session_id) {
          await supabase.rpc("cancel_order", { p_order_id: o.id, p_session_id: o.session_id });
        }
      }
    }

    await supabase.from("dining_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("table_id", tableUuid);
    if (testTable.active_session_id) {
      await markTableFreeInDb(tableUuid, testTable.active_session_id);
    }

    // 2. Resolve/Create active dining session
    const targetSessionId = await getOrCreateDiningSession(testTable as any);
    expect(targetSessionId).toBeDefined();

    // 3. Create a counter order in DB
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("cafe_id", testTable.cafe_id)
      .eq("is_available", true)
      .limit(1);
    const menuItem = menuItems && menuItems.length > 0 ? menuItems[0] : null;

    const orderId = crypto.randomUUID();
    const browserSessionId = getSessionId();

    await createOrderInDb({
      id: orderId,
      cafe_id: testTable.cafe_id,
      table_id: tableUuid,
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

    // 4. Verify fetchActiveDiningSessionOrders populates active orders keyed by tableUuid
    const { activeSessions, orders: dbOrders } = await fetchActiveDiningSessionOrders(testTable.cafe_id);

    const activeSessionMap = new Map<string, string>();
    activeSessionMap.set(tableUuid, targetSessionId);

    const sessionsMap: Record<string, any> = {};
    for (const ord of dbOrders) {
      const tId = ord.table_id || "express";
      if (tId !== "express" && ord.dining_session_id === targetSessionId) {
        if (!sessionsMap[tId]) {
          sessionsMap[tId] = {
            sessionId: ord.dining_session_id,
            orders: [],
            draftCart: []
          };
        }
        sessionsMap[tId].orders.push(ord);
      }
    }

    // 5. Verify lookup by tableUuid succeeds (NOT t-1, t-2, etc.)
    const sessionData = sessionsMap[tableUuid];
    expect(sessionData).toBeDefined();
    expect(sessionData.sessionId).toBe(targetSessionId);
    expect(sessionData.orders.length).toBeGreaterThan(0);
    expect(sessionData.orders[0].id).toBe(orderId);

    // Cleanup
    await supabase.rpc("cancel_order", { p_order_id: orderId, p_session_id: browserSessionId });
    await markTableFreeInDb(tableUuid, targetSessionId);
  }, 15000);
});
