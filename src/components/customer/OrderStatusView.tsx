import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChefHat, Clock, Coffee, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase, formatMoney, type Order, type OrderItem, type OrderStatus, type Cafe } from "@/lib/db";
import { cn } from "@/lib/utils";
import { ReviewForm } from "./ReviewForm";

const STEPS: { key: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pending", label: "Received", icon: Clock },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: Sparkles },
  { key: "served", label: "Served", icon: Check },
];

export function OrderStatusView({ cafe }: { cafe: Cafe }) {
  const { orderId, tableId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const load = async () => {
      const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!cancelled && o) setOrder(o as Order);
      const { data: it } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      if (!cancelled && it) setItems(it as OrderItem[]);
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

  if (!order) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <Coffee className="mx-auto mb-3 h-8 w-8 animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Loading your order…</p>
          <p className="mt-1 text-xs text-muted-foreground">
            If you're offline, it'll appear once you reconnect.
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = Math.max(0, STEPS.findIndex((s) => s.key === order.status));

  return (
    <div className="pb-32">
      <div className="px-4 pt-4">
        <h1 className="font-display text-3xl font-semibold">Order status</h1>
        <p className="mt-1 text-sm text-muted-foreground">Order #{order.id.slice(0, 8).toUpperCase()}</p>
      </div>

      {order.status === "cancelled" ? (
        <div className="mx-4 mt-6 rounded-3xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
          This order was cancelled. Please speak to a staff member.
        </div>
      ) : (
        <ol className="mx-4 mt-6 space-y-3">
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
                  "flex items-center gap-4 rounded-2xl border p-4 transition-colors",
                  active
                    ? "border-accent bg-accent/10"
                    : done
                    ? "border-success/40 bg-success/5"
                    : "border-border bg-card",
                )}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full",
                    active
                      ? "bg-gradient-accent text-accent-foreground animate-pulse-ring"
                      : done
                      ? "bg-success text-success-foreground"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-medium">{step.label}</span>
              </motion.li>
            );
          })}
        </ol>
      )}

      <section className="mx-4 mt-8 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h2 className="mb-3 font-display text-lg font-semibold">Items</h2>
        <ul className="divide-y divide-border/60">
          {items.map((i) => (
            <li key={i.id} className="flex items-baseline justify-between gap-2 py-2 text-sm">
              <span className="break-anywhere flex-1">
                <span className="font-medium">{i.qty}×</span> {i.name}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatMoney(i.price_cents * i.qty, cafe.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(order.total_cents, cafe.currency)}</span>
        </div>
        {order.note && (
          <p className="break-anywhere mt-3 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Note:</span> {order.note}
          </p>
        )}
      </section>

      {order.status === "served" && (
        <ReviewForm
          cafe={cafe}
          orderId={order.id}
          onComplete={() => navigate(`/t/${tableId}/cart`)}
        />
      )}

      <div className="mt-6 px-4">
        <button
          onClick={() => navigate(`/t/${tableId}`)}
          className="w-full rounded-full bg-secondary px-6 py-3 text-sm font-medium text-secondary-foreground"
        >
          Back to menu
        </button>
      </div>
    </div>
  );
}
