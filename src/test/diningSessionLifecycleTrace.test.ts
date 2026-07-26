import { describe, it, expect } from "vitest";
import { supabase } from "../lib/db";
import { getSessionId } from "../lib/session";
import { getOrCreateDiningSession } from "../lib/tables/tableRepository";
import { createOrderInDb, fetchCustomerOrders } from "../lib/orders/repository";
import { addOrderToHistory, getOrderHistory } from "../lib/orderHistory";

describe("Deep Investigation: Customer Session Persistence & Dining Session Lifecycle", () => {
  it("traces the complete lifecycle of dining_session_id across navigation steps", async () => {
    console.log("=========================================================");
    console.log("DEEP INVESTIGATION TRACE: DINING SESSION LIFECYCLE");
    console.log("=========================================================\n");

    // Fetch an actual table from Supabase DB
    const { data: realTables } = await supabase
      .from("tables")
      .select("*")
      .limit(1);

    if (!realTables || realTables.length === 0) {
      console.warn("No real table found in DB");
      return;
    }
    const tableRow = realTables[0];
    const tableId = tableRow.id;
    const browserSessionId = getSessionId();

    // -------------------------------------------------------------------------
    // STEP 1: QR Scan & Table Resolution
    // -------------------------------------------------------------------------
    const step1Route = `/t/${tableId}`;
    console.log("[STEP 1: QR Scan & Table Resolution]");
    console.log({
      route: step1Route,
      table_id: tableId,
      dining_session_id: tableRow.active_session_id,
      browser_session_id: browserSessionId,
      source: "Supabase DB (`tables` query)",
    });

    // -------------------------------------------------------------------------
    // STEP 2: Dining Session Resolution
    // -------------------------------------------------------------------------
    const resolvedSessionId = await getOrCreateDiningSession(tableRow as any);
    console.log("\n[STEP 2: Dining Session Resolution]");
    console.log({
      route: step1Route,
      table_id: tableId,
      dining_session_id: resolvedSessionId,
      browser_session_id: browserSessionId,
      source: "tableRepository boundary (`getOrCreateDiningSession`)",
    });

    // -------------------------------------------------------------------------
    // STEP 3: Save Identifier to Local Storage & Context
    // -------------------------------------------------------------------------
    const sessionKey = `orderrail.last_session_id.${tableId}`;
    localStorage.setItem(sessionKey, resolvedSessionId);
    const storedSessionInLocalStorage = localStorage.getItem(sessionKey);

    const contextTableObj = { ...tableRow, active_session_id: resolvedSessionId };

    console.log("\n[STEP 3: Save Identifier]");
    console.log({
      route: step1Route,
      table_id: tableId,
      dining_session_id_localStorage: storedSessionInLocalStorage,
      dining_session_id_Context: contextTableObj.active_session_id,
      browser_session_id: browserSessionId,
      source_localStorage: `localStorage key: ${sessionKey}`,
      source_Context: "React Outlet Context (`TableLayout`)",
    });

    // -------------------------------------------------------------------------
    // STEP 4: Menu Navigation
    // -------------------------------------------------------------------------
    const step4Route = `/t/${tableId}`;
    console.log("\n[STEP 4: Menu View]");
    console.log({
      route: step4Route,
      table_id: contextTableObj.id,
      dining_session_id: contextTableObj.active_session_id,
      browser_session_id: browserSessionId,
      source: "React Outlet Context (`TableMenuPage`)",
    });

    // -------------------------------------------------------------------------
    // STEP 5: Cart & Order Placement
    // -------------------------------------------------------------------------
    const step5Route = `/t/${tableId}/cart`;

    // Fetch an available menu item
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("cafe_id", contextTableObj.cafe_id)
      .eq("is_available", true)
      .limit(1);

    const menuItem = menuItems && menuItems.length > 0 ? menuItems[0] : null;
    const orderUuid = crypto.randomUUID();

    console.log("\n[STEP 5: Cart & Order Placement]");
    console.log({
      route: step5Route,
      table_id: contextTableObj.id,
      dining_session_id_sent: contextTableObj.active_session_id,
      browser_session_id: browserSessionId,
      order_id_generated: orderUuid,
      source: "CartView `placeOrder` payload",
    });

    // Insert order into DB
    const insertedOrderId = await createOrderInDb({
      id: orderUuid,
      cafe_id: contextTableObj.cafe_id,
      table_id: contextTableObj.id,
      session_id: browserSessionId,
      dining_session_id: contextTableObj.active_session_id,
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

    addOrderToHistory(insertedOrderId);

    // Query back the inserted order from DB to check dining_session_id
    const { data: dbOrderRow } = await supabase
      .from("orders")
      .select("id, table_id, dining_session_id, session_id, status")
      .eq("id", insertedOrderId)
      .single();

    console.log("[STEP 5: Inserted Order DB Row]");
    console.log({
      order_id: dbOrderRow?.id,
      table_id: dbOrderRow?.table_id,
      dining_session_id_on_order: dbOrderRow?.dining_session_id,
      session_id_on_order: dbOrderRow?.session_id,
      status: dbOrderRow?.status,
      source: "Supabase DB (`orders` row)",
    });

    // -------------------------------------------------------------------------
    // STEP 6: My Orders Initial Load
    // -------------------------------------------------------------------------
    const localOrderIds = getOrderHistory();
    console.log("\n[STEP 6: My Orders Initial Load]");
    console.log({
      route: step5Route,
      table_id: contextTableObj.id,
      dining_session_id_used_in_query: contextTableObj.active_session_id,
      localOrderIds_from_sessionStorage: localOrderIds,
      browser_session_id: browserSessionId,
      source: "CartView `loadHistory` → `fetchCustomerOrders`",
    });

    const initialOrders = await fetchCustomerOrders(
      contextTableObj.id,
      contextTableObj.active_session_id,
      localOrderIds
    );

    console.log("[STEP 6: Query Result]", {
      returned_rows_count: initialOrders.length,
      order_ids: initialOrders.map((o) => o.id),
      dining_session_ids_in_results: initialOrders.map((o) => o.dining_session_id),
    });

    // -------------------------------------------------------------------------
    // STEP 7: Back Navigation & Return to My Orders Again
    // -------------------------------------------------------------------------
    console.log("\n[STEP 7: Back to Menu]");
    console.log({
      route: step4Route,
      table_id: contextTableObj.id,
      dining_session_id: contextTableObj.active_session_id,
      source: "React Outlet Context",
    });

    console.log("\n[STEP 8: My Orders Again]");
    console.log({
      route: step5Route,
      table_id: contextTableObj.id,
      dining_session_id_used_in_query: contextTableObj.active_session_id,
      localOrderIds_from_sessionStorage: getOrderHistory(),
      browser_session_id: browserSessionId,
      source: "CartView `loadHistory` → `fetchCustomerOrders`",
    });

    const secondOrders = await fetchCustomerOrders(
      contextTableObj.id,
      contextTableObj.active_session_id,
      getOrderHistory()
    );

    console.log("[STEP 8: Query Result]", {
      returned_rows_count: secondOrders.length,
      order_ids: secondOrders.map((o) => o.id),
    });

    // -------------------------------------------------------------------------
    // COMPARISON SUMMARY
    // -------------------------------------------------------------------------
    console.log("\n=========================================================");
    console.log("COMPARISON SUMMARY OF DINING SESSION IDENTIFIERS");
    console.log("=========================================================");
    console.log("1. Customer Device (localStorage / Context):", {
      localStorage: storedSessionInLocalStorage,
      contextState: contextTableObj.active_session_id,
    });
    console.log("2. Inserted Order in DB (orders.dining_session_id):", dbOrderRow?.dining_session_id);
    console.log("3. My Orders Query (dining_session_id param):", contextTableObj.active_session_id);

    const isMatch1And2 = storedSessionInLocalStorage === dbOrderRow?.dining_session_id;
    const isMatch2And3 = dbOrderRow?.dining_session_id === contextTableObj.active_session_id;

    console.log("\n[VERIFICATION MATCH STATUS]:", {
      "Device Session === Order DB Session": isMatch1And2,
      "Order DB Session === Query Session": isMatch2And3,
      "All Identical": isMatch1And2 && isMatch2And3,
    });

    expect(isMatch1And2).toBe(true);
    expect(isMatch2And3).toBe(true);
  }, 30000);
});
