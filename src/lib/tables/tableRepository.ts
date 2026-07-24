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
        closed_at: new Date().toISOString(),
      })
      .eq("id", activeSessionId);
  }

  await supabase
    .from("dining_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("table_id", tableId)
    .neq("status", "closed");

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

  // Step 1: Validate existing table.active_session_id
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

  // Step 2: If active_session_id is missing or closed, search for any existing non-closed session for this table
  if (!isSessionValid) {
    const { data: existingSession, error: eCheckErr } = await supabase
      .from("dining_sessions")
      .select("id, status")
      .eq("table_id", table.id)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!eCheckErr && existingSession) {
      activeSessionId = existingSession.id;
      isSessionValid = true;
    }
  }

  // Step 3: Check if active orders exist for this table with a valid dining session
  if (!isSessionValid) {
    const { data: activeOrder, error: oCheckErr } = await supabase
      .from("orders")
      .select("dining_session_id")
      .eq("table_id", table.id)
      .in("status", ["pending", "preparing", "ready"])
      .not("dining_session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!oCheckErr && activeOrder?.dining_session_id) {
      const { data: orderSession } = await supabase
        .from("dining_sessions")
        .select("id, status")
        .eq("id", activeOrder.dining_session_id)
        .maybeSingle();

      if (orderSession && orderSession.status !== "closed") {
        activeSessionId = orderSession.id;
        isSessionValid = true;
      }
    }
  }

  // Step 4: Create a new session ONLY if no non-closed session or active orders exist
  if (!isSessionValid) {
    try {
      const { data: session, error: sErr } = await supabase
        .from("dining_sessions")
        .insert({ table_id: table.id, status: "browsing" })
        .select("id")
        .single();
      if (sErr) throw sErr;
      activeSessionId = session.id;
    } catch (err: any) {
      console.warn("[getOrCreateDiningSession] Dining session creation warning (RLS/Demo):", err?.message || err);
      activeSessionId = activeSessionId || `session-${table.id}`;
    }
  }

  // Step 5: Synchronize table's active_session_id without forcing status = "occupied"
  const { error: uErr } = await supabase
    .from("tables")
    .update({
      active_session_id: activeSessionId,
    })
    .eq("id", table.id);

  if (uErr) {
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

  return activeSessionId;
}

export async function createDiningSessionInDb(tableId: string, cafeId?: string): Promise<string> {
  const { data: session, error } = await supabase
    .from("dining_sessions")
    .insert({ table_id: tableId, status: "active" })
    .select("id")
    .single();

  if (error) throw error;

  await supabase
    .from("tables")
    .update({
      active_session_id: session.id,
      status: "occupied",
    })
    .eq("id", tableId);

  return session.id;
}

export async function closeDiningSessionInDb(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("dining_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function updateTableStatusInDb(
  tableId: string,
  status: TableRow["status"],
  activeSessionId: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from("tables")
    .update({
      status,
      active_session_id: activeSessionId,
    })
    .eq("id", tableId);

  if (error) throw error;
}

export const createDiningSession = createDiningSessionInDb;
export const closeDiningSession = closeDiningSessionInDb;
export const updateTableStatus = updateTableStatusInDb;

