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
type TableWithSession = TableRow & { dining_sessions: { status: string } | null };

export default function StaffDashboardPage() {
  const qc = useQueryClient();
  const { cafe, cafeId } = useCafe();
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);

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
      // Clean up expired browsing sessions before loading table list
      await supabase.rpc("cleanup_expired_browsing_sessions");

      const { data } = await supabase
        .from("tables")
        .select("*, dining_sessions:active_session_id(*)")
        .eq("cafe_id", cafeId!)
        .order("label");
      
      const sorted = ((data ?? []) as any[]).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
      return sorted as TableWithSession[];
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables", filter: `cafe_id=eq.${cafeId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["staff-tables", cafeId] });
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

  const handleMarkTableFree = async (table: TableRow) => {
    try {
      const { error: rpcErr } = await supabase.rpc("free_table", {
        p_table_id: table.id,
      });

      if (rpcErr) throw rpcErr;

      toast.success(`Table ${table.label} marked Free`);
      void tablesQ.refetch();
      setSelectedTable(null);
    } catch (e: any) {
      console.error(e);
      const friendlyMsg = e.message?.includes("active orders")
        ? "This table still has active orders."
        : "Could not free table. Please try again.";
      toast.error(friendlyMsg);
    }
  };

  const currency = cafe?.currency ?? "USD";
  const openSRTables = new Set((srQ.data ?? []).map((s) => s.table_id));
  const occupiedTablesCount = (tablesQ.data ?? []).filter((t) => (t as any).dining_sessions?.status === "active").length;

  return (
    <div className="space-y-8">
      {/* Top stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Incoming" value={grouped.incoming.length} icon={Clock} tone="warning" />
        <StatCard label="In kitchen" value={grouped.active.length} icon={ChefHat} tone="accent" />
        <StatCard label="Open requests" value={srQ.data?.length ?? 0} icon={Bell} tone="destructive" />
        <StatCard label="Tables busy" value={occupiedTablesCount} icon={Utensils} tone="muted" />
      </section>

      {/* Service Requests — horizontal scroll strip.
           The page-level overflow root cause was <main> in OwnerLayout
           lacking min-width:0 as a grid item (confirmed via DevTools:
           htmlScrollW=1684 vs clientW=1019 WITHOUT min-width:0;
           htmlScrollW=clientW=1034 WITH min-width:0).
           The SR strip itself is correct: overflow-x:auto scrolls internally
           once its grid-item parent is properly constrained. */}
      {(srQ.data?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Service requests</h2>
          {/* no-scrollbar hides the native scrollbar; the strip is still
              scrollable via mouse-wheel, touch-swipe and trackpad.
              scroll-snap-type x mandatory + snap-start on cards gives
              the snapping behaviour. */}
          <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
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
                      "min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-2xl border p-4 shadow-soft",
                      s.status === "open"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-accent/40 bg-accent/5",
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4 shrink-0" /> {meta.label}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Table {s.tables?.label ?? "?"} · {new Date(s.created_at).toLocaleTimeString()}
                    </div>
                    {s.note && <p className="break-anywhere mt-2 text-xs">{s.note}</p>}
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

      {/* Orders kanban — CSS Grid, each column min-width:0 to respect track width */}
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
            const isOccupied = t.dining_sessions?.status === "active";
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTable(t)}
                className={cn(
                  "rounded-2xl border p-3 text-center shadow-soft cursor-pointer hover:border-primary/50 transition",
                  isOccupied
                    ? "border-accent/40 bg-accent/5"
                    : "border-border bg-card",
                )}
              >
                <div className="font-display text-lg font-semibold">{t.label}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {isOccupied ? "Occupied" : "Free"}
                </div>
              </div>
            );
          })}
        </div>

        <AnimatePresence>
          {selectedTable && (() => {
            const activeOrdersCount = (ordersQ.data ?? []).filter((o) =>
              o.dining_session_id === selectedTable.active_session_id &&
              (o.status === "pending" || o.status === "preparing" || o.status === "ready")
            ).length;
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-float"
                >
                  <h3 className="font-display text-xl font-bold">Table {selectedTable.label}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Current status: <span className="font-semibold text-foreground capitalize">{(selectedTable as any).dining_sessions?.status === "active" ? "Occupied" : "Free"}</span>
                  </p>
                  
                  <div className="mt-6 flex flex-col gap-2">
                    {(selectedTable as any).dining_sessions?.status === "active" ? (
                      <>
                        <button
                          disabled={activeOrdersCount > 0}
                          onClick={() => void handleMarkTableFree(selectedTable)}
                          className="w-full rounded-full bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Mark Table Free
                        </button>
                        {activeOrdersCount > 0 && (
                          <p className="mt-1 text-center text-xs text-destructive font-medium leading-normal">
                            {activeOrdersCount === 1 ? "1 active order remaining." : `${activeOrdersCount} active orders remaining.`} Complete all active orders before freeing this table.
                          </p>
                        )}
                      </>
                    ) : (
                      <button
                        disabled
                        className="w-full rounded-full bg-secondary py-2.5 text-sm font-semibold text-muted-foreground opacity-50 cursor-not-allowed"
                      >
                        Table is already Free
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTable(null)}
                      className="w-full rounded-full bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>
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
    /*
     * kanban-col  → min-width: 0  (must-have so CSS Grid track constrains the column)
     * flex-col    → header stays fixed, card list scrolls
     * No max-h on wrapper → empty columns use natural height (min-height on scroll area)
     */
    <div className="kanban-col flex flex-col rounded-3xl bg-muted/40 p-3 ring-1 ring-border/50">
      {/* Column header — never scrolls */}
      <div className="mb-3 flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <h3 className="font-display text-base font-semibold">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{orders.length}</span>
      </div>

      {/*
       * Card list:
       *   - kanban-scroll     → thin custom scrollbar, overflow-y:auto, overflow-x:hidden
       *   - max-h-[520px]     → caps the scrolling area height (not the whole column)
       *   - min-h-[80px]      → empty columns show a sensible height instead of collapsing
       * This is the ONLY element that scrolls vertically; horizontal scroll is impossible.
       */}
      <div className="kanban-scroll max-h-[520px] min-h-[80px] space-y-3 pr-1 py-1">
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
              /*
               * w-full          → card always fills 100% of column width
               * min-w-0         → redundant safety in case article is flex child somewhere
               * No overflow:hidden — clipping is never the answer
               */
              className="w-full min-w-0 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60"
            >
              {/* Order header row */}
              <div className="flex items-start justify-between gap-2">
                {/*
                 * min-w-0 lets the left side shrink so the price on the right
                 * never pushes content outside the card.
                 */}
                <div className="min-w-0">
                  <div className="break-anywhere font-display text-sm font-semibold">
                    Table {o.tables?.label ?? "?"} · #{o.id.slice(0, 6).toUpperCase()}
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {new Date(o.created_at).toLocaleTimeString()} ·{" "}
                    <StatusBadge status={o.status} />
                  </div>
                </div>
                <div className="shrink-0 text-right font-display text-base font-semibold tabular-nums">
                  {formatMoney(o.total_cents, currency)}
                </div>
              </div>

              {/* Order items list — no per-item notes, names wrap */}
              <ul className="mt-3 space-y-1 text-sm">
                {o.order_items?.map((it) => (
                  <li key={it.id} className="flex items-baseline gap-2">
                    <span className="break-anywhere flex-1">
                      <span className="font-medium tabular-nums">{it.qty}×</span> {it.name}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Order-level note — long notes wrap, never overflow */}
              {o.note && (
                <p className="break-anywhere mt-2 rounded-xl bg-muted/60 p-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Note:</span> {o.note}
                </p>
              )}

              {/* Action buttons */}
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
