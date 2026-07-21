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

export async function updateOrderStatusInDb(orderId: string, nextStatus: Order["status"]): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      status: nextStatus,
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

  // 1. Fetch current order & items
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

  // 5. Fetch current version to increment
  const { data: orderData } = await supabase
    .from("orders")
    .select("version")
    .eq("id", orderId)
    .single();

  const currentVersion = orderData?.version ?? 1;

  // 6. Update main order row
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

export async function cancelOrderInDb(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (error) throw error;
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
