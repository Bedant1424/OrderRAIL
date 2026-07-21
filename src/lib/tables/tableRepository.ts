import { supabase, type TableRow, type ServiceRequest } from "@/lib/db";

export async function fetchCafeTables(cafeId: string): Promise<TableRow[]> {
  const { data, error } = await supabase
    .from("tables")
    .select("*, dining_sessions(*)")
    .eq("cafe_id", cafeId)
    .order("label", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TableRow[];
}

export async function fetchTableServiceRequests(tableId: string): Promise<ServiceRequest[]> {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("table_id", tableId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ServiceRequest[];
}

/**
 * Authoritative function to mark a table free in the database.
 * Closes the active dining session and clears active_session_id on tables.
 */
export async function markTableFreeInDb(tableId: string, activeSessionId?: string | null): Promise<void> {
  // 1. Try Postgres RPC free_table first
  try {
    const { error: rpcErr } = await supabase.rpc("free_table", { p_table_id: tableId });
    if (!rpcErr) return;
  } catch (e) {
    console.warn("free_table RPC fallback triggered:", e);
  }

  // 2. Direct database update fallback
  if (activeSessionId) {
    await supabase
      .from("dining_sessions")
      .update({ status: "closed", ended_at: new Date().toISOString() })
      .eq("id", activeSessionId);
  }

  const { error: tableErr } = await supabase
    .from("tables")
    .update({ status: "free", active_session_id: null })
    .eq("id", tableId);

  if (tableErr) throw tableErr;
}
