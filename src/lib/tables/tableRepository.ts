import { supabase, type TableRow } from "@/lib/db";

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
