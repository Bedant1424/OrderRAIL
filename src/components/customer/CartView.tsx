import { useNavigate, useParams } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, History, ChevronRight, Star, PhoneCall, Receipt, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart";
import { supabase, formatMoney, type Cafe, type TableRow, type Order, type OrderItem, type ServiceRequestType } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { submitOrder } from "@/lib/orderQueue";
import { addOrderToHistory, getOrderHistory } from "@/lib/orderHistory";
import { toast } from "sonner";

export function CartView({ cafe, table }: { cafe: Cafe; table: TableRow }) {
  const { lines, setQty, remove, subtotalCents, clear } = useCart();
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [callingType, setCallingType] = useState<ServiceRequestType | null>(null);

  // History State
  const [historyOrders, setHistoryOrders] = useState<(Order & { order_items: OrderItem[] })[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = async () => {
    const ids = getOrderHistory();
    if (ids.length === 0) return;
    setLoadingHistory(true);
    try {
      const { data: ords, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .in("id", ids)
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

  useEffect(() => {
    void loadHistory();
  }, []);

  const placeOrder = async () => {
    if (!lines.length) return;
    setPlacing(true);
    try {
      const orderId = crypto.randomUUID();
      const { queued } = await submitOrder({
        id: orderId,
        cafe_id: cafe.id,
        table_id: table.id,
        session_id: getSessionId(),
        note: note.trim() || null,
        total_cents: subtotalCents,
        items: lines.map((l) => ({
          menu_item_id: l.item.id,
          name: l.item.name,
          price_cents: l.item.price_cents,
          qty: l.qty,
          note: l.note ?? null,
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

  const handleCallStaff = async (type: ServiceRequestType, label: string) => {
    setCallingType(type);
    try {
      const { error } = await supabase.from("service_requests").insert({
        cafe_id: cafe.id,
        table_id: table.id,
        session_id: getSessionId(),
        type,
      });
      if (error) throw error;
      toast.success(`${label} request sent to staff`);
    } catch (e) {
      console.error(e);
      toast.error("Could not contact staff. Please try again.");
    } finally {
      setCallingType(null);
    }
  };

  // Sort historyOrders by created_at descending (latest first)
  const sortedHistory = [...historyOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Find the latest active order
  const latestActive = sortedHistory.find((o) => o.status !== "served" && o.status !== "cancelled");

  // Active orders contains only the latest active order (if any)
  const activeOrders = latestActive ? [latestActive] : [];

  // Previous orders contains all other orders (older active orders + all served/cancelled orders)
  const previousOrders = sortedHistory.filter((o) => o.id !== latestActive?.id);

  // Renders a single history order card
  const renderOrderCard = (o: Order & { order_items: OrderItem[] }) => {
    const isServed = o.status === "served";
    return (
      <div
        key={o.id}
        onClick={() => navigate(`/t/${tableId}/order/${o.id}`)}
        className="group flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 transition hover:ring-accent/40 cursor-pointer"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs font-semibold text-muted-foreground">
          <span>Order #{o.id.slice(0, 8).toUpperCase()}</span>
          <span className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${isServed ? "bg-success" : "bg-warning"}`} />
            <span className="capitalize">{o.status}</span>
            <ChevronRight className="h-3 w-3" />
          </span>
        </div>
        <div className="space-y-1 text-sm text-foreground">
          {o.order_items?.map((it) => (
            <div key={it.id} className="flex justify-between">
              <span>{it.qty}× {it.name}</span>
              <span className="text-muted-foreground tabular-nums">{formatMoney(it.price_cents * it.qty, cafe.currency)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
          <span>Total: <strong className="text-foreground text-sm tabular-nums">{formatMoney(o.total_cents, cafe.currency)}</strong></span>
          {isServed && (
            <span>
              Served at {new Date(o.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    );
  };

  // 1. EMPTY BASKET VIEW
  if (!lines.length) {
    return (
      <div className="pb-32 px-4">
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
          <div className="mt-4 space-y-6">
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
                  onClick={() => {
                    const lastOrder = previousOrders[0];
                    if (lastOrder) {
                      navigate(`/t/${tableId}/order/${lastOrder.id}`);
                    } else {
                      toast.info("No orders to review yet.");
                    }
                  }}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 hover:ring-accent/40"
                >
                  <Star className="h-5 w-5 text-accent" />
                  <span className="text-xs font-semibold text-foreground">Leave Review</span>
                </button>
                <button
                  disabled={callingType !== null}
                  onClick={() => void handleCallStaff("waiter", "Call Staff")}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 hover:ring-accent/40 disabled:opacity-60"
                >
                  <PhoneCall className="h-5 w-5 text-success" />
                  <span className="text-xs font-semibold text-foreground">Call Staff</span>
                </button>
                <button
                  disabled={callingType !== null}
                  onClick={() => void handleCallStaff("bill", "Request Bill")}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 hover:ring-accent/40 disabled:opacity-60"
                >
                  <Receipt className="h-5 w-5 text-accent" />
                  <span className="text-xs font-semibold text-foreground">Request Bill</span>
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
    <div className="pb-24 px-4">
      <div className="pt-4">
        <h1 className="font-display text-3xl font-semibold">Your Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">Table {table.label} · {cafe.name}</p>
      </div>

      <ul className="mt-6 space-y-3">
        {lines.map((l) => (
          <motion.li
            layout
            key={l.item.id}
            className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60"
          >
            {l.item.image_url ? (
              <img src={l.item.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-gradient-warm" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{l.item.name}</p>
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
        <label className="block text-sm font-medium">Note for staff (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          placeholder="Any allergies or special requests?"
          rows={3}
          className="mt-2 w-full resize-none rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring/60"
        />
      </div>

      <div className="mt-6 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <span className="font-display text-xl font-semibold tabular-nums">
            {formatMoney(subtotalCents, cafe.currency)}
          </span>
        </div>
        <button
          onClick={placeOrder}
          disabled={placing}
          className="w-full rounded-full bg-gradient-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground shadow-soft transition active:scale-[0.99] disabled:opacity-60"
        >
          {placing ? "Sending…" : "Place Order"}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Pay at the counter when you're ready.</p>
      </div>

      {/* Show active/previous history at the bottom to avoid empty states */}
      {historyOrders.length > 0 && (
        <div className="mt-8 pt-8 border-t border-border/60 space-y-4">
          <h2 className="font-display text-lg font-semibold text-muted-foreground">Placed Orders History</h2>
          <div className="space-y-3">
            {historyOrders.map(renderOrderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
