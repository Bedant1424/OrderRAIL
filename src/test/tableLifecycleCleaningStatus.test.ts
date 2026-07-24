import { describe, it, expect } from "vitest";
import { supabase } from "../lib/db";
import { createDiningSessionInDb, updateTableStatusInDb, markTableFreeInDb, closeDiningSessionInDb } from "../lib/tables/tableRepository";

describe("Task 1: Table Lifecycle Transition Test", () => {
  it("verifies full table lifecycle: Available -> Occupied -> Cleaning Required -> Available", async () => {
    // 1. Fetch Table 1
    const { data: table1 } = await supabase.from("tables").select("*").eq("label", "1").single();
    expect(table1).toBeDefined();
    const tableId = table1.id;

    // Reset table orders to cancelled using specific order IDs
    const { data: activeOrders } = await supabase.from("orders").select("id").eq("table_id", tableId).neq("status", "cancelled");
    if (activeOrders && activeOrders.length > 0) {
      for (const o of activeOrders) {
        await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
      }
    }
    await supabase.from("dining_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("table_id", tableId).neq("status", "closed");
    await updateTableStatusInDb(tableId, "free", null);

    // Verify initial status is free / AVAILABLE
    const { data: tInit } = await supabase.from("tables").select("*").eq("id", tableId).single();
    expect(tInit.status).toBe("free");
    expect(tInit.active_session_id).toBeNull();

    // 2. Transition: Available -> Occupied (Open Session / Order Placement)
    const sessionId = await createDiningSessionInDb(tableId, table1.cafe_id);
    expect(sessionId).toBeDefined();

    const { data: tOccupied } = await supabase.from("tables").select("*").eq("id", tableId).single();
    expect(tOccupied.status).toBe("occupied");
    expect(tOccupied.active_session_id).toBe(sessionId);

    // 3. Transition: Occupied -> Cleaning Required (Payment Complete / End Session)
    await supabase.from("orders").update({ status: "cancelled" }).eq("table_id", tableId);
    await closeDiningSessionInDb(sessionId);
    await updateTableStatusInDb(tableId, "cleaning", null);

    const { data: tCleaning } = await supabase.from("tables").select("*").eq("id", tableId).single();
    expect(tCleaning.status).toBe("cleaning");
    expect(tCleaning.active_session_id).toBeNull();

    // 4. Transition: Cleaning Required -> Available (Mark Table Free / Release Table)
    await markTableFreeInDb(tableId, sessionId);

    const { data: tFinal } = await supabase.from("tables").select("*").eq("id", tableId).single();
    expect(tFinal.status).toBe("free");
    expect(tFinal.active_session_id).toBeNull();
  });
});
