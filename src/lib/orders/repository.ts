import { supabase, type Order, type OrderItem } from "@/lib/db";

/**
 * Shared Order Repository
 * Authoritative data access layer for all OrderRail applications
 * (Owner Console, Staff KDS Dashboard, Counter POS).
 */

export type OrderWithItems = Order & {
  order_items: OrderItem[];
  tables?: { label: string } | null;
};

export interface EditOrderItemPayload {
  id?: string;
  menu_item_id?: string | null;
  name: string;
  price_cents: number;
  qty: number;
  note?: string | null;
}

export async function fetchCafeOrders(cafeId: string, sinceDate?: string | null): Promise<OrderWithItems[]> {
  let query = supabase
    .from("orders")
    .select("*, order_items(*), tables(label)")
    .eq("cafe_id", cafeId)
    .order("created_at", { ascending: false });

  if (sinceDate) {
    query = query.gte("created_at", sinceDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as OrderWithItems[];
}

export async function updateOrderStatusInDb(
  orderId: string,
  nextStatus: Order["status"],
  updatedBy: "customer" | "staff" | "owner" = "staff"
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      status: nextStatus,
      last_updated_by: updatedBy,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (error) throw error;
}

export async function editOrderInDb(params: {
  orderId: string;
  items: EditOrderItemPayload[];
  notes?: string | null;
  updatedBy?: "customer" | "staff" | "owner";
}): Promise<void> {
  const { orderId, items, notes, updatedBy = "staff" } = params;

  // 1. Fetch current order items
  const { data: existingItems, error: fetchErr } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", orderId);

  if (fetchErr) throw fetchErr;

  const existingIds = new Set((existingItems ?? []).map((it) => it.id));
  const payloadIds = new Set(items.filter((it) => it.id).map((it) => it.id!));

  // 2. Determine items to delete
  const toDelete = Array.from(existingIds).filter((id) => !payloadIds.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("order_items")
      .delete()
      .in("id", toDelete);
    if (delErr) throw delErr;
  }

  // 3. Upsert items
  for (const it of items) {
    if (it.id && existingIds.has(it.id)) {
      const { error: upErr } = await supabase
        .from("order_items")
        .update({
          qty: it.qty,
          note: it.note ?? null,
          price_cents: it.price_cents,
        })
        .eq("id", it.id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await supabase
        .from("order_items")
        .insert({
          order_id: orderId,
          menu_item_id: it.menu_item_id ?? null,
          name: it.name,
          price_cents: it.price_cents,
          qty: it.qty,
          note: it.note ?? null,
        });
      if (insErr) throw insErr;
    }
  }

  // 4. Recalculate order total
  const newTotalCents = items.reduce((sum, it) => sum + it.price_cents * it.qty, 0);

  // 5. Fetch current version
  const { data: orderData } = await supabase
    .from("orders")
    .select("version")
    .eq("id", orderId)
    .single();

  const currentVersion = orderData?.version ?? 1;

  // 6. Update order row
  const { error: orderUpdateErr } = await supabase
    .from("orders")
    .update({
      total_cents: newTotalCents,
      note: notes ?? null,
      version: currentVersion + 1,
      last_updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (orderUpdateErr) throw orderUpdateErr;
}

export async function cancelOrderInDb(
  orderId: string,
  updatedBy: "customer" | "staff" | "owner" = "staff"
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      last_updated_by: updatedBy,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (error) throw error;
}

export interface CreateOrderPayload {
  id?: string;
  cafe_id: string;
  table_id: string;
  session_id?: string | null;
  dining_session_id?: string | null;
  note?: string | null;
  total_cents: number;
  status?: Order["status"];
  items: {
    menu_item_id?: string | null;
    name: string;
    price_cents: number;
    qty: number;
  }[];
}

export async function createOrderInDb(payload: CreateOrderPayload): Promise<string> {
  const orderId = payload.id || crypto.randomUUID();
  const initialStatus = payload.status || "pending";

  let diningSessionId = payload.dining_session_id || null;

  // Resolve or create active dining session for table if dining_session_id is missing or invalid dummy
  if ((!diningSessionId || diningSessionId.startsWith("session-")) && payload.table_id) {
    const { data: activeSess } = await supabase
      .from("dining_sessions")
      .select("id")
      .eq("table_id", payload.table_id)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSess) {
      diningSessionId = activeSess.id;
    } else {
      const { data: newSess } = await supabase
        .from("dining_sessions")
        .insert({ table_id: payload.table_id, status: "active" })
        .select("id")
        .maybeSingle();
      if (newSess) {
        diningSessionId = newSess.id;
      }
    }
  }

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();

  if (!existingOrder) {
    const { error: orderErr } = await supabase.from("orders").insert({
      id: orderId,
      cafe_id: payload.cafe_id,
      table_id: payload.table_id,
      session_id: payload.session_id || null,
      dining_session_id: diningSessionId,
      total_cents: payload.total_cents,
      note: payload.note ?? null,
      status: initialStatus,
    });
    if (orderErr && orderErr.code !== "23505") throw orderErr;
  }

  const { data: existingItems } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", orderId);

  if (!existingItems || existingItems.length === 0) {
    const { error: itemsErr } = await supabase.from("order_items").insert(
      payload.items.map((i) => ({
        order_id: orderId,
        menu_item_id: i.menu_item_id || null,
        name: i.name,
        price_cents: i.price_cents,
        qty: i.qty,
      })),
    );
    if (itemsErr) throw itemsErr;
  }

  // Synchronize table occupancy and active_session_id
  if (diningSessionId && payload.table_id) {
    const { data: session } = await supabase
      .from("dining_sessions")
      .select("status")
      .eq("id", diningSessionId)
      .maybeSingle();

    if (session && session.status === "browsing") {
      await supabase
        .from("dining_sessions")
        .update({ status: "active" })
        .eq("id", diningSessionId);
    }

    const { error: tErr } = await supabase
      .from("tables")
      .update({
        active_session_id: diningSessionId,
        status: "occupied",
      })
      .eq("id", payload.table_id);

    if (tErr) {
      console.warn("[createOrderInDb] Table status update to occupied skipped (RLS/Demo):", tErr.message);
    }
  }

  return orderId;
}

export const createOrder = createOrderInDb;
export const updateOrderStatus = updateOrderStatusInDb;

export async function fetchOrdersByDiningSession(diningSessionId: string): Promise<OrderWithItems[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("dining_session_id", diningSessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as OrderWithItems[];
}

export async function fetchCustomerOrders(
  tableId: string,
  diningSessionId: string | null = null,
  localOrderIds: string[] = []
): Promise<OrderWithItems[]> {
  const combinedMap = new Map<string, OrderWithItems>();

  // 1. Fetch by dining_session_id if valid
  if (diningSessionId && !diningSessionId.startsWith("session-")) {
    const { data: sessOrders } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("dining_session_id", diningSessionId)
      .order("created_at", { ascending: false });

    if (sessOrders) {
      for (const o of sessOrders as unknown as OrderWithItems[]) {
        combinedMap.set(o.id, o);
      }
    }
  }

  // 2. Fetch by local sessionStorage order IDs (from addOrderToHistory)
  if (localOrderIds.length > 0) {
    const { data: localOrders } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("id", localOrderIds)
      .order("created_at", { ascending: false });

    if (localOrders) {
      for (const o of localOrders as unknown as OrderWithItems[]) {
        combinedMap.set(o.id, o);
      }
    }
  }

  // 3. Fetch active orders for this table
  if (tableId) {
    const { data: tableOrders } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("table_id", tableId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (tableOrders) {
      for (const o of tableOrders as unknown as OrderWithItems[]) {
        combinedMap.set(o.id, o);
      }
    }
  }

  // Sort descending by created_at
  return Array.from(combinedMap.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

export async function fetchActiveDiningSessionOrders(cafeId: string): Promise<{
  activeSessions: { id: string; table_id: string; status: string; created_at: string }[];
  orders: OrderWithItems[];
}> {
  // 1. Fetch table IDs for the cafe
  const { data: cafeTables } = await supabase
    .from("tables")
    .select("id")
    .eq("cafe_id", cafeId);

  const tableIds = (cafeTables ?? []).map((t) => t.id);

  // 2. Fetch active dining sessions for the cafe's tables where status != 'closed'
  let activeSessions: { id: string; table_id: string; status: string; created_at: string }[] = [];
  if (tableIds.length > 0) {
    const { data: sessions } = await supabase
      .from("dining_sessions")
      .select("id, table_id, status, created_at")
      .in("table_id", tableIds)
      .neq("status", "closed");

    if (sessions) {
      activeSessions = sessions;
    }
  } else {
    const { data: sessions } = await supabase
      .from("dining_sessions")
      .select("id, table_id, status, created_at")
      .neq("status", "closed");
    if (sessions) activeSessions = sessions;
  }

  const activeSessionIds = activeSessions.map((s) => s.id);

  // 3. Query ONLY orders belonging to active sessions (including pending, preparing, ready, served)
  let orders: OrderWithItems[] = [];
  if (activeSessionIds.length > 0) {
    const { data: ordData } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("cafe_id", cafeId)
      .in("dining_session_id", activeSessionIds)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true });

    if (ordData) orders = ordData as unknown as OrderWithItems[];
  }

  // 4. Also query express orders without a dining session that are active (not served & not cancelled)
  const { data: expressOrders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("cafe_id", cafeId)
    .is("dining_session_id", null)
    .neq("status", "cancelled")
    .neq("status", "served")
    .order("created_at", { ascending: true });

  const combinedMap = new Map<string, OrderWithItems>();
  for (const o of orders) {
    combinedMap.set(o.id, o);
  }
  if (expressOrders) {
    for (const o of expressOrders as unknown as OrderWithItems[]) {
      combinedMap.set(o.id, o);
    }
  }

  return {
    activeSessions,
    orders: Array.from(combinedMap.values()),
  };
}

export function subscribeToOrdersChannel(
  cafeId: string,
  onOrderChange: (payload: { eventType: string; new: Order; old: Partial<Order> }) => void
) {
  const channelName = `shared-orders-${cafeId}-${Math.random().toString(36).slice(2, 7)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` },
      (payload) => {
        onOrderChange({
          eventType: payload.eventType,
          new: payload.new as Order,
          old: payload.old as Partial<Order>
        });
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "order_items" },
      () => {
        onOrderChange({ eventType: "UPDATE", new: {} as Order, old: {} });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

