import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";

/**
 * Shared service function to cancel an order in the database.
 * Both the active orders list and the order status view call this.
 */
export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_session_id: getSessionId(),
  });
  if (error) throw error;
}
