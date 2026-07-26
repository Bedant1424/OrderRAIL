import { cancelOrderInDb } from "@/lib/orders/repository";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";

/**
 * Shared service function to cancel an order in the database.
 * Both the active orders list and the order status view call this.
 */
export async function cancelOrder(orderId: string, guestSessionId?: string | null): Promise<void> {
  try {
    await cancelOrderInDb(orderId, "customer", guestSessionId);
  } catch (err: any) {
    if (err?.status === 403 || err?.message?.includes("403")) {
      throw err;
    }
    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: orderId,
      p_session_id: getSessionId(),
    });
    if (error) throw error;
  }
}

