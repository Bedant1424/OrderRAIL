import { supabase, type TableRow, type ServiceRequest } from "@/lib/db";

/**
 * Table Repository for Dining Sessions & Table Lifecycle Management.
 * Enforces session continuity rules across QR scans, order placements, and table releases.
 */

export async function fetchCafeTables(cafeId: string): Promise<TableRow[]> {
  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .eq("cafe_id", cafeId)
    .order("label", { numeric: true, sensitivity: "base" });

  if (error) throw error;
  return (data ?? []) as TableRow[];
}

export async function markTableFreeInDb(tableId: string, activeSessionId?: string | null): Promise<void> {
  // 1. Try Supabase Postgres RPC 'free_table'
  const { error: rpcErr } = await supabase.rpc("free_table", {
    p_table_id: tableId,
  });

  if (!rpcErr) return;

  // 2. Direct fallback if RPC is not available or encounters RLS restriction
  if (activeSessionId) {
    await supabase
      .from("dining_sessions")
      .update({
        status: "closed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", activeSessionId);
  }

  const { error: tableErr } = await supabase
    .from("tables")
    .update({
      active_session_id: null,
      status: "free",
    })
    .eq("id", tableId);

  if (tableErr) throw tableErr;
}

/**
 * Ensures an active dining session exists for the given table.
 * Reuses existing non-closed session if present; creates a new 'browsing' session otherwise.
 */
export async function getOrCreateDiningSession(table: TableRow): Promise<string> {
  // Best-effort cleanup of expired browsing sessions before loading table data
  try {
    const { error: rpcErr } = await supabase.rpc("cleanup_expired_browsing_sessions");
    if (rpcErr) {
      console.warn("[getOrCreateDiningSession] Best-effort browsing session cleanup warning:", rpcErr.message);
    }
  } catch (e) {
    console.warn("[getOrCreateDiningSession] Best-effort browsing session cleanup skipped:", e);
  }

  let activeSessionId = table.active_session_id;
  let isSessionValid = false;

  if (activeSessionId) {
    const { data: sessionData, error: sCheckErr } = await supabase
      .from("dining_sessions")
      .select("id, status")
      .eq("id", activeSessionId)
      .maybeSingle();

    if (!sCheckErr && sessionData && sessionData.status !== "closed") {
      isSessionValid = true;
    }
  }

  if (!isSessionValid) {
    // Create a new dining session with 'browsing' status
    const { data: session, error: sErr } = await supabase
      .from("dining_sessions")
      .insert({ table_id: table.id, status: "browsing" })
      .select("id")
      .single();
    if (sErr) throw sErr;

    activeSessionId = session.id;

    // Update the table with the active session ID
    const { error: uErr } = await supabase
      .from("tables")
      .update({
        active_session_id: activeSessionId,
        status: "free",
      })
      .eq("id", table.id);

    if (uErr) {
      // Safely handle expected demo mode / RLS update restrictions
      const isPermissionOrDemoError =
        uErr.code === "42501" ||
        uErr.message?.toLowerCase().includes("permission") ||
        uErr.message?.toLowerCase().includes("row-level security") ||
        uErr.message?.toLowerCase().includes("demo");

      if (isPermissionOrDemoError) {
        console.warn(
          "[getOrCreateDiningSession] Table active_session_id update restricted (Demo/RLS):",
          uErr.message
        );
      } else {
        throw uErr;
      }
    }

    table.active_session_id = activeSessionId;
    table.status = "free";
  }

  return activeSessionId;
}
