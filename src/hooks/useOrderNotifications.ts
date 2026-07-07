import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase, type Order } from "@/lib/db";

/**
 * Global, session-scoped realtime subscription for order status changes.
 * Mounted once above the customer route Outlet so the "order ready" popup
 * fires no matter which page the customer is currently on.
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
        { event: "UPDATE", schema: "public", table: "orders", filter: `dining_session_id=eq.${sessionId}` },
        (payload) => {
          const order = payload.new as Order;
          if (order.status === "ready" && !notifiedRef.current.has(order.id)) {
            notifiedRef.current.add(order.id);
            toast.success("Your order is ready! 🎉", {
              description: `Order #${order.id.slice(0, 8).toUpperCase()}`,
              duration: 10000,
              action: {
                label: "View order",
                onClick: () => navigate(`/t/${tableId}/order/${order.id}`),
              },
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, tableId, navigate]);
}
