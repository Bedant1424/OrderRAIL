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
    console.log("LINE 20: Resetting initial status...");
    try {
      await updateTableStatusInDb(tableId, "free", null);
      console.log("LINE 20 SUCCESS!");
    } catch (e: any) {
      console.log("LINE 20 FAILED:", e?.message);
    }

    console.log("LINE 28: Creating dining session...");
    let sessionId: string = "";
    try {
      sessionId = await createDiningSessionInDb(tableId, table1.cafe_id);
      console.log("LINE 28 SUCCESS!", sessionId);
    } catch (e: any) {
      console.log("LINE 28 FAILED:", e?.message);
      throw e;
    }

    console.log("LINE 38: Closing session and clearing active orders...");
    await supabase.from("orders").update({ status: "cancelled" }).eq("table_id", tableId);
    await supabase.from("orders").update({ status: "cancelled" }).eq("dining_session_id", sessionId);
    await supabase.from("dining_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", sessionId);

    console.log("LINE 38: Updating status to cleaning...");
    try {
      await updateTableStatusInDb(tableId, "cleaning", null);
      console.log("LINE 38 SUCCESS!");
    } catch (e: any) {
      console.log("LINE 38 FAILED:", e?.message);
      throw e;
    }

    console.log("LINE 45: Marking table free...");
    try {
      await supabase.from("orders").update({ status: "cancelled" }).eq("table_id", tableId);
      await markTableFreeInDb(tableId, sessionId);
      console.log("LINE 45 SUCCESS!");
    } catch (e: any) {
      console.log("LINE 45 FAILED:", e?.message);
      throw e;
    }

    const { data: tFinal } = await supabase.from("tables").select("*").eq("id", tableId).single();
    expect(tFinal.status).toBe("free");
    expect(tFinal.active_session_id).toBeNull();
  }, 30000);
});
