import { describe, it, expect } from "vitest";
import { supabase } from "../lib/db";
import { fetchCustomerOrders, createOrderInDb } from "../lib/orders/repository";
import { getOrCreateDiningSession } from "../lib/tables/tableRepository";

describe("Customer Flow Real Instrumentation Trace", () => {
  it("traces exact flow: scan QR -> place order -> Order Status -> Back -> Menu -> My Orders", async () => {
    console.log("=== STARTING REAL FLOW TRACE WITH LIVE DB TABLE & MENU ITEM ===");

    // Fetch an actual table from Supabase DB
    const { data: realTables } = await supabase
      .from("tables")
      .select("*")
      .limit(1);

    if (!realTables || realTables.length === 0) return;
    const realTable = realTables[0];

    // Fetch an actual available menu item for this cafe
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("cafe_id", realTable.cafe_id)
      .eq("is_available", true)
      .limit(1);

    const menuItem = menuItems && menuItems.length > 0 ? menuItems[0] : null;

    console.log("[Step 1: Real DB Data Loaded]", {
      tableId: realTable.id,
      cafeId: realTable.cafe_id,
      label: realTable.label,
      activeSessionId: realTable.active_session_id,
      menuItemId: menuItem?.id,
      menuItemName: menuItem?.name,
    });

    console.log(`[Step 1: Scan QR] Route: /t/${realTable.id}, Component: TableLayout`);
    const activeSessionId = await getOrCreateDiningSession(realTable as any);
    console.log("[Step 1: Session Resolved]", { activeSessionId, tableActiveSessionId: realTable.active_session_id });

    // Step 2: Place order
    const realOrderUuid = crypto.randomUUID();
    const browserSessionId = "browser-sess-789";

    console.log("[Step 2: Place Order] Placing order with createOrderInDb...");
    const createdId = await createOrderInDb({
      id: realOrderUuid,
      cafe_id: realTable.cafe_id,
      table_id: realTable.id,
      session_id: browserSessionId,
      dining_session_id: activeSessionId,
      total_cents: menuItem ? menuItem.price_cents : 1500,
      status: "pending",
      items: [
        {
          menu_item_id: menuItem ? menuItem.id : null,
          name: menuItem ? menuItem.name : "Coffee",
          price_cents: menuItem ? menuItem.price_cents : 1500,
          qty: 1,
        },
      ],
    });
    console.log("[Step 2: Order Placed]", { createdId, orderId: realOrderUuid });

    // Step 3: Wait for Order Status page
    console.log(`[Step 3: Order Status Page] Route: /t/${realTable.id}/order/${realOrderUuid}, Component: OrderStatusView`);

    // Step 4 & 5: Press Back -> Open Menu
    console.log(`[Step 4 & 5: Back to Menu] Route: /t/${realTable.id}, Component: TableMenuPage`);

    // Step 6: Press My Orders
    console.log(`[Step 6: Press My Orders] Route: /t/${realTable.id}/cart, Component: CartView`);

    const localOrderIds = [realOrderUuid];
    console.log("[Step 6: Inputs to fetchCustomerOrders]", {
      tableId: realTable.id,
      activeSessionId: realTable.active_session_id,
      localOrderIds,
    });

    const fetchedOrders = await fetchCustomerOrders(
      realTable.id,
      realTable.active_session_id,
      localOrderIds
    );

    console.log("[Step 6: Returned database rows from fetchCustomerOrders]", {
      count: fetchedOrders.length,
      orders: fetchedOrders.map(o => ({ id: o.id, status: o.status, dining_session_id: o.dining_session_id })),
    });

    const sortedHistory = [...fetchedOrders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const activeOrders = sortedHistory.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s !== "served" && s !== "cancelled";
    });

    const previousOrders = sortedHistory.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "served" || s === "cancelled";
    });

    console.log("[Step 6: Render Evaluation]", {
      "historyOrders.length": fetchedOrders.length,
      "activeOrders.length": activeOrders.length,
      "previousOrders.length": previousOrders.length,
      "draftCart.length": 0,
    });

    if (activeOrders.length === 0 && previousOrders.length === 0) {
      console.log("EMPTY STATE RENDERED");
    } else {
      console.log("ORDER LIST RENDERED");
    }

    console.log("=== END REAL FLOW TRACE ===");
    expect(fetchedOrders.length).toBeGreaterThan(0);
  }, 15000);
});
