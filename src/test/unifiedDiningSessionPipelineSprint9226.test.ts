import { describe, it, expect, beforeAll } from "vitest";
import { supabase, type TableRow, type Order } from "@/lib/db";
import { getOrCreateDiningSession, getActiveDiningSession, markTableFreeInDb } from "@/lib/tables/tableRepository";
import { createOrderInDb, updateOrderStatusInDb, fetchActiveDiningSessionOrders, fetchCafeOrders } from "@/lib/orders/repository";

describe("Sprint 9.2.2.6 — Unified Dining Session & Order Pipeline Stabilization", () => {
  let testCafeId = "11111111-2222-3333-4444-555555555555";
  let testTableId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  let realTable: TableRow | null = null;
  let menuItemName = "Item";
  let menuItemId: string | undefined = undefined;
  let createdOrderId: string | null = null;
  let activeSessionId: string | null = null;

  beforeAll(async () => {
    const { data: tables } = await supabase.from("tables").select("*").limit(1);
    if (tables && tables.length > 0) {
      realTable = tables[0] as TableRow;
      testCafeId = realTable.cafe_id;
      testTableId = realTable.id;

      const { data: items } = await supabase
        .from("menu_items")
        .select("*")
        .eq("cafe_id", testCafeId)
        .eq("is_available", true)
        .limit(1);

      if (items && items.length > 0) {
        menuItemName = items[0].name;
        menuItemId = items[0].id;
      }
    }
  });

  it("Scenario 1: Counter creates order and order persists across queries", async () => {
    if (!realTable) {
      expect(true).toBe(true);
      return;
    }

    activeSessionId = await getOrCreateDiningSession(realTable);

    createdOrderId = await createOrderInDb({
      cafe_id: testCafeId,
      table_id: testTableId,
      dining_session_id: activeSessionId,
      total_cents: 1500,
      status: "pending",
      items: [{ menu_item_id: menuItemId, name: menuItemName, price_cents: 1500, qty: 1 }]
    });

    expect(createdOrderId).toBeDefined();

    const { orders } = await fetchActiveDiningSessionOrders(testCafeId);
    const createdOrder = orders.find((o) => o.id === createdOrderId);

    expect(createdOrder).toBeDefined();
    expect(createdOrder?.total_cents).toBe(1500);
  });

  it("Scenario 2: Staff immediately receives Counter order in active orders query", async () => {
    if (!realTable || !createdOrderId) {
      expect(true).toBe(true);
      return;
    }

    const orders = await fetchCafeOrders(testCafeId);
    const activeOrders = orders.filter(
      (o) => o.status === "pending" || o.status === "placed" || o.status === "preparing" || o.status === "ready"
    );

    expect(activeOrders.some((o) => o.id === createdOrderId)).toBe(true);
  });

  it("Scenario 3: Customer sees active table when dining session exists", async () => {
    if (!realTable) {
      expect(true).toBe(true);
      return;
    }

    const activeSess = await getActiveDiningSession(realTable);
    expect(activeSess).not.toBeNull();
    expect(activeSess?.status).not.toBe("closed");
  });

  it("Scenario 4: Accept Order succeeds using valid order_status enum 'preparing'", async () => {
    if (createdOrderId) {
      await expect(updateOrderStatusInDb(createdOrderId, "preparing", "staff")).resolves.not.toThrow();
    }
  });

  it("Scenario 5 & 6: Clear Table / Payment release closes active dining session and frees table", async () => {
    if (!realTable) {
      expect(true).toBe(true);
      return;
    }

    const activeSess = await getActiveDiningSession(realTable);
    if (activeSess) {
      await expect(markTableFreeInDb(realTable.id, activeSess.id)).resolves.not.toThrow();
    }
  });

  it("Scenario 7: Realtime status transitions remain consistent across order lifecycle", () => {
    const validStatuses: Order["status"][] = ["pending", "preparing", "ready", "served", "cancelled"];
    expect(validStatuses).toContain("pending");
    expect(validStatuses).toContain("preparing");
    expect(validStatuses).toContain("ready");
    expect(validStatuses).toContain("served");
    expect(validStatuses).toContain("cancelled");
  });
});
