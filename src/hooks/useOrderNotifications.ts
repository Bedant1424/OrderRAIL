import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { supabase, type Order } from "@/lib/db";

/**
 * Global, session-scoped realtime subscription for order status changes.
 * Mounted once above the customer route Outlet so the "order ready" popup
 * fires no matter which page the customer is currently on.
 *
 * NOTE: We intentionally do NOT use a server-side filter on dining_session_id
 * here. Supabase postgres_changes column filters require REPLICA IDENTITY FULL
 * on the table — without it the WAL only exposes the primary key and the
 * server silently drops filtered events before they reach the client. Instead
 * we subscribe to all order UPDATEs on the table and match by session in JS.
 */
export function useOrderNotifications({
  tableId,
  sessionId,
}: {
  tableId: string;
  sessionId: string | null;
}) {
  const navigate = useNavigate();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`order-notifications-${sessionId}`)
      .on(
        "postgres_changes",
        // No server-side filter — we match by session in the callback below.
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as Order;
          console.log("[useOrderNotifications callback] Received order update:", order.id, "status:", order.status, "session:", order.dining_session_id);
          console.log("[useOrderNotifications callback] Is local toast === window.__toast?", toast === (window as any).__toast);
          // Only handle orders belonging to this dining session.
          if (order.dining_session_id !== sessionId) {
            console.log("[useOrderNotifications callback] Ignored order (session mismatch):", order.dining_session_id, "expected:", sessionId);
            return;
          }
          if (order.status === "ready" && !notifiedRef.current.has(order.id)) {
            console.log("[useOrderNotifications callback] Order is ready! Displaying toast for", order.id);
            notifiedRef.current.add(order.id);
            toast.success("Your order is ready! 🎉", {
              description: `Order #${order.id.slice(0, 8).toUpperCase()}`,
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
