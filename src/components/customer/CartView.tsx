import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, History, ChevronRight, Star, PhoneCall, Receipt, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart";
import { supabase, formatMoney, formatOrderLabel, type Cafe, type TableRow, type Order, type OrderItem, type ServiceRequestType } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { generateUUID } from "@/lib/uuid";
import { cancelOrder } from "@/lib/orders";
import { editOrderInDb, fetchCustomerOrders } from "@/lib/orders/repository";
import { getStoredGuestSessionId } from "@/lib/guestSession";
import { createServiceRequestInDb } from "@/lib/serviceRequests";
import { submitOrder } from "@/lib/orderQueue";
import { addOrderToHistory, getOrderHistory } from "@/lib/orderHistory";
import { toast } from "@/components/ui/sonner";
import { MenuImage } from "./MenuImage";
import { BOTTOM_NAV_HEIGHT, FLOATING_CART_GAP, STICKY_FOOTER_GAP, STICKY_FOOTER_HEIGHT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/config/app";
import { useServiceRequestCooldown } from "@/hooks/useServiceRequestCooldown";
import { useCustomerNavigate } from "@/hooks/useCustomerBack";
import { getOperationsSettings, getTodayOpenStatus } from "@/lib/billing/operationsSettings";

export function CartView({ cafe, table }: { cafe: Cafe; table: TableRow }) {
  const { lines, setQty, remove, subtotalCents, clear, note, setNote, editingOrderId, editingOrderVersion, cancelEditing } = useCart();
  const { tableId } = useParams();
  const navigate = useNavigate();
  const customerNavigate = useCustomerNavigate();
  const outletContext = useOutletContext<{ guestSessionId?: string | null; isSessionActive?: boolean }>() || {};
  const { isSessionActive = true } = outletContext;
  const currentGuestSessionId = outletContext.guestSessionId || (table?.id ? getStoredGuestSessionId(table.id) : null);

  const [placing, setPlacing] = useState(false);
  const [callingType, setCallingType] = useState<ServiceRequestType | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const cooldown = useServiceRequestCooldown(APP_CONFIG.serviceRequestCooldownMs, APP_CONFIG.serviceRequestTimeoutMs);

  const ORDER_NOTE_MAX = 200;

  // History State
  const [historyOrders, setHistoryOrders] = useState<(Order & { order_items: OrderItem[] })[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = async () => {
    if (!table?.id) return;
    setLoadingHistory(true);
    const localIds = getOrderHistory(table.id, table.active_session_id);
    const browserSessionId = getSessionId();

    try {
      const rawRes = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("table_id", table.id);

      const ords = await fetchCustomerOrders(table.id, table.active_session_id, localIds, currentGuestSessionId);
      setHistoryOrders(ords as any);
    } catch (err) {
      console.error("loadHistory failed:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [table?.id, table?.active_session_id, currentGuestSessionId]);

  useEffect(() => {
    if (!table?.id) return;
    const channel = supabase
      .channel(`cart-orders-${table.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `table_id=eq.${table.id}` },
        () => {
          void loadHistory();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table.id]);

  const placeOrder = async () => {
    if (!lines.length || !isSessionActive) return;
    setPlacing(true);
    try {
      const itemIds = lines.map((l) => l.item.id);
      const { data: dbItems, error: fetchError } = await supabase
        .from("menu_items")
        .select("id, name, is_available")
        .in("id", itemIds);

      if (fetchError) throw fetchError;

      const dbItemsMap = new Map<string, { name: string; is_available: boolean }>();
      if (dbItems) {
        for (const item of dbItems) {
          dbItemsMap.set(item.id, { name: item.name, is_available: item.is_available });
        }
      }

      const unavailableNames: string[] = [];
      for (const line of lines) {
        const dbItem = dbItemsMap.get(line.item.id);
        if (!dbItem || !dbItem.is_available) {
          unavailableNames.push(line.item.name);
          setQty(line.item.id, 0);
        }
      }

      if (unavailableNames.length > 0) {
        toast.error(
          `Some items are no longer available and were removed from your cart: ${unavailableNames.join(", ")}. Please review your order.`
        );
        setPlacing(false);
        return;
      }

      const opsSettings = getOperationsSettings(cafe.id);
      const todayStatus = getTodayOpenStatus(opsSettings);

      if (!todayStatus.isOpen || !opsSettings.enabledChannels.dine_in) {
        const errorMsg = !todayStatus.isOpen
          ? `Restaurant is currently ${todayStatus.text.toLowerCase()} for ordering.`
          : "Dine-In ordering is currently disabled by management.";
        toast.error(`Cannot place order: ${errorMsg}`);
        setPlacing(false);
        return;
      }

      const orderId = generateUUID();
      const { queued } = await submitOrder({
        id: orderId,
        cafe_id: cafe.id,
        table_id: table.id,
        session_id: getSessionId(),
        dining_session_id: table.active_session_id,
        guest_session_id: currentGuestSessionId,
        note: note.trim() || null,
        total_cents: subtotalCents,
        items: lines.map((l) => ({
          menu_item_id: l.item.id,
          name: l.item.name,
          price_cents: l.item.price_cents,
          qty: l.qty,
        })),
      });

      addOrderToHistory(orderId, tableId, table?.active_session_id);
      clear();
      
      if (queued) {
        toast.success("Order saved offline — it'll send when you're back online.");
      } else {
        toast.success("Order sent to the kitchen ☕");
      }
      customerNavigate(`/t/${tableId}/order/${orderId}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  const updateExistingOrder = async () => {
    if (!lines.length || !editingOrderId || !isSessionActive) return;
    setPlacing(true);
    try {
      await editOrderInDb({
        orderId: editingOrderId,
        items: lines.map((l) => ({
          menu_item_id: l.item.id,
          name: l.item.name,
          price_cents: l.item.price_cents,
          qty: l.qty,
        })),
        notes: note.trim() || null,
        updatedBy: "customer",
        guestSessionId: currentGuestSessionId,
      });

      toast.success("Order updated successfully! ☕");
      const savedId = editingOrderId;
      clear();
      customerNavigate(`/t/${tableId}/order/${savedId}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Could not update order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  const handleCallStaff = async (type: ServiceRequestType, label: string) => {
    if (!cooldown.canSend(type) || !isSessionActive) return;
    setCallingType(type);
    try {
      await createServiceRequestInDb({
        cafe_id: cafe.id,
        table_id: table.id,
        browser_session_id: getSessionId(),
        dining_session_id: table.active_session_id,
        type,
      });
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
      await cancelOrder(orderId, currentGuestSessionId);
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

  const sortedHistory = [...historyOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const activeOrders = sortedHistory.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return s !== "served" && s !== "cancelled";
  });

  const previousOrders = sortedHistory.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return s === "served" || s === "cancelled";
  });

  const renderOrderCard = (o: Order & { order_items: OrderItem[]; isOwner?: boolean }) => {
    const isServed = o.status === "served";
    const isOwner = o.isOwner !== false;
    
    const getStatusDetails = (status: string) => {
      const s = status.toLowerCase();
      if (s === "pending" || s === "received") {
        return {
          label: "Received",
          colorClass: "text-blue-700 bg-blue-50 border-blue-200",
          icon: Clock
        };
      }
      if (s === "preparing") {
        return {
          label: "Preparing",
          colorClass: "text-amber-800 bg-amber-50 border-amber-200",
          icon: Sparkles
        };
      }
      if (s === "ready") {
        return {
          label: "Ready",
          colorClass: "text-emerald-800 bg-emerald-50 border-emerald-200",
          icon: CheckCircle2
        };
      }
      if (s === "served") {
        return {
          label: "Served",
          colorClass: "text-[#75625B] bg-white border-[#E8DCC8]",
          icon: History
        };
      }
      return {
        label: status.charAt(0).toUpperCase() + status.slice(1),
        colorClass: "text-rose-700 bg-rose-50 border-rose-200",
        icon: ChevronRight
      };
    };

    const details = getStatusDetails(o.status);
    const StatusIcon = details.icon;

    return (
      <div
        key={o.id}
        onClick={() => customerNavigate(`/t/${tableId}/order/${o.id}`)}
        className="group flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-xs border border-[#E8DCC8] hover:border-[#EA580C]/40 cursor-pointer transition"
      >
        <div className="flex items-center justify-between border-b border-[#E8DCC8] pb-2 text-xs font-bold text-[#75625B]">
          <span className="flex items-center gap-1.5">
            <span className="text-[#2A1710] font-black">{formatOrderLabel(o.order_number)}</span>
            {!isOwner && (
              <span className="rounded bg-[#FFF8EA] px-1.5 py-0.5 text-[10px] text-[#75625B] font-medium border border-[#E8DCC8]">Table Guest</span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", details.colorClass)}>
              <StatusIcon className="h-3 w-3 shrink-0" />
              <span>{details.label}</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-[#75625B]" />
          </span>
        </div>
        <div className="space-y-1 text-sm text-[#2A1710]">
          {o.order_items?.map((it) => (
            <div key={it.id} className="flex justify-between gap-2">
              <span className="break-anywhere flex-1 font-medium">{it.qty}× {it.name}</span>
              <span className="shrink-0 text-[#75625B] tabular-nums font-semibold">{formatMoney(it.price_cents * it.qty, cafe.currency)}</span>
            </div>
          ))}
        </div>
        {o.note && (
          <p className="break-anywhere mt-1.5 rounded-xl bg-[#FFF8EA] p-2 text-xs text-[#75625B] border border-[#E8DCC8]">
            <span className="font-bold text-[#2A1710]">Note:</span> {o.note}
          </p>
        )}
        <div className="flex items-center justify-between border-t border-[#E8DCC8] pt-2 text-xs text-[#75625B]">
          <span>Total: <strong className="text-[#2A1710] text-sm tabular-nums font-black">{formatMoney(o.total_cents, cafe.currency)}</strong></span>
          {isServed && (
            <span>
              Served at {new Date(o.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {o.status === "pending" && isOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleCancelOrder(o.id);
            }}
            disabled={cancelingId === o.id}
            className="mt-1 w-full rounded-full border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
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
      customerNavigate(`/t/${tableId}/order/${target.id}?scrollTo=review`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't check review status. Please try again.");
    }
  };

  const pagePaddingBottom = lines.length > 0
    ? `calc(${BOTTOM_NAV_HEIGHT} + ${FLOATING_CART_GAP} + ${STICKY_FOOTER_HEIGHT} + ${STICKY_FOOTER_GAP} + env(safe-area-inset-bottom))`
    : `calc(${BOTTOM_NAV_HEIGHT} + 1.5rem + env(safe-area-inset-bottom))`;

  // 1. EMPTY CART VIEW
  if (!lines.length) {
    return (
      <div style={{ paddingBottom: pagePaddingBottom }} className="px-4 pt-3 space-y-6">
        {activeOrders.length === 0 && previousOrders.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-white border border-[#E8DCC8] shadow-xs">
              <span aria-hidden className="text-3xl">🥐</span>
            </div>
            <h2 className="font-display text-2xl font-black text-[#2A1710]">Your order is empty</h2>
            <p className="mt-1.5 text-[#75625B] text-xs font-medium">Add something delicious from the menu.</p>
            <button
              onClick={() => customerNavigate(`/t/${tableId}`)}
              className="mt-6 rounded-full bg-[#EA580C] hover:bg-[#EA580C]/90 px-6 py-3 text-sm font-bold text-white shadow-md transition"
            >
              Browse menu
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-black text-[#2A1710]">My Order</h1>
              <p className="mt-0.5 text-xs text-[#75625B] font-medium">Your selected dishes</p>
            </div>

            {/* Active Orders Section */}
            {activeOrders.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-display text-base font-black text-[#2A1710]">
                  <ShoppingBag className="h-4.5 w-4.5 text-[#EA580C] animate-pulse" /> Active Orders
                </h2>
                <div className="space-y-3">
                  {activeOrders.map(renderOrderCard)}
                </div>
              </div>
            )}

            {/* Previous Orders Section */}
            {previousOrders.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-display text-base font-black text-[#2A1710]">
                  <History className="h-4.5 w-4.5 text-[#75625B]" /> Previous Orders
                </h2>
                <div className="space-y-3">
                  {previousOrders.map(renderOrderCard)}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="rounded-2xl bg-white p-4 border border-[#E8DCC8] shadow-xs space-y-3">
              <h3 className="font-display text-sm font-bold flex items-center gap-1.5 text-[#2A1710]">
                <Sparkles className="h-4 w-4 text-[#F59E0B]" /> Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => customerNavigate(`/t/${tableId}`)}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-[#FFF8EA] p-3 border border-[#E8DCC8] hover:border-[#EA580C]/40 transition"
                >
                  <Plus className="h-4.5 w-4.5 text-[#EA580C]" />
                  <span className="text-xs font-bold text-[#2A1710]">Order Again</span>
                </button>
                <button
                  onClick={() => void handleGiveReview()}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-[#FFF8EA] p-3 border border-[#E8DCC8] hover:border-[#EA580C]/40 transition"
                >
                  <Star className="h-4.5 w-4.5 text-[#F59E0B]" />
                  <span className="text-xs font-bold text-[#2A1710]">Leave Review</span>
                </button>
                <button
                  disabled={callingType === "waiter" || !cooldown.canSend("waiter")}
                  onClick={() => void handleCallStaff("waiter", "Call Staff")}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-[#FFF8EA] p-3 border border-[#E8DCC8] hover:border-[#EA580C]/40 disabled:opacity-60 transition"
                >
                  <PhoneCall className="h-4.5 w-4.5 text-emerald-600" />
                  <span className="text-xs font-bold text-[#2A1710]">Call Staff</span>
                  {cooldown.remainingCooldownMs("waiter") > 0 && (
                    <span className="text-[10px] tabular-nums text-[#75625B]">
                      {Math.ceil(cooldown.remainingCooldownMs("waiter") / 1000)}s
                    </span>
                  )}
                </button>
                <button
                  disabled={callingType === "bill" || !cooldown.canSend("bill")}
                  onClick={() => void handleCallStaff("bill", "Request Bill")}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-[#FFF8EA] p-3 border border-[#E8DCC8] hover:border-[#EA580C]/40 disabled:opacity-60 transition"
                >
                  <Receipt className="h-4.5 w-4.5 text-[#EA580C]" />
                  <span className="text-xs font-bold text-[#2A1710]">Request Bill</span>
                  {cooldown.remainingCooldownMs("bill") > 0 && (
                    <span className="text-[10px] tabular-nums text-[#75625B]">
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
    <div style={{ paddingBottom: pagePaddingBottom }} className="px-4 pt-3 space-y-5">
      <div>
        <h1 className="font-display text-2xl font-black text-[#2A1710]">My Order</h1>
        <p className="mt-0.5 text-xs text-[#75625B] font-medium">Your selected dishes</p>
      </div>

      {editingOrderId && (
        <div className="rounded-2xl bg-[#EA580C]/10 border border-[#EA580C]/30 p-3.5 flex items-center justify-between shadow-xs">
          <div className="text-xs font-medium">
            <span className="block text-[#EA580C] font-bold">Editing Order #{editingOrderId.slice(0, 8).toUpperCase()}</span>
            <span className="text-[#75625B]">You are modifying an existing order.</span>
          </div>
          <button
            onClick={() => {
              cancelEditing();
              toast.info("Editing cancelled. Cart cleared.");
            }}
            className="rounded-full bg-white border border-[#E8DCC8] px-3 py-1 text-xs font-bold text-[#2A1710] hover:bg-white/80 transition"
          >
            Cancel Edit
          </button>
        </div>
      )}

      {/* Cart Item Cards */}
      <ul className="space-y-3">
        {lines.map((l) => (
          <motion.li
            layout
            key={l.item.id}
            className="flex items-center gap-3.5 rounded-2xl bg-white p-3 border border-[#E8DCC8] shadow-xs"
          >
            <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-[#E8DCC8] bg-[#FFF8EA]">
              <MenuImage src={l.item.image_url} alt={l.item.name} size="sm" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-anywhere font-display text-sm font-bold text-[#2A1710]">{l.item.name}</p>
              <p className="text-xs font-extrabold text-[#2A1710] tabular-nums mt-0.5">
                {formatMoney(l.item.price_cents, cafe.currency)}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[#FFF8EA] border border-[#E8DCC8] p-0.5 h-8">
              <button
                aria-label="Decrease"
                onClick={() => setQty(l.item.id, l.qty - 1)}
                className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#2A1710] border border-[#E8DCC8] hover:bg-[#EA580C] hover:text-white transition active:scale-90"
              >
                {l.qty === 1 ? <Trash2 className="h-3.5 w-3.5 text-rose-600" /> : <Minus className="h-3.5 w-3.5" />}
              </button>
              <span className="w-5 text-center text-xs font-black text-[#2A1710] tabular-nums">{l.qty}</span>
              <button
                aria-label="Increase"
                onClick={() => setQty(l.item.id, l.qty + 1)}
                className="grid h-7 w-7 place-items-center rounded-full bg-[#EA580C] text-white hover:bg-[#EA580C]/90 transition active:scale-90"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.li>
        ))}
      </ul>

      {/* Note for Staff */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-[#2A1710]">Note for staff (optional)</label>
          <span className={`text-[10px] tabular-nums ${note.length >= ORDER_NOTE_MAX ? 'text-rose-600 font-bold' : 'text-[#75625B]'}`}>
            {note.length} / {ORDER_NOTE_MAX}
          </span>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, ORDER_NOTE_MAX))}
          placeholder="Any allergies or special instructions?"
          rows={2}
          maxLength={ORDER_NOTE_MAX}
          className="w-full resize-none rounded-xl border border-[#E8DCC8] bg-white p-3 text-xs text-[#2A1710] placeholder:text-[#75625B] outline-none shadow-xs transition focus:border-[#EA580C] focus:ring-2 focus:ring-[#EA580C]/20"
        />
      </div>

      {/* Active Orders Section */}
      {activeOrders.length > 0 && (
        <div className="pt-4 border-t border-[#E8DCC8]">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-black text-[#2A1710]">
            <ShoppingBag className="h-4 w-4 text-[#EA580C] animate-pulse" /> Active Orders
          </h2>
          <div className="space-y-3">
            {activeOrders.map(renderOrderCard)}
          </div>
        </div>
      )}

      {/* Previous Orders Section */}
      {previousOrders.length > 0 && (
        <div className="pt-4 border-t border-[#E8DCC8]">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-black text-[#75625B]">
            <History className="h-4 w-4 text-[#75625B]" /> Previous Orders
          </h2>
          <div className="space-y-3">
            {previousOrders.map(renderOrderCard)}
          </div>
        </div>
      )}

      {/* Sticky Order Summary & Checkout Card */}
      <div
        style={{
          bottom: `calc(${BOTTOM_NAV_HEIGHT} + ${FLOATING_CART_GAP} + env(safe-area-inset-bottom))`
        }}
        className="fixed inset-x-0 z-30 px-4"
      >
        <div className="mx-auto w-full max-w-[420px] rounded-2xl border border-[#E8DCC8] bg-[#FFF8EA]/95 backdrop-blur-md p-3.5 shadow-xl">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75625B]">Subtotal</span>
            <span className="font-display text-xl font-black text-[#2A1710] tabular-nums">
              {formatMoney(subtotalCents, cafe.currency)}
            </span>
          </div>
          <button
            onClick={editingOrderId ? updateExistingOrder : placeOrder}
            disabled={placing}
            className="w-full rounded-full bg-[#EA580C] hover:bg-[#EA580C]/90 py-3.5 text-base font-bold text-white shadow-md transition active:scale-[0.99] disabled:opacity-60 min-h-[48px] flex items-center justify-center gap-2"
          >
            {placing ? "Sending…" : editingOrderId ? "Update Order" : "Place Order"}
          </button>
          <p className="mt-1.5 text-center text-[11px] font-medium text-[#75625B] leading-none">
            Pay at the counter when you're ready.
          </p>
        </div>
      </div>
    </div>
  );
}
