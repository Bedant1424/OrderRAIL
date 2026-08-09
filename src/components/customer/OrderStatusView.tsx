import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, useOutletContext } from "react-router-dom";
import { Check, ChefHat, Clock, Coffee, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase, formatMoney, formatOrderLabel, type Order, type OrderItem, type OrderStatus, type Cafe } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { getStoredGuestSessionId } from "@/lib/guestSession";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { cancelOrder } from "@/lib/orders";
import { ReviewForm } from "./ReviewForm";
import { useCart } from "@/lib/cart";
import { useCustomerNavigate } from "@/hooks/useCustomerBack";
import { MenuImage } from "./MenuImage";

const STEPS: { key: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pending", label: "Received", icon: Clock },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: Sparkles },
  { key: "served", label: "Served", icon: Check },
];

export function OrderStatusView({ cafe }: { cafe: Cafe }) {
  const { orderId, tableId } = useParams();
  const navigate = useNavigate();
  const customerNavigate = useCustomerNavigate();
  const outletContext = useOutletContext<{ guestSessionId?: string | null }>() || {};
  const guestSessionId = outletContext.guestSessionId || (tableId ? getStoredGuestSessionId(tableId) : null);

  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<(OrderItem & { menu_items?: { image_url: string | null } | null })[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  const { startEditing } = useCart();

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const load = async () => {
      const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!cancelled && o) setOrder(o as Order);
      const { data: it } = await supabase
        .from("order_items")
        .select("*, menu_items(image_url)")
        .eq("order_id", orderId);
      if (!cancelled && it) setItems(it as any);
    };
    void load();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, (payload) => {
        setOrder(payload.new as Order);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    if (order?.status === "served" && searchParams.get("scrollTo") === "review") {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [order?.status, searchParams]);

  if (!order) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center text-cc-text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cc-primary/20 border-t-cc-primary" />
          <p className="text-xs font-semibold">Loading your order details…</p>
        </div>
      </div>
    );
  }

  const isOwner = !order.guest_session_id || (guestSessionId && order.guest_session_id === guestSessionId) || order.session_id === getSessionId();
  const currentIdx = Math.max(0, STEPS.findIndex((s) => s.key === order.status));

  const getStatusSubtitle = (status: string) => {
    switch (status) {
      case "pending":
        return "Thanks! Your order has been sent to the kitchen.";
      case "preparing":
        return "Our kitchen is freshly preparing your meal.";
      case "ready":
        return "Your order is ready to be served!";
      case "served":
        return "Served! Enjoy your meal ☕";
      case "cancelled":
        return "This order was cancelled.";
      default:
        return "Tracking your order progress.";
    }
  };

  const handleStartEdit = () => {
    if (!order || !isOwner) return;
    const cartLines = items.map((i) => ({
      item: {
        id: i.menu_item_id || "",
        name: i.name,
        price_cents: i.price_cents,
        image_url: i.menu_items?.image_url || null,
      },
      qty: i.qty,
    }));
    startEditing(order.id, order.version, cartLines, order.note);
    toast.success("Order loaded in basket for editing.");
    customerNavigate(`/t/${tableId}/cart`);
  };

  const handleCancel = async () => {
    if (!order || !isOwner) return;
    setCancelling(true);
    try {
      await cancelOrder(order.id, guestSessionId);
      setOrder({ ...order, status: "cancelled" });
      toast.success("Order cancelled");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not cancel order. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="pb-28">
      {/* Header Banner */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-black text-cc-text tracking-tight">Order Status</h1>
          <span className="inline-block rounded-full bg-cc-surface border border-cc-border px-3 py-1 text-xs font-black text-cc-text shadow-xs">
            {order.order_number || (order as any).daily_order_number
              ? formatOrderLabel(order.order_number || (order as any).daily_order_number)
              : "Order pending…"}
          </span>
        </div>
        <p className="mt-1 text-xs text-cc-text-muted font-medium leading-relaxed">
          {getStatusSubtitle(order.status)}
        </p>
      </div>

      {/* Status Stepper Progress */}
      {order.status === "cancelled" ? (
        <div className="mx-4 mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          This order was cancelled. Please speak to a staff member.
        </div>
      ) : (
        <ol className="mx-4 mt-4 space-y-2.5">
          {STEPS.map((step, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            const Icon = step.icon;
            return (
              <motion.li
                key={step.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "flex items-center gap-3.5 rounded-2xl border p-3.5 transition-all shadow-xs",
                  active
                    ? "border-cc-primary bg-cc-primary/10 text-cc-text font-bold"
                    : done
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-cc-border bg-cc-surface text-cc-text-muted",
                )}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold transition-all shadow-xs",
                    active
                      ? "bg-cc-primary text-white animate-pulse"
                      : done
                      ? "bg-emerald-600 text-white"
                      : "bg-cc-surface-soft text-cc-text-muted border border-cc-border",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className="font-display text-sm">{step.label}</span>
              </motion.li>
            );
          })}
        </ol>
      )}

      {/* Order Items Summary Card */}
      <section className="mx-4 mt-5 rounded-2xl bg-cc-surface p-4 shadow-xs border border-cc-border">
        <h2 className="mb-3 font-display text-base font-bold text-cc-text">Ordered Items</h2>
        <ul className="divide-y divide-cc-border">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
              <MenuImage src={i.menu_items?.image_url} alt={i.name} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="break-anywhere font-display text-xs font-bold text-cc-text">{i.name}</p>
                <p className="text-[11px] text-cc-text-muted font-semibold">Qty: {i.qty}</p>
              </div>
              <span className="shrink-0 font-sans tabular-nums text-xs font-extrabold text-cc-text">
                {formatMoney(i.price_cents * i.qty, cafe.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-cc-border pt-3 text-sm">
          <span className="text-[10px] font-bold text-cc-text-muted uppercase tracking-wider">Total</span>
          <span className="font-sans text-lg font-black text-cc-text tabular-nums">
            {formatMoney(order.total_cents, cafe.currency)}
          </span>
        </div>
        {order.note && (
          <p className="break-anywhere mt-3 rounded-xl bg-cc-surface-soft p-2.5 text-xs text-cc-text-muted border border-cc-border">
            <span className="font-bold text-cc-text">Note:</span> {order.note}
          </p>
        )}
      </section>

      {/* Order Modification Actions */}
      {order.status === "pending" && isOwner && (
        <div className="mx-4 mt-4 space-y-2">
          <button
            onClick={handleStartEdit}
            className="w-full rounded-full bg-cc-primary hover:bg-cc-primary-hover py-3.5 text-sm font-bold text-white shadow-md active:scale-[0.99] transition min-h-[48px]"
          >
            Edit Order
          </button>
          <button
            onClick={() => void handleCancel()}
            disabled={cancelling}
            className="w-full rounded-full border border-rose-300 px-6 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition disabled:opacity-60"
          >
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        </div>
      )}

      {/* Review Form on Served */}
      {order.status === "served" && (
        <div ref={reviewRef} className="mt-4">
          <ReviewForm
            cafe={cafe}
            orderId={order.id}
            onComplete={() => customerNavigate(`/t/${tableId}/cart`)}
          />
        </div>
      )}

      {/* Navigation Return Button */}
      <div className="mt-5 px-4">
        <button
          onClick={() => customerNavigate(`/t/${tableId}`)}
          className="w-full rounded-full bg-cc-surface border border-cc-border px-6 py-3 text-xs font-bold text-cc-text hover:bg-cc-surface/80 transition shadow-xs"
        >
          Back to menu
        </button>
      </div>
    </div>
  );
}
