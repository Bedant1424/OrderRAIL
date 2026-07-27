import { describe, it } from "vitest";
import { supabase } from "@/lib/db";

describe("Sprint 9.2.5.6 — Table Lifecycle Data Integrity Database Inspection", () => {
  it("Inspects database state for Table 1 and Table 2", async () => {
    // 1. Fetch tables
    const { data: tables } = await supabase.from("tables").select("*").order("label", { numeric: true });

    const table1 = tables?.find((t) => t.label === "Table 1" || t.label === "1" || t.label === "T1" || t.label.includes("1"));
    const table2 = tables?.find((t) => t.label === "Table 2" || t.label === "2" || t.label === "T2" || t.label.includes("2"));

    console.log("TABLE 1 OBJECT:", {
      id: table1?.id,
      label: table1?.label,
      status: table1?.status,
      active_session_id: table1?.active_session_id,
      created_at: table1?.created_at,
    });

    console.log("TABLE 2 OBJECT:", {
      id: table2?.id,
      label: table2?.label,
      status: table2?.status,
      active_session_id: table2?.active_session_id,
      created_at: table2?.created_at,
    });

    const t1Id = table1?.id;
    const t2Id = table2?.id;

    // 2. Fetch dining_sessions for Table 1 and Table 2
    const { data: sessions1 } = await supabase
      .from("dining_sessions")
      .select("id, table_id, status, started_at, created_at, closed_at")
      .eq("table_id", t1Id)
      .order("created_at", { ascending: false });

    const { data: sessions2 } = await supabase
      .from("dining_sessions")
      .select("id, table_id, status, started_at, created_at, closed_at")
      .eq("table_id", t2Id)
      .order("created_at", { ascending: false });

    console.log("TABLE 1 SESSIONS (count=" + (sessions1?.length || 0) + "):", sessions1);
    console.log("TABLE 2 SESSIONS (count=" + (sessions2?.length || 0) + "):", sessions2);

    // 3. Fetch orders for Table 1 and Table 2
    const { data: orders1 } = await supabase
      .from("orders")
      .select("id, order_number, status, dining_session_id, table_id, created_at")
      .eq("table_id", t1Id)
      .order("created_at", { ascending: false });

    const { data: orders2 } = await supabase
      .from("orders")
      .select("id, order_number, status, dining_session_id, table_id, created_at")
      .eq("table_id", t2Id)
      .order("created_at", { ascending: false });

    console.log("TABLE 1 ORDERS (count=" + (orders1?.length || 0) + "):", orders1?.slice(0, 5));
    console.log("TABLE 2 ORDERS (count=" + (orders2?.length || 0) + "):", orders2?.slice(0, 10));
  });
});
