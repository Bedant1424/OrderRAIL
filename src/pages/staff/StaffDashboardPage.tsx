import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, ChefHat, Clock, HandPlatter, Sparkles, X, Utensils, Droplet, Receipt, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
  supabase,
  formatMoney,
  type Cafe,
  type Order,
  type OrderItem,
  type OrderStatus,
  type ServiceRequest,
  type TableRow,
} from "@/lib/db";
import { cn } from "@/lib/utils";

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
  served: null,
  cancelled: null,
};
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "Start preparing",
  preparing: "Mark ready",
  ready: "Mark served",
};

const SR_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  water: { label: "Needs water", icon: Droplet },
  waiter: { label: "Call waiter", icon: HandPlatter },
  bill: { label: "Requests bill", icon: Receipt },
  help: { label: "Needs help", icon: HelpCircle },
};

import { useCafe } from "@/lib/cafe";

type OrderWithItems = Order & { order_items: OrderItem[]; tables: { label: string } | null };

export default function StaffDashboardPage() {
  const qc = useQueryClient();
  const { cafe, cafeId } = useCafe();

  const ordersQ = useQuery({
    queryKey: ["staff-orders", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), tables(label)")
        .eq("cafe_id", cafeId!)
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as unknown as OrderWithItems[];
    },
  });

  const srQ = useQuery({
    queryKey: ["staff-sr", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*, tables(label)")
        .eq("cafe_id", cafeId!)
        .in("status", ["open", "acknowledged"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (ServiceRequest & { tables: { label: string } | null })[];
    },
  });

  const tablesQ = useQuery({
    queryKey: ["staff-tables", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data } = await supabase.from("tables").select("*").eq("cafe_id", cafeId!).order("label");
      return ((data ?? []) as TableRow[]).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    },
  });

  // Realtime: refresh orders + service requests on any change for this cafe.
  useEffect(() => {
    if (!cafeId) return;
    const channel = supabase
      .channel(`staff-${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        void qc.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests", filter: `cafe_id=eq.${cafeId}` },
        (payload) => {
          void qc.invalidateQueries({ queryKey: ["staff-sr", cafeId] });
          if (payload.eventType === "INSERT") {
            const t = (payload.new as ServiceRequest).type;
            toast(`New request: ${SR_META[t]?.label ?? t}`);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cafeId, qc]);

  const grouped = useMemo(() => {
    const orders = ordersQ.data ?? [];
    return {
      incoming: orders.filter((o) => o.status === "pending"),
      active: orders.filter((o) => o.status === "preparing" || o.status === "ready"),
      done: orders.filter((o) => o.status === "served" || o.status === "cancelled").slice(0, 20),
    };
  }, [ordersQ.data]);

  const advance = async (o: OrderWithItems) => {
    const next = NEXT_STATUS[o.status];
    if (!next) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", o.id);
    if (error) toast.error(error.message);
  };

  const cancel = async (o: OrderWithItems) => {
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    if (error) toast.error(error.message);
  };

  const resolveSR = async (id: string) => {
    const { error } = await supabase.from("service_requests").update({ status: "resolved" }).eq("id", id);
    if (error) toast.error(error.message);
  };
  const ackSR = async (id: string) => {
    const { error } = await supabase.from("service_requests").update({ status: "acknowledged" }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const currency = cafe?.currency ?? "USD";
  const openSRTables = new Set((srQ.data ?? []).map((s) => s.table_id));
  const activeOrderTables = new Set(
    (ordersQ.data ?? [])
      .filter((o) => o.status !== "served" && o.status !== "cancelled" && o.table_id)
      .map((o) => o.table_id as string),
  );

  return (
    <div className="space-y-8">
      {/* Top stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Incoming" value={grouped.incoming.length} icon={Clock} tone="warning" />
        <StatCard label="In kitchen" value={grouped.active.length} icon={ChefHat} tone="accent" />
        <StatCard label="Open requests" value={srQ.data?.length ?? 0} icon={Bell} tone="destructive" />
        <StatCard label="Tables busy" value={activeOrderTables.size} icon={Utensils} tone="muted" />
      </section>

      {/* Service requests strip */}
      {(srQ.data?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Service requests</h2>
          <div className="flex snap-x gap-3 overflow-x-auto pb-1">
            <AnimatePresence initial={false}>
              {srQ.data!.map((s) => {
                const meta = SR_META[s.type] ?? { label: s.type, icon: Bell };
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "min-w-[220px] snap-start rounded-2xl border p-4 shadow-soft",
                      s.status === "open"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-accent/40 bg-accent/5",
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4" /> {meta.label}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Table {s.tables?.label ?? "?"} · {new Date(s.created_at).toLocaleTimeString()}
                    </div>
                    {s.note && <p className="mt-2 text-xs">{s.note}</p>}
                    <div className="mt-3 flex gap-2">
                      {s.status === "open" && (
                        <button
                          onClick={() => void ackSR(s.id)}
                          className="rounded-full bg-secondary px-3 py-1 text-xs font-medium"
                        >
                          Ack
                        </button>
                      )}
                      <button
                        onClick={() => void resolveSR(s.id)}
                        className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                      >
                        Resolve
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Orders kanban */}
      <section className="grid gap-4 lg:grid-cols-3">
        <OrderColumn
          title="Incoming"
          accent="warning"
          orders={grouped.incoming}
          currency={currency}
          onAdvance={advance}
          onCancel={cancel}
          emptyLabel="No new orders."
        />
        <OrderColumn
          title="In progress"
          accent="accent"
          orders={grouped.active}
          currency={currency}
          onAdvance={advance}
          onCancel={cancel}
          emptyLabel="Nothing in the kitchen right now."
        />
        <OrderColumn
          title="Recently done"
          accent="success"
          orders={grouped.done}
          currency={currency}
          onAdvance={advance}
          emptyLabel="No completed orders yet."
        />
      </section>

      {/* Tables grid */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Tables</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {(tablesQ.data ?? []).map((t) => {
            const hasSR = openSRTables.has(t.id);
            const hasOrder = activeOrderTables.has(t.id);
            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-2xl border p-3 text-center shadow-soft",
                  hasSR
                    ? "border-destructive/40 bg-destructive/5"
                    : hasOrder
                    ? "border-accent/40 bg-accent/5"
                    : "border-border bg-card",
                )}
              >
                <div className="font-display text-lg font-semibold">{t.label}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {hasSR ? "Needs staff" : hasOrder ? "Ordering" : "Free"}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "warning" | "accent" | "destructive" | "muted";
}) {
  const toneMap = {
    warning: "bg-warning/15 text-foreground",
    accent: "bg-accent/15 text-foreground",
    destructive: "bg-destructive/15 text-foreground",
    muted: "bg-secondary text-foreground",
  } as const;
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function OrderColumn({
  title,
  accent,
  orders,
  currency,
  onAdvance,
  onCancel,
  emptyLabel,
}: {
  title: string;
  accent: "warning" | "accent" | "success";
  orders: OrderWithItems[];
  currency: string;
  onAdvance: (o: OrderWithItems) => void;
  onCancel?: (o: OrderWithItems) => void;
  emptyLabel: string;
}) {
  const dot = { warning: "bg-warning", accent: "bg-accent", success: "bg-success" }[accent];
  return (
    <div className="flex flex-col rounded-3xl bg-muted/40 p-3 ring-1 ring-border/50">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <h3 className="font-display text-base font-semibold">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{orders.length}</span>
      </div>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {orders.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </p>
          )}
          {orders.map((o) => (
            <motion.article
              key={o.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-sm font-semibold">
                    Table {o.tables?.label ?? "?"} · #{o.id.slice(0, 6).toUpperCase()}
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {new Date(o.created_at).toLocaleTimeString()} ·{" "}
                    <StatusBadge status={o.status} />
                  </div>
                </div>
                <div className="text-right font-display text-base font-semibold tabular-nums">
                  {formatMoney(o.total_cents, currency)}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {o.order_items?.map((it) => (
                  <li key={it.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="font-medium tabular-nums">{it.qty}×</span> {it.name}
                    </span>
                    {it.note && <span className="text-xs text-muted-foreground">{it.note}</span>}
                  </li>
                ))}
              </ul>
              {o.note && (
                <p className="mt-2 rounded-xl bg-muted/60 p-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Note:</span> {o.note}
                </p>
              )}
              {(NEXT_STATUS[o.status] || onCancel) && (
                <div className="mt-3 flex gap-2">
                  {NEXT_STATUS[o.status] && (
                    <button
                      onClick={() => onAdvance(o)}
                      className="flex-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft"
                    >
                      {NEXT_LABEL[o.status]}
                    </button>
                  )}
                  {onCancel && o.status !== "served" && o.status !== "cancelled" && (
                    <button
                      onClick={() => onCancel(o)}
                      className="rounded-full bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-destructive/15 hover:text-destructive"
                      aria-label="Cancel order"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
    pending: { label: "Pending", icon: Clock, className: "text-warning" },
    preparing: { label: "Preparing", icon: ChefHat, className: "text-accent" },
    ready: { label: "Ready", icon: Sparkles, className: "text-accent" },
    served: { label: "Served", icon: Check, className: "text-success" },
    cancelled: { label: "Cancelled", icon: X, className: "text-destructive" },
  };
  const m = map[status];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", m.className)}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}
