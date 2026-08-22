import { useEffect, useRef } from "react";
import { useCustomerNavigate } from "@/hooks/useCustomerBack";
import { toast } from "@/components/ui/sonner";
import { supabase, formatOrderLabel, type Order } from "@/lib/db";

/**
 * Global, session-scoped realtime subscription for order status changes.
 * Mounted once above the customer route Outlet so the "order ready" popup
 * fires no matter which page the customer is currently on.
 *
 * Scoped server-side via Supabase Realtime postgres_changes filter to the
 * active dining_session_id. REPLICA IDENTITY FULL on public.orders ensures
 * reliable event delivery across table/session transitions.
 */
export function useOrderNotifications({
  tableId,
  sessionId,
}: {
  tableId: string;
  sessionId: string | null;
}) {
  const navigate = useCustomerNavigate();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`order-notifications-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `dining_session_id=eq.${sessionId}`,
        },
        (payload) => {
          const order = payload.new as Order;
          console.log("[useOrderNotifications callback] Received order update:", order.id, "status:", order.status, "session:", order.dining_session_id);
          console.log("[useOrderNotifications callback] Is local toast === window.__toast?", toast === (window as any).__toast);
          // Defense in depth: safeguard check for dining session match
          if (order.dining_session_id !== sessionId) {
            console.log("[useOrderNotifications callback] Ignored order (session mismatch):", order.dining_session_id, "expected:", sessionId);
            return;
          }
          if (order.status === "ready" && !notifiedRef.current.has(order.id)) {
            console.log("[useOrderNotifications callback] Order is ready! Displaying toast for", order.id);
            notifiedRef.current.add(order.id);
            toast.success("Your order is ready! 🎉", {
              description: formatOrderLabel((order as any).daily_order_number ?? order.order_number),
              duration: 10000,
              action: {
                label: "View order",
                onClick: () => navigate(`/t/${tableId}/order/${order.id}`),
              },
            });
          } else {
            console.log("[useOrderNotifications callback] Toast not shown. Status:", order.status, "Already notified:", notifiedRef.current.has(order.id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[useOrderNotifications] Realtime subscribed for session", sessionId);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[useOrderNotifications] Realtime subscription error:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, tableId, navigate]);
}
