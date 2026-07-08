import { useNavigate, useParams } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, History, ChevronRight, Star, PhoneCall, Receipt, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart";
import { supabase, formatMoney, formatOrderLabel, type Cafe, type TableRow, type Order, type OrderItem, type ServiceRequestType } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { generateUUID } from "@/lib/uuid";
import { cancelOrder } from "@/lib/orders";
import { submitOrder } from "@/lib/orderQueue";
import { addOrderToHistory, getOrderHistory } from "@/lib/orderHistory";
import { toast } from "sonner";
import { MenuImage } from "./MenuImage";
import { BOTTOM_NAV_HEIGHT, FLOATING_CART_GAP, STICKY_FOOTER_GAP, STICKY_FOOTER_HEIGHT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/config/app";
import { useServiceRequestCooldown } from "@/hooks/useServiceRequestCooldown";

export function CartView({ cafe, table }: { cafe: Cafe; table: TableRow }) {
  const { lines, setQty, remove, subtotalCents, clear, note, setNote, editingOrderId, editingOrderVersion, cancelEditing } = useCart();
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [callingType, setCallingType] = useState<ServiceRequestType | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const cooldown = useServiceRequestCooldown(APP_CONFIG.serviceRequestCooldownMs, APP_CONFIG.serviceRequestTimeoutMs);

  const ORDER_NOTE_MAX = 200;

  // History State
  const [historyOrders, setHistoryOrders] = useState<(Order & { order_items: OrderItem[] })[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = async () => {
    if (!table.active_session_id) return;
    setLoadingHistory(true);
    try {
      const { data: ords, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("dining_session_id", table.active_session_id)
        .eq("table_id", table.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (ords) {
        setHistoryOrders(ords as any);
      }
    } catch (err) {
      console.error("Error loading order history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Reset scroll to top when entering the Cart page so the customer
  // always sees the current cart / checkout section first.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [table.active_session_id]);

  // Keep order cards live (status/eta/items) even when this view isn't the focused page.
  useEffect(() => {
    if (!table.active_session_id) return;
    const channel = supabase
      .channel(`cart-orders-${table.active_session_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `dining_session_id=eq.${table.active_session_id}` },
        (payload) => {
          const updated = payload.new as Order;
          setHistoryOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table.active_session_id]);

  const placeOrder = async () => {
    if (!lines.length) return;
    setPlacing(true);
    try {
      const orderId = generateUUID();
      const { queued } = await submitOrder({
        id: orderId,
        cafe_id: cafe.id,
        table_id: table.id,
        session_id: getSessionId(),
        dining_session_id: table.active_session_id,
        note: note.trim() || null,
        total_cents: subtotalCents,
        items: lines.map((l) => ({
          menu_item_id: l.item.id,
          name: l.item.name,
          price_cents: l.item.price_cents,
          qty: l.qty,
        })),
      });

      addOrderToHistory(orderId);
      clear();
      
      if (queued) {
        toast.success("Order saved offline — it'll send when you're back online.");
      } else {
        toast.success("Order sent to the kitchen ☕");
      }
      navigate(`/t/${tableId}/order/${orderId}`);
    } catch (e) {
      console.error(e);
      toast.error("Could not place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  const updateExistingOrder = async () => {
    if (!lines.length || !editingOrderId) return;
    setPlacing(true);
    try {
      const { error } = await supabase.rpc("update_order", {
        p_order_id: editingOrderId,
        p_session_id: getSessionId(),
        p_expected_version: editingOrderVersion!,
        p_note: note.trim() || null,
        p_total_cents: subtotalCents,
        p_items: lines.map((l) => ({
          menu_item_id: l.item.id,
          name: l.item.name,
          price_cents: l.item.price_cents,
          qty: l.qty,
        })),
      });

      if (error) {
        throw error;
      }

      toast.success("Order updated successfully! ☕");
      const savedId = editingOrderId;
      clear();
      navigate(`/t/${tableId}/order/${savedId}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Could not update order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  const handleCallStaff = async (type: ServiceRequestType, label: string) => {
    if (!cooldown.canSend(type)) return;
    setCallingType(type);
    try {
      const { error } = await supabase.from("service_requests").insert({
        cafe_id: cafe.id,
        table_id: table.id,
        session_id: getSessionId(),
        type,
      });
      if (error) throw error;
      cooldown.markSent(type);
      toast.success(`${label} request sent to staff`);
    } catch (e) {
      console.error(e);
      toast.error("Could not contact staff. Please try again.");
    } finally {
      setCallingType(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setCancelingId(orderId);
    try {
      await cancelOrder(orderId);
      setHistoryOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o)),
      );
      toast.success("Order cancelled");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not cancel order. Please try again.");
    } finally {
      setCancelingId(null);
    }
  };

  // Sort historyOrders by created_at descending (latest first)
  const sortedHistory = [...historyOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Active orders contains all active orders (not served and not cancelled)
  const activeOrders = sortedHistory.filter((o) => o.status !== "served" && o.status !== "cancelled");

  // Previous orders contains all served and cancelled orders
  const previousOrders = sortedHistory.filter((o) => o.status === "served" || o.status === "cancelled");

  // Renders a single history order card
  const renderOrderCard = (o: Order & { order_items: OrderItem[] }) => {
    const isServed = o.status === "served";
    
    const getStatusDetails = (status: string) => {
      const s = status.toLowerCase();
      if (s === "pending" || s === "received") {
        return {
          label: "Received",
          colorClass: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200/50 dark:border-blue-900/30",
          icon: Clock
        };
      }
      if (s === "preparing") {
        return {
          label: "Preparing",
          colorClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200/50 dark:border-amber-900/30",
          icon: Sparkles
        };
      }
      if (s === "ready") {
        return {
          label: "Ready",
          colorClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/50 dark:border-emerald-900/30",
          icon: CheckCircle2
        };
      }
      if (s === "served") {
        return {
          label: "Served",
          colorClass: "text-muted-foreground bg-secondary/40 border-border/50",
          icon: History
        };
      }
      return {
        label: status.charAt(0).toUpperCase() + status.slice(1),
        colorClass: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200/50 dark:border-rose-900/30",
        icon: ChevronRight
      };
    };

    const details = getStatusDetails(o.status);
    const StatusIcon = details.icon;

    return (
      <div
        key={o.id}
        onClick={() => navigate(`/t/${tableId}/order/${o.id}`)}
        className="group flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 transition hover:ring-accent/40 cursor-pointer"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs font-semibold text-muted-foreground">
          <span>{formatOrderLabel(o.order_number)}</span>
          <span className="flex items-center gap-1.5">
            <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", details.colorClass)}>
              <StatusIcon className="h-3 w-3 shrink-0" />
              <span>{details.label}</span>
            </span>
            <ChevronRight className="h-3 w-3" />
          </span>
        </div>
        <div className="space-y-1 text-sm text-foreground">
          {o.order_items?.map((it) => (
            <div key={it.id} className="flex justify-between gap-2">
              <span className="break-anywhere flex-1">{it.qty}× {it.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{formatMoney(it.price_cents * it.qty, cafe.currency)}</span>
            </div>
          ))}
        </div>
        {o.note && (
          <p className="break-anywhere mt-2 rounded-xl bg-muted/50 p-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Note:</span> {o.note}
          </p>
        )}
        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
          <span>Total: <strong className="text-foreground text-sm tabular-nums">{formatMoney(o.total_cents, cafe.currency)}</strong></span>
          {isServed && (
            <span>
              Served at {new Date(o.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {o.status === "pending" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleCancelOrder(o.id);
            }}
            disabled={cancelingId === o.id}
            className="mt-1 w-full rounded-full border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
          >
            {cancelingId === o.id ? "Cancelling…" : "Cancel order"}
          </button>
        )}
      </div>
    );
  };

  const handleGiveReview = async () => {
    const servedOrders = sortedHistory.filter((o) => o.status === "served");
    if (!servedOrders.length) {
      toast.info("No orders to review yet.");
      return;
    }
    try {
      const { data: reviewed, error } = await supabase
        .from("reviews")
        .select("order_id")
        .in("order_id", servedOrders.map((o) => o.id));
      if (error) throw error;
      const reviewedIds = new Set((reviewed ?? []).map((r) => r.order_id));
      const target = servedOrders.find((o) => !reviewedIds.has(o.id));
      if (!target) {
        toast.info("You're all caught up — no orders left to review!");
        return;
      }
      navigate(`/t/${tableId}/order/${target.id}?scrollTo=review`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't check review status. Please try again.");
    }
  };

  const pagePaddingBottom = lines.length > 0
    ? `calc(${BOTTOM_NAV_HEIGHT} + ${FLOATING_CART_GAP} + ${STICKY_FOOTER_HEIGHT} + ${STICKY_FOOTER_GAP} + env(safe-area-inset-bottom))`
    : `calc(${BOTTOM_NAV_HEIGHT} + 1.5rem + env(safe-area-inset-bottom))`;

  // 1. EMPTY BASKET VIEW
  if (!lines.length) {
    return (
      <div style={{ paddingBottom: pagePaddingBottom }} className="px-4 pt-4 space-y-6">
        {/* If no active orders AND no previous orders exist, show empty state */}
        {activeOrders.length === 0 && previousOrders.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-secondary">
              <span aria-hidden className="text-3xl">🥐</span>
            </div>
            <h2 className="font-display text-2xl font-semibold">Your basket is empty</h2>
            <p className="mt-2 text-muted-foreground text-sm">Add something delicious from the menu.</p>
            <button
              onClick={() => navigate(`/t/${tableId}`)}
              className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft"
            >
              Browse menu
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-semibold">My Order</h1>
              <p className="mt-1 text-sm text-muted-foreground">Table {table.label} · {cafe.name}</p>
            </div>

            {/* Active Orders Section */}
            {activeOrders.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                  <ShoppingBag className="h-5 w-5 text-accent animate-pulse" /> Active Orders
                </h2>
                <div className="space-y-3">
                  {activeOrders.map(renderOrderCard)}
                </div>
              </div>
            )}

            {/* Previous Orders Section */}
            {previousOrders.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                  <History className="h-5 w-5 text-muted-foreground" /> Previous Orders
                </h2>
                <div className="space-y-3">
                  {previousOrders.map(renderOrderCard)}
                </div>
              </div>
            )}

            {/* Quick Actions (Avoiding Empty States) */}
            <div className="rounded-3xl bg-secondary/35 p-5 border border-border/50 space-y-4">
              <h3 className="font-display text-base font-semibold flex items-center gap-1.5 text-foreground">
                <Sparkles className="h-4 w-4 text-accent" /> Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate(`/t/${tableId}`)}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 hover:ring-accent/40"
                >
                  <Plus className="h-5 w-5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Order Again</span>
                </button>
                <button
                  onClick={() => void handleGiveReview()}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 hover:ring-accent/40"
                >
                  <Star className="h-5 w-5 text-accent" />
                  <span className="text-xs font-semibold text-foreground">Leave Review</span>
                </button>
                <button
                  disabled={callingType === "waiter" || !cooldown.canSend("waiter")}
                  onClick={() => void handleCallStaff("waiter", "Call Staff")}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 hover:ring-accent/40 disabled:opacity-60"
                >
                  <PhoneCall className="h-5 w-5 text-success" />
                  <span className="text-xs font-semibold text-foreground">Call Staff</span>
                  {cooldown.remainingCooldownMs("waiter") > 0 && (
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {Math.ceil(cooldown.remainingCooldownMs("waiter") / 1000)}s
                    </span>
                  )}
                </button>
                <button
                  disabled={callingType === "bill" || !cooldown.canSend("bill")}
                  onClick={() => void handleCallStaff("bill", "Request Bill")}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 hover:ring-accent/40 disabled:opacity-60"
                >
                  <Receipt className="h-5 w-5 text-accent" />
                  <span className="text-xs font-semibold text-foreground">Request Bill</span>
                  {cooldown.remainingCooldownMs("bill") > 0 && (
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {Math.ceil(cooldown.remainingCooldownMs("bill") / 1000)}s
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. ACTIVE CART/BASKET VIEW
  return (
    <div style={{ paddingBottom: pagePaddingBottom }} className="px-4 pt-4 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Your Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">Table {table.label} · {cafe.name}</p>
      </div>

      {editingOrderId && (
        <div className="rounded-2xl bg-accent/15 border border-accent/30 p-4 flex items-center justify-between shadow-soft">
          <div className="text-sm font-medium">
            <span className="block text-accent font-semibold">Editing Order #{editingOrderId.slice(0, 8).toUpperCase()}</span>
            <span className="text-xs text-muted-foreground">You are modifying an existing order.</span>
          </div>
          <button
            onClick={() => {
              cancelEditing();
              toast.info("Editing cancelled. Cart cleared.");
            }}
            className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition"
          >
            Cancel Edit
          </button>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {lines.map((l) => (
          <motion.li
            layout
            key={l.item.id}
            className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60"
          >
            <MenuImage src={l.item.image_url} alt={l.item.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="break-anywhere font-medium">{l.item.name}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatMoney(l.item.price_cents, cafe.currency)}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
              <button
                aria-label="Decrease"
                onClick={() => setQty(l.item.id, l.qty - 1)}
                className="grid h-8 w-8 place-items-center rounded-full text-secondary-foreground transition hover:bg-background"
              >
                {l.qty === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
              <button
                aria-label="Increase"
                onClick={() => setQty(l.item.id, l.qty + 1)}
                className="grid h-8 w-8 place-items-center rounded-full text-secondary-foreground transition hover:bg-background"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </motion.li>
        ))}
      </ul>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium">Note for staff (optional)</label>
          <span className={`text-xs tabular-nums ${note.length >= ORDER_NOTE_MAX ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
            {note.length} / {ORDER_NOTE_MAX}
          </span>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, ORDER_NOTE_MAX))}
          placeholder="Any allergies or special requests?"
          rows={3}
          maxLength={ORDER_NOTE_MAX}
          className="mt-1 w-full resize-none rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring/60"
        />
      </div>

      {/* Active Orders Section */}
      {activeOrders.length > 0 && (
        <div className="pt-6 border-t border-border/60">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-muted-foreground">
            <ShoppingBag className="h-5 w-5 text-accent animate-pulse" /> Active Orders
          </h2>
          <div className="space-y-3">
            {activeOrders.map(renderOrderCard)}
          </div>
        </div>
      )}

      {/* Previous Orders Section */}
      {previousOrders.length > 0 && (
        <div className="pt-6 border-t border-border/60">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-muted-foreground">
            <History className="h-5 w-5 text-muted-foreground" /> Previous Orders
          </h2>
          <div className="space-y-3">
            {previousOrders.map(renderOrderCard)}
          </div>
        </div>
      )}

      {/* Floating Place Order Card */}
      <div
        style={{
          bottom: `calc(${BOTTOM_NAV_HEIGHT} + ${FLOATING_CART_GAP} + env(safe-area-inset-bottom))`
        }}
        className="fixed inset-x-0 z-30 px-4"
      >
        <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-border bg-card/95 backdrop-blur-sm p-3.5 shadow-none ring-1 ring-border/60">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
            <span className="font-display text-xl font-bold tabular-nums">
              {formatMoney(subtotalCents, cafe.currency)}
            </span>
          </div>
          <button
            onClick={editingOrderId ? updateExistingOrder : placeOrder}
            disabled={placing}
            className="w-full rounded-full bg-gradient-accent py-2.5 text-base font-semibold text-accent-foreground shadow-soft transition active:scale-[0.99] disabled:opacity-60"
          >
            {placing ? "Sending…" : editingOrderId ? "Update Order" : "Place Order"}
          </button>
          <p className="mt-1 text-center text-xs text-muted-foreground leading-none">
            Pay at the counter when you're ready.
          </p>
        </div>
      </div>
    </div>
  );
}
