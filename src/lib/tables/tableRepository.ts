import { supabase, type TableRow, type ServiceRequest } from "@/lib/db";
import { sortTablesNatural } from "./naturalTableSort";

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
  return sortTablesNatural((data ?? []) as TableRow[]);
}

export async function markTableFreeInDb(tableId: string, activeSessionId?: string | null): Promise<void> {
  // 1. Cancel ONLY active, in-flight orders (pending, preparing, ready) so DB permits session release.
  // NEVER cancel served, completed, or already cancelled historical orders.
  try {
    if (activeSessionId) {
      const { data: sessionOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("dining_session_id", activeSessionId)
        .in("status", ["pending", "preparing", "ready"]);

      if (sessionOrders && sessionOrders.length > 0) {
        for (const o of sessionOrders) {
          await supabase.from("orders").update({ status: "cancelled", last_updated_by: "staff" }).eq("id", o.id);
        }
      }
    } else if (tableId) {
      const { data: activeOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("table_id", tableId)
        .in("status", ["pending", "preparing", "ready"]);

      if (activeOrders && activeOrders.length > 0) {
        for (const o of activeOrders) {
          await supabase.from("orders").update({ status: "cancelled", last_updated_by: "staff" }).eq("id", o.id);
        }
      }
    }
  } catch (e) {
    console.warn("[markTableFreeInDb] Order status update warning:", e);
  }

  // 2. Direct database table update to set table status = free and clear active session ID
  const { error: tableErr } = await supabase
    .from("tables")
    .update({
      active_session_id: null,
      status: "free",
    })
    .eq("id", tableId);

  if (tableErr) {
    console.warn("[markTableFreeInDb] Direct table status update warning:", tableErr.message);
    throw new Error(`Failed to set table free: ${tableErr.message}`);
  }

  // 3. Try Supabase Postgres RPC 'free_table' (best-effort)
  try {
    const { error: rpcErr } = await supabase.rpc("free_table", {
      p_table_id: tableId,
    });
    if (!rpcErr) return;
  } catch (e) {
    console.warn("[markTableFreeInDb] RPC free_table warning:", e);
  }

  // 4. Close associated dining sessions
  try {
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
  } catch (e) {
    console.warn("[markTableFreeInDb] Dining session closure warning:", e);
  }
}

export interface StaleSessionDiagnostic {
  tablesWithClosedActiveSession: { tableId: string; label: string; activeSessionId: string }[];
  occupiedTablesNoActiveOrders: { tableId: string; label: string }[];
  closedSessionsReferencedByTable: { sessionId: string; tableId: string }[];
  activeOrdersInClosedSession: { orderId: string; diningSessionId: string; status: string }[];
}

/**
 * Read-only diagnostic helper to inspect existing database state for stale/mismatched session records.
 * Does NOT modify or mutate any database data.
 */
export async function diagnoseStaleSessions(cafeId: string): Promise<StaleSessionDiagnostic> {
  const result: StaleSessionDiagnostic = {
    tablesWithClosedActiveSession: [],
    occupiedTablesNoActiveOrders: [],
    closedSessionsReferencedByTable: [],
    activeOrdersInClosedSession: [],
  };

  try {
    const { data: dbTables } = await supabase
      .from("tables")
      .select("id, label, status, active_session_id")
      .eq("cafe_id", cafeId);

    if (!dbTables) return result;

    const activeSessionIds = dbTables.map((t) => t.active_session_id).filter(Boolean) as string[];

    if (activeSessionIds.length > 0) {
      const { data: closedSess } = await supabase
        .from("dining_sessions")
        .select("id, table_id, status")
        .in("id", activeSessionIds)
        .eq("status", "closed");

      if (closedSess && closedSess.length > 0) {
        const closedSet = new Set(closedSess.map((s) => s.id));
        for (const t of dbTables) {
          if (t.active_session_id && closedSet.has(t.active_session_id)) {
            result.tablesWithClosedActiveSession.push({
              tableId: t.id,
              label: t.label,
              activeSessionId: t.active_session_id,
            });
            result.closedSessionsReferencedByTable.push({
              sessionId: t.active_session_id,
              tableId: t.id,
            });
          }
        }
      }
    }

    const occupiedTableIds = dbTables.filter((t) => t.status === "occupied").map((t) => t.id);
    if (occupiedTableIds.length > 0) {
      const { data: activeOrds } = await supabase
        .from("orders")
        .select("table_id")
        .in("table_id", occupiedTableIds)
        .in("status", ["pending", "preparing", "ready"]);

      const tablesWithOrders = new Set((activeOrds ?? []).map((o) => o.table_id));
      for (const t of dbTables) {
        if (t.status === "occupied" && !tablesWithOrders.has(t.id)) {
          result.occupiedTablesNoActiveOrders.push({ tableId: t.id, label: t.label });
        }
      }
    }

    const { data: orphanOrds } = await supabase
      .from("orders")
      .select("id, dining_session_id, status")
      .eq("cafe_id", cafeId)
      .in("status", ["pending", "preparing", "ready"])
      .not("dining_session_id", "is", null);

    if (orphanOrds && orphanOrds.length > 0) {
      const sessIds = Array.from(new Set(orphanOrds.map((o) => o.dining_session_id!)));
      const { data: closedSessions } = await supabase
        .from("dining_sessions")
        .select("id")
        .in("id", sessIds)
        .eq("status", "closed");

      const closedSessSet = new Set((closedSessions ?? []).map((s) => s.id));
      for (const o of orphanOrds) {
        if (o.dining_session_id && closedSessSet.has(o.dining_session_id)) {
          result.activeOrdersInClosedSession.push({
            orderId: o.id,
            diningSessionId: o.dining_session_id,
            status: o.status,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[diagnoseStaleSessions] Read-only diagnostic notice:", err);
  }

  return result;
}

/**
 * Retrieves the currently active dining session for a table if one exists.
 * Returns null if the table is inactive (no active non-closed dining session).
 */
export async function getActiveDiningSession(table: TableRow): Promise<{ id: string; status: string } | null> {
  let activeSessionId = table.active_session_id;

  if (activeSessionId && !activeSessionId.startsWith("session-")) {
    const { data: sData } = await supabase
      .from("dining_sessions")
      .select("id, status")
      .eq("id", activeSessionId)
      .maybeSingle();

    if (sData && sData.status !== "closed") {
      // ONLY promote table to occupied if the dining session is actually active (has orders).
      // Browsing sessions must leave table.status === "free".
      if (table.status === "free" && sData.status === "active") {
        await supabase
          .from("tables")
          .update({ status: "occupied", active_session_id: sData.id })
          .eq("id", table.id);
      }
      return sData;
    }
  }

  const { data: existingSession } = await supabase
    .from("dining_sessions")
    .select("id, status")
    .eq("table_id", table.id)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSession) {
    if (existingSession.status === "active" && (table.status === "free" || table.active_session_id !== existingSession.id)) {
      await supabase
        .from("tables")
        .update({ status: "occupied", active_session_id: existingSession.id })
        .eq("id", table.id);
    }
    return existingSession;
  }

  return null;
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

  // 1. Primary Path: Consume Atomic PostgreSQL RPC with advisory lock
  const isUuid = (val?: string | null): boolean =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  if (isUuid(table.id) && isUuid(table.cafe_id)) {
    try {
      const { data, error } = await supabase.rpc("get_or_create_table_session", {
        p_table_id: table.id,
        p_cafe_id: table.cafe_id,
      });

      if (!error && data && (data as any).id) {
        return (data as any).id;
      }
    } catch (err: any) {
      console.warn("[getOrCreateDiningSession] RPC get_or_create_table_session notice (fallback to direct read):", err?.message || err);
    }
  }

  // 2. Compatibility / Mock / Offline Fallback
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

export function toCanonicalDbTableStatus(status: string): TableRow["status"] {
  switch (status.toLowerCase()) {
    case "cleaning":
    case "cleaning_required":
      return "cleaning_required";
    case "available":
    case "free":
      return "free";
    case "out_of_service":
      return "out_of_service";
    case "occupied":
    case "bill_requested":
    case "reserved":
      return "occupied";
    default:
      return status as TableRow["status"];
  }
}

export async function updateTableStatusInDb(
  tableId: string,
  status: TableRow["status"],
  activeSessionId: string | null = null
): Promise<void> {
  const dbStatus = toCanonicalDbTableStatus(status);

  const { error } = await supabase
    .from("tables")
    .update({
      status: dbStatus,
      active_session_id: activeSessionId,
    })
    .eq("id", tableId);

  if (error) throw error;
}

export const createDiningSession = createDiningSessionInDb;
export const closeDiningSession = closeDiningSessionInDb;
export const updateTableStatus = updateTableStatusInDb;

