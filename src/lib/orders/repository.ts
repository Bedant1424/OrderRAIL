import { supabase, type Order, type OrderItem } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { validateGuestSession, touchGuestSession } from "@/lib/guestSession";
import { OrderService } from "./orderService";

const inMemoryOrders = new Map<string, { guest_session_id?: string | null; dining_session_id?: string | null; session_id?: string | null }>();

/**
 * Shared Order Repository
 * Authoritative data access layer for all OrderRail applications
 * (Owner Console, Staff KDS Dashboard, Counter POS).
 */

export type OrderWithItems = Order & {
  order_items: OrderItem[];
  tables?: { label: string } | null;
  isOwner?: boolean;
};

export type OrderWithOwnership = OrderWithItems & {
  isOwner: boolean;
};

export interface EditOrderItemPayload {
  id?: string;
  menu_item_id?: string | null;
  name: string;
  price_cents: number;
  qty: number;
  note?: string | null;
}

export async function fetchCafeOrders(cafeId: string, sinceDate?: string | null, untilDate?: string | null): Promise<OrderWithItems[]> {
  let query = supabase
    .from("orders")
    .select("*, order_items(*), tables(label)")
    .eq("cafe_id", cafeId)
    .order("created_at", { ascending: false });

  if (sinceDate) {
    query = query.gte("created_at", sinceDate);
  }
  if (untilDate) {
    query = query.lte("created_at", untilDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as OrderWithItems[];
}

import { assertCapability } from "@/lib/permissions";

export async function updateOrderStatusInDb(
  orderId: string,
  nextStatus: Order["status"],
  updatedBy: "customer" | "staff" | "owner" | "counter" = "staff",
  actorRole?: any
): Promise<void> {
  if (updatedBy !== "customer" && actorRole) {
    assertCapability(actorRole, "UPDATE_ORDER_STATUS", "Update Order Status");
  }
  const { error } = await supabase
    .from("orders")
    .update({
      status: nextStatus,
      last_updated_by: updatedBy,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (error) {
    const isPermissionOrDemoError =
      error.code === "42501" ||
      error.message?.toLowerCase().includes("permission") ||
      error.message?.toLowerCase().includes("row-level security") ||
      error.message?.toLowerCase().includes("demo");

    if (isPermissionOrDemoError) {
      console.warn("[updateOrderStatusInDb] Order status update restricted (RLS/Demo):", error.message);
      return;
    }
    throw error;
  }
}

export async function editOrderInDb(params: {
  orderId: string;
  items: EditOrderItemPayload[];
  notes?: string | null;
  updatedBy?: "customer" | "staff" | "owner";
  guestSessionId?: string | null;
}): Promise<void> {
  const { orderId, items, notes, updatedBy = "staff", guestSessionId } = params;

  if (updatedBy === "customer") {
    let currentOrder: any = null;
    try {
      const { data } = await supabase
        .from("orders")
        .select("guest_session_id, dining_session_id, session_id")
        .eq("id", orderId)
        .maybeSingle();
      currentOrder = data;
    } catch (e) {}

    if (!currentOrder || !currentOrder.dining_session_id) {
      const mem = inMemoryOrders.get(orderId);
      if (mem) {
        currentOrder = {
          guest_session_id: mem.guest_session_id,
          dining_session_id: mem.dining_session_id,
          session_id: mem.session_id,
        };
      }
    }

    if (currentOrder) {
      const ownerId = currentOrder.guest_session_id || currentOrder.session_id;
      if (ownerId && guestSessionId && ownerId !== guestSessionId) {
        const err = new Error("403 Forbidden: Guests may only edit their own orders");
        (err as any).status = 403;
        throw err;
      }
      if (guestSessionId && currentOrder.dining_session_id) {
        const val = await validateGuestSession(guestSessionId, currentOrder.dining_session_id);
        if (!val.valid) {
          const err = new Error(`403 Forbidden: ${val.reason || "Invalid Guest Session"}`);
          (err as any).status = 403;
          throw err;
        }
        void touchGuestSession(guestSessionId);
      }
    }
  }

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
  updatedBy: "customer" | "staff" | "owner" = "staff",
  guestSessionId?: string | null
): Promise<void> {
  if (updatedBy === "customer") {
    let currentOrder: any = null;
    try {
      const { data } = await supabase
        .from("orders")
        .select("guest_session_id, dining_session_id, session_id")
        .eq("id", orderId)
        .maybeSingle();
      currentOrder = data;
    } catch (e) {}

    if (!currentOrder || !currentOrder.dining_session_id) {
      const mem = inMemoryOrders.get(orderId);
      if (mem) {
        currentOrder = {
          guest_session_id: mem.guest_session_id,
          dining_session_id: mem.dining_session_id,
          session_id: mem.session_id,
        };
      }
    }

    if (currentOrder) {
      const ownerId = currentOrder.guest_session_id || currentOrder.session_id;
      if (ownerId && guestSessionId && ownerId !== guestSessionId) {
        const err = new Error("403 Forbidden: Guests may only cancel their own orders");
        (err as any).status = 403;
        throw err;
      }
      if (guestSessionId && currentOrder.dining_session_id) {
        const val = await validateGuestSession(guestSessionId, currentOrder.dining_session_id);
        if (!val.valid) {
          const err = new Error(`403 Forbidden: ${val.reason || "Invalid Guest Session"}`);
          (err as any).status = 403;
          throw err;
        }
        void touchGuestSession(guestSessionId);
      }
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      last_updated_by: updatedBy,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (error) {
    if (error.code === "42501" || error.message?.includes("permission") || error.message?.includes("row-level security") || error.message?.includes("demo")) {
      console.warn("[cancelOrderInDb] Order cancel restricted (RLS/Demo mode notice):", error.message);
      return;
    }
    throw error;
  }
}

export interface CreateOrderPayload {
  id?: string;
  cafe_id: string;
  table_id: string;
  session_id?: string | null;
  dining_session_id?: string | null;
  guest_session_id?: string | null;
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

// Validate UUID string
const isUuid = (val?: string | null): boolean =>
  !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export async function createOrderInDb(payload: CreateOrderPayload): Promise<string> {
  const orderId = payload.id || crypto.randomUUID();
  
  // Normalize status for DB check constraints
  let initialStatus = (payload.status || "pending").toString().toLowerCase();
  if (initialStatus === "kot_sent") {
    initialStatus = "preparing";
  }

  // Resolve table ID (null for express mode)
  const targetTableId = payload.table_id && payload.table_id !== 'express' && payload.table_id !== '' ? payload.table_id : null;

  let cleanCafeId = payload.cafe_id && payload.cafe_id !== '' ? payload.cafe_id : null;
  if (!cleanCafeId && targetTableId) {
    const { data: tRow } = await supabase.from("tables").select("cafe_id").eq("id", targetTableId).maybeSingle();
    if (tRow?.cafe_id) cleanCafeId = tRow.cafe_id;
  }
  if (!cleanCafeId) {
    cleanCafeId = "8c418a5a-7cd4-4054-8a88-f412c1762f7d";
  }

  let diningSessionId = payload.dining_session_id || null;

  // Resolve or create active dining session for table if dining_session_id is missing or dummy
  if ((!diningSessionId || diningSessionId.startsWith("session-")) && targetTableId) {
    const { data: activeSess } = await supabase
      .from("dining_sessions")
      .select("id")
      .eq("table_id", targetTableId)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSess) {
      diningSessionId = activeSess.id;
    } else {
      const { data: newSess } = await supabase
        .from("dining_sessions")
        .insert({ table_id: targetTableId, status: "browsing" })
        .select("id")
        .maybeSingle();
      if (newSess) {
        diningSessionId = newSess.id;
      }
    }
  }

  // Validate guest session if provided
  if (payload.guest_session_id && diningSessionId) {
    const val = await validateGuestSession(payload.guest_session_id, diningSessionId);
    if (!val.valid) {
      const err = new Error(`403 Forbidden: ${val.reason || "Invalid Guest Session"}`);
      (err as any).status = 403;
      throw err;
    }
    void touchGuestSession(payload.guest_session_id);
  }

  inMemoryOrders.set(orderId, {
    guest_session_id: payload.guest_session_id || payload.session_id || null,
    dining_session_id: diningSessionId,
    session_id: payload.session_id || payload.guest_session_id || getSessionId(),
  });

  if (import.meta.env.DEV) {
    console.log("[ORDER CREATION] Creating order in DB:", {
      orderId,
      tableId: targetTableId,
      sessionId: payload.session_id,
      diningSessionId,
      guestSessionId: payload.guest_session_id,
    });
  }

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();

  if (!existingOrder) {
    const insertObj: any = {
      id: orderId,
      cafe_id: cleanCafeId,
      table_id: targetTableId,
      session_id: payload.session_id || payload.guest_session_id || getSessionId(),
      dining_session_id: diningSessionId,
      guest_session_id: payload.guest_session_id || null,
      total_cents: payload.total_cents,
      note: payload.note ?? null,
      status: initialStatus,
    };

    let { error: orderErr } = await supabase.from("orders").insert(insertObj);

    if (orderErr && (orderErr.code === "PGRST204" || orderErr.message?.includes("guest_session_id") || orderErr.message?.includes("schema cache"))) {
      delete insertObj.guest_session_id;
      const retry = await supabase.from("orders").insert(insertObj);
      orderErr = retry.error;
    }

    if (orderErr && orderErr.code !== "23505") {
      console.error("[createOrderInDb orders INSERT ERROR]", {
        code: orderErr.code,
        message: orderErr.message,
        details: orderErr.details,
        hint: orderErr.hint,
        payload: insertObj,
      });
      throw orderErr;
    }
  }

  const { data: existingItems } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", orderId);

  if (!existingItems || existingItems.length === 0) {
    const itemsPayload = payload.items.map((i) => ({
      order_id: orderId,
      menu_item_id: isUuid(i.menu_item_id) ? i.menu_item_id : null,
      name: i.name,
      price_cents: i.price_cents,
      qty: i.qty,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);

    if (itemsErr) {
      console.error("[createOrderInDb order_items INSERT ERROR]", {
        code: itemsErr.code,
        message: itemsErr.message,
        details: itemsErr.details,
        hint: itemsErr.hint,
        itemsPayload,
      });
      throw itemsErr;
    }
  }

  // Immediate SELECT verification
  const { data: verifiedOrder, error: selectErr } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();

  if (selectErr) {
    console.error("[createOrderInDb SELECT VERIFICATION ERROR]", {
      code: selectErr.code,
      message: selectErr.message,
      details: selectErr.details,
      hint: selectErr.hint,
      orderId,
    });
  } else if (!verifiedOrder) {
    console.warn("[createOrderInDb SELECT VERIFICATION MISSING]", { orderId });
  } else {
    console.log("[createOrderInDb SELECT VERIFICATION SUCCESSFUL]", {
      id: verifiedOrder.id,
      order_number: verifiedOrder.order_number,
      status: verifiedOrder.status,
      itemsCount: verifiedOrder.order_items?.length || 0,
    });
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
  localOrderIds: string[] = [],
  currentGuestSessionId?: string | null
): Promise<OrderWithOwnership[]> {
  const combinedMap = new Map<string, OrderWithItems>();

  // Resolve active non-closed session ID for the table
  let activeSessionId = diningSessionId || null;

  if (!activeSessionId && tableId) {
    const { data: tableData } = await supabase
      .from("tables")
      .select("active_session_id")
      .eq("id", tableId)
      .maybeSingle();

    if (tableData?.active_session_id) {
      activeSessionId = tableData.active_session_id;
    } else {
      const { data: sessData } = await supabase
        .from("dining_sessions")
        .select("id")
        .eq("table_id", tableId)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sessData) {
        activeSessionId = sessData.id;
      }
    }
  }

  // If no active dining session exists for table, return [] (closed sessions must not appear)
  if (!activeSessionId) {
    return [];
  }

  // Verify that activeSessionId itself is not closed in DB (unless explicitly passed by caller)
  if (!diningSessionId) {
    const { data: activeSessData } = await supabase
      .from("dining_sessions")
      .select("status")
      .eq("id", activeSessionId)
      .maybeSingle();

    if (activeSessData && activeSessData.status === "closed") {
      return [];
    }
  }

  // 1. Fetch by dining_session_id if valid
  let sessCount = 0;
  if (activeSessionId) {
    const { data: sessOrders, error: err1 } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("dining_session_id", activeSessionId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (err1) console.warn("[fetchCustomerOrders Query 1 Warning]", err1.message);
    if (sessOrders) {
      sessCount = sessOrders.length;
      for (const o of sessOrders as unknown as OrderWithItems[]) {
        combinedMap.set(o.id, o);
      }
    }
  }

  // 2. Fetch by local sessionStorage order IDs restricted to activeSessionId
  let localCount = 0;
  if (localOrderIds.length > 0) {
    const { data: localOrders, error: err2 } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("id", localOrderIds)
      .eq("dining_session_id", activeSessionId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (err2) console.warn("[fetchCustomerOrders Query 2 Warning]", err2.message);
    if (localOrders) {
      localCount = localOrders.length;
      for (const o of localOrders as unknown as OrderWithItems[]) {
        combinedMap.set(o.id, o);
      }
    }
  }

  // 3. Fetch active orders for this table restricted to activeSessionId
  let tableCount = 0;
  if (tableId) {
    const { data: tableOrders, error: err3 } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("table_id", tableId)
      .eq("dining_session_id", activeSessionId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (err3) console.warn("[fetchCustomerOrders Query 3 Warning]", err3.message);
    if (tableOrders) {
      tableCount = tableOrders.length;
      for (const o of tableOrders as unknown as OrderWithItems[]) {
        combinedMap.set(o.id, o);
      }
    }
  }

  // 4. Fetch by browser session_id restricted to activeSessionId
  const browserSessionId = getSessionId();
  let sessionCount = 0;
  if (browserSessionId) {
    const { data: browserOrders, error: err4 } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("session_id", browserSessionId)
      .eq("dining_session_id", activeSessionId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (err4) console.warn("[fetchCustomerOrders Query 4 Warning]", err4.message);
    if (browserOrders) {
      sessionCount = browserOrders.length;
      for (const o of browserOrders as unknown as OrderWithItems[]) {
        combinedMap.set(o.id, o);
      }
    }
  }

  // Merge pending offline orders from OrderService
  try {
    const offlineOrders = await OrderService.getQueuedOfflineOrders();
    for (const off of offlineOrders) {
      const isTableMatch = off.table_id === tableId;
      const isSessMatch = activeSessionId && off.dining_session_id === activeSessionId;
      if ((isTableMatch || isSessMatch) && off.status !== "cancelled") {
        // Canonical PostgreSQL order takes precedence once created; do not overwrite with optimistic offline object
        if (combinedMap.has(off.id)) {
          continue;
        }
        combinedMap.set(off.id, {
          id: off.id,
          cafe_id: off.cafe_id,
          table_id: off.table_id,
          dining_session_id: off.dining_session_id || activeSessionId || undefined,
          guest_session_id: off.guest_session_id || undefined,
          session_id: off.session_id || undefined,
          total_cents: off.total_cents,
          note: off.note || undefined,
          status: off.status,
          created_at: off.created_at,
          order_items: off.items.map((it) => ({
            id: it.id || it.menu_item_id || `item-${Date.now()}`,
            order_id: off.id,
            menu_item_id: it.menu_item_id || "",
            name: it.name,
            price_cents: it.price_cents,
            qty: it.qty,
            created_at: off.created_at,
          })),
        } as any);
      }
    }
  } catch (errOff) {
    console.warn("[fetchCustomerOrders] Offline order merge warning:", errOff);
  }

  // Filter out any order that does not match activeSessionId
  const result = Array.from(combinedMap.values()).filter(
    (o) => !activeSessionId || !o.dining_session_id || o.dining_session_id === activeSessionId
  );

  if (import.meta.env.DEV) {
    console.log("[Instrumentation Output - fetchCustomerOrders]:", {
      "1. dining_session query count": sessCount,
      "2. local order ID query count": localCount,
      "3. table_id query count": tableCount,
      "4. session_id query count": sessionCount,
      "Merged total count": result.length,
      "Order IDs": result.map((o) => o.id),
    });
  }

  return result
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .map((o) => {
      let isOwner = true;
      if (currentGuestSessionId) {
        if (o.guest_session_id) {
          isOwner = o.guest_session_id === currentGuestSessionId;
        } else {
          isOwner = o.session_id === currentGuestSessionId || o.session_id === getSessionId();
        }
      }
      return {
        ...o,
        isOwner,
      };
    });
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

export { OrderService } from "./orderService";
export { BillingService, billsMap } from "../billing/billingService";
export { PaymentService, settlementsMap, type PaymentMethod } from "../payments/paymentService";


