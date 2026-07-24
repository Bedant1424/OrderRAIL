import { describe, it, expect } from "vitest";
import { supabase } from "../lib/db";
import { getOrCreateDiningSession, markTableFreeInDb } from "../lib/tables/tableRepository";
import { getSessionId } from "../lib/session";
import { createOrderInDb } from "../lib/orders/repository";

describe("Fix 1: Restore Dining Session Lifecycle", () => {
  it("verifies QR scan keeps table available ('free'), first order promotes to 'occupied', and reset frees session", async () => {
    // 1. Fetch a real table from DB
    const { data: realTables } = await supabase.from("tables").select("*");
    if (!realTables || realTables.length === 0) return;
    const table = realTables[realTables.length - 1];

    // Cancel any existing active orders so initial reset works
    const { data: openOrders } = await supabase
      .from("orders")
      .select("id, session_id")
      .eq("table_id", table.id)
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
      .eq("table_id", table.id)
      .neq("status", "closed");

    // Ensure table is reset to free initially
    await supabase
      .from("tables")
      .update({ active_session_id: null, status: "free" })
      .eq("id", table.id);

    // Re-fetch clean table
    const { data: freeTableData } = await supabase
      .from("tables")
      .select("*")
      .eq("id", table.id)
      .single();

    expect(freeTableData?.status).toBe("free");
    expect(freeTableData?.active_session_id).toBeNull();

    // STEP 1: Customer Scans QR Code
    const activeSessionId = await getOrCreateDiningSession(freeTableData as any);
    expect(activeSessionId).toBeDefined();

    // Verify session status is 'browsing' in dining_sessions table
    const { data: sessRow } = await supabase
      .from("dining_sessions")
      .select("status")
      .eq("id", activeSessionId)
      .single();

    expect(sessRow?.status).toBe("browsing");

    // Verify table status is STILL 'free' after QR scan
    const { data: scannedTableData } = await supabase
      .from("tables")
      .select("*")
      .eq("id", table.id)
      .single();

    expect(scannedTableData?.status).toBe("free");
    expect(scannedTableData?.active_session_id).toBe(activeSessionId);

    // STEP 2: Customer Submits First Order
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("cafe_id", table.cafe_id)
      .eq("is_available", true)
      .limit(1);

    const menuItem = menuItems && menuItems.length > 0 ? menuItems[0] : null;

    const orderId = crypto.randomUUID();
    const sessionId = getSessionId();

    await createOrderInDb({
      id: orderId,
      cafe_id: table.cafe_id,
      table_id: table.id,
      session_id: sessionId,
      dining_session_id: activeSessionId,
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

    // Verify session status is promoted to 'active'
    const { data: activeSessRow } = await supabase
      .from("dining_sessions")
      .select("status")
      .eq("id", activeSessionId)
      .single();

    expect(activeSessRow?.status).toBe("active");

    // Verify table status is now 'occupied'
    const { data: occupiedTableData } = await supabase
      .from("tables")
      .select("*")
      .eq("id", table.id)
      .single();

    expect(occupiedTableData?.status).toBe("occupied");

    // STEP 3: Cancel Order via RPC & Mark Table Free
    await supabase.rpc("cancel_order", { p_order_id: orderId, p_session_id: sessionId });
    await markTableFreeInDb(table.id, activeSessionId);

    const { data: freedTableData } = await supabase
      .from("tables")
      .select("*")
      .eq("id", table.id)
      .single();

    expect(freedTableData?.status).toBe("free");
    expect(freedTableData?.active_session_id).toBeNull();

    const { data: closedSessRow } = await supabase
      .from("dining_sessions")
      .select("status")
      .eq("id", activeSessionId)
      .single();

    expect(closedSessRow?.status).toBe("closed");

    // STEP 4: Next Customer Scans QR Code
    const nextSessionId = await getOrCreateDiningSession(freedTableData as any);
    expect(nextSessionId).not.toBe(activeSessionId);

    const { data: nextSessRow } = await supabase
      .from("dining_sessions")
      .select("status")
      .eq("id", nextSessionId)
      .single();

    expect(nextSessRow?.status).toBe("browsing");
  }, 15000);
});
