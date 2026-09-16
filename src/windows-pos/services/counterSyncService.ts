import { supabase } from "@/lib/db";
import { sortTablesNatural } from "@/lib/tables/naturalTableSort";
import { CounterCacheService } from "./counterCacheService";
import type { CounterTable, CounterOrder, CounterOrderItem } from "../types/counterTypes";

export interface LoadedCounterState {
  tables: CounterTable[];
  channelOrders: CounterOrder[];
  lastSyncedAt: Date;
  isFromCache?: boolean;
}

export async function loadActiveCounterState(cafeId: string): Promise<LoadedCounterState> {
  if (!cafeId) {
    return { tables: [], channelOrders: [], lastSyncedAt: new Date() };
  }

  try {
    // 1. Authoritative fetch of all tables for this cafe
    const { data: rawTables, error: tablesErr } = await supabase
      .from("tables")
      .select("id, cafe_id, label, status, active_session_id")
      .eq("cafe_id", cafeId);

    if (tablesErr) {
      console.error("[counterSyncService] Error fetching tables:", tablesErr);
      throw tablesErr;
    }

  const dbTables = rawTables ?? [];
  const tableIds = dbTables.map((t) => t.id);

  let activeSessions: any[] = [];
  let dbOrders: any[] = [];

  if (tableIds.length > 0) {
    // 2. Authoritative fetch of non-closed dining sessions for these tables
    const { data: rawSessions, error: sessionsErr } = await supabase
      .from("dining_sessions")
      .select("id, table_id, status, created_at")
      .in("table_id", tableIds)
      .neq("status", "closed");

    if (sessionsErr) {
      console.warn("[counterSyncService] Warning fetching dining sessions:", sessionsErr);
    }

    activeSessions = rawSessions ?? [];
    const activeSessionIds = activeSessions.map((s) => s.id);

    // 3. Authoritative fetch of active orders (and their order_items) for active sessions
    if (activeSessionIds.length > 0) {
      const { data: rawOrders, error: ordersErr } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("cafe_id", cafeId)
        .in("dining_session_id", activeSessionIds)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });

      if (ordersErr) {
        console.error("[counterSyncService] Error fetching orders:", ordersErr);
        throw ordersErr;
      }
      dbOrders = rawOrders ?? [];
    }

    // 4. Also fetch table-linked orders that might not yet have a dining_session_id attached
    const { data: unlinkedOrders } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("cafe_id", cafeId)
      .in("table_id", tableIds)
      .is("dining_session_id", null)
      .neq("status", "cancelled")
      .neq("status", "served")
      .neq("status", "paid")
      .order("created_at", { ascending: true });

    if (unlinkedOrders && unlinkedOrders.length > 0) {
      const existingIds = new Set(dbOrders.map((o) => o.id));
      for (const uo of unlinkedOrders) {
        if (!existingIds.has(uo.id)) {
          dbOrders.push(uo);
        }
      }
    }
  }

  // 5. Structure and assemble tables with natural alphanumeric ordering
  const sortedTables = sortTablesNatural(dbTables, (t) => t.label);

  const tables: CounterTable[] = sortedTables.map((tbl) => {
    // Match active session by active_session_id or table_id
    const matchedSession = activeSessions.find(
      (s) => s.id === tbl.active_session_id || s.table_id === tbl.id
    );

    const activeSessionId = matchedSession?.id || tbl.active_session_id || null;
    const sessionStartedAt = matchedSession?.created_at || null;

    // Filter orders belonging to this table
    const tableOrdersRaw = dbOrders.filter((ord) => {
      if (activeSessionId && ord.dining_session_id === activeSessionId) return true;
      if (ord.table_id === tbl.id) return true;
      return false;
    });

    const orders: CounterOrder[] = tableOrdersRaw.map((o: any) => {
      const items: CounterOrderItem[] = (o.order_items || []).map((item: any) => ({
        id: item.id,
        menuItemId: item.menu_item_id || null,
        name: item.name || "Item",
        priceCents: item.price_cents || 0,
        qty: item.qty || 1,
        note: item.note || null,
      }));

      return {
        id: o.id,
        orderNumber: o.daily_order_number ?? o.order_number ?? 1,
        tableId: o.table_id,
        diningSessionId: o.dining_session_id,
        status: o.status || "pending",
        orderSource: o.order_source || "DINE_IN",
        createdAt: o.created_at,
        totalCents: o.total_cents || 0,
        customerName: o.customer_name || null,
        customerPhone: o.customer_phone || null,
        externalOrderRef: o.external_order_ref || null,
        note: o.note || null,
        items,
      };
    });

    const isOccupied = !!activeSessionId || orders.length > 0;
    const unbilledTotalCents = orders
      .filter((ord) => ord.status !== "paid" && ord.status !== "cancelled")
      .reduce((sum, ord) => sum + ord.totalCents, 0);

    return {
      id: tbl.id,
      label: tbl.label,
      status: isOccupied ? "occupied" : tbl.status || "available",
      activeSessionId,
      sessionStartedAt,
      orders,
      unbilledTotalCents,
    };
  });

  // 6. Authoritative fetch of active non-table channel orders (TAKEAWAY, SWIGGY, ZOMATO)
  const { data: rawChannelOrders, error: channelOrdersErr } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("cafe_id", cafeId)
    .is("table_id", null)
    .neq("status", "cancelled")
    .neq("status", "served")
    .neq("status", "paid")
    .order("created_at", { ascending: true });

  if (channelOrdersErr) {
    console.warn("[counterSyncService] Warning fetching channel orders:", channelOrdersErr);
  }

  const channelOrders: CounterOrder[] = (rawChannelOrders || []).map((o: any) => {
    const items: CounterOrderItem[] = (o.order_items || []).map((item: any) => ({
      id: item.id,
      menuItemId: item.menu_item_id || null,
      name: item.name || "Item",
      priceCents: item.price_cents || 0,
      qty: item.qty || 1,
      note: item.note || null,
    }));

    return {
      id: o.id,
      orderNumber: o.daily_order_number ?? o.order_number ?? 1,
      tableId: null,
      diningSessionId: null,
      status: o.status || "pending",
      orderSource: o.order_source || "TAKEAWAY",
      createdAt: o.created_at,
      totalCents: o.total_cents || 0,
      customerName: o.customer_name || null,
      customerPhone: o.customer_phone || null,
      externalOrderRef: o.external_order_ref || null,
      note: o.note || null,
      items,
    };
  });

    const result: LoadedCounterState = {
      tables,
      channelOrders,
      lastSyncedAt: new Date(),
    };

    // Cache state locally upon confirmed successful fetch
    CounterCacheService.saveCounterStateCache(cafeId, result);

    return result;
  } catch (err: any) {
    console.warn("[counterSyncService] Network or DB error fetching active counter state. Checking local cache...", err?.message);
    const cached = CounterCacheService.loadCounterStateCache(cafeId);
    if (cached) {
      console.log("[counterSyncService] Returning cached counter state (Temporary Offline Mode).");
      return {
        ...cached,
        isFromCache: true,
      };
    }
    throw err;
  }
}
