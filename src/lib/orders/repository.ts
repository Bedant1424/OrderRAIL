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
