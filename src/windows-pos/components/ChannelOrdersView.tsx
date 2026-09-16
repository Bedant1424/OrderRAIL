import React, { useState } from "react";
import {
  Clock,
  User,
  Phone,
  FileText,
  ShoppingBag,
  Bike,
  Plus,
  ChefHat,
  Printer,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Receipt,
} from "lucide-react";
import { CounterOrderActionService } from "../services/counterOrderActionService";
import { BillSettlementModal } from "./BillSettlementModal";
import type { CounterOrder, OrderSource } from "../types/counterTypes";

interface ChannelOrdersViewProps {
  channel: OrderSource;
  orders: CounterOrder[];
  cafeId?: string;
  cafeName?: string;
  onOrderUpdated?: (orderId: string, newStatus: "preparing") => void;
  onOpenNewOrder: () => void;
  onRefresh?: () => void;
}

export const ChannelOrdersView: React.FC<ChannelOrdersViewProps> = ({
  channel,
  orders,
  cafeId = "00000000-0000-0000-0000-000000000001",
  cafeName = "Cheese Corner",
  onOrderUpdated,
  onOpenNewOrder,
  onRefresh,
}) => {
  const [inFlightOrderIds, setInFlightOrderIds] = useState<Set<string>>(new Set());
  const [settlingOrder, setSettlingOrder] = useState<CounterOrder | null>(null);
  const [actionFeedback, setActionFeedback] = useState<
    Record<string, { type: "success" | "error" | "warning"; message: string }>
  >({});

  const formatCurrency = (cents: number) => `₹${(cents / 100).toFixed(2)}`;

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "--:--";
    }
  };

  const getChannelMeta = () => {
    switch (channel) {
      case "TAKEAWAY":
        return {
          title: "Takeaway Orders",
          icon: <ShoppingBag className="w-5 h-5 text-amber-400" />,
          accentBg: "bg-amber-500/10",
          accentBorder: "border-amber-500/30",
          accentText: "text-amber-400",
        };
      case "SWIGGY":
        return {
          title: "Swiggy Orders",
          icon: <Bike className="w-5 h-5 text-orange-400" />,
          accentBg: "bg-orange-500/10",
          accentBorder: "border-orange-500/30",
          accentText: "text-orange-400",
        };
      case "ZOMATO":
        return {
          title: "Zomato Orders",
          icon: <Bike className="w-5 h-5 text-rose-400" />,
          accentBg: "bg-rose-500/10",
          accentBorder: "border-rose-500/30",
          accentText: "text-rose-400",
        };
      default:
        return {
          title: "Orders",
          icon: <ShoppingBag className="w-5 h-5 text-zinc-400" />,
          accentBg: "bg-zinc-800",
          accentBorder: "border-zinc-700",
          accentText: "text-zinc-300",
        };
    }
  };

  const meta = getChannelMeta();
  const channelOrders = orders.filter((o) => o.orderSource === channel && o.status !== "cancelled");

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "pending":
        return (
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold uppercase tracking-wider">
            Pending
          </span>
        );
      case "preparing":
      case "kot_sent":
        return (
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold uppercase tracking-wider">
            Preparing
          </span>
        );
      case "ready":
        return (
          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold uppercase tracking-wider">
            Ready
          </span>
        );
      case "served":
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold uppercase tracking-wider">
            Served
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 text-[10px] font-semibold uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  const getKotLabel = (order: CounterOrder) => {
    if (order.orderSource === "SWIGGY") {
      return order.externalOrderRef ? `Swiggy #${order.externalOrderRef}` : "Swiggy";
    }
    if (order.orderSource === "ZOMATO") {
      return order.externalOrderRef ? `Zomato #${order.externalOrderRef}` : "Zomato";
    }
    return "Takeaway";
  };

  const handleAcceptOrder = async (order: CounterOrder) => {
    if (inFlightOrderIds.has(order.id)) return;

    setInFlightOrderIds((prev) => new Set(prev).add(order.id));
    setActionFeedback((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });

    try {
      const kotLabel = getKotLabel(order);
      const res = await CounterOrderActionService.acceptOrder(order, kotLabel, cafeName);

      if (!res.success) {
        setActionFeedback((prev) => ({
          ...prev,
          [order.id]: { type: "error", message: res.error || "Order acceptance failed" },
        }));
      } else {
        onOrderUpdated?.(order.id, "preparing");

        let printMsg = "Order accepted & preparing.";
        if (res.printResult?.status === "ACCEPTED_FOR_TEST_PRINT") {
          printMsg = "Order accepted. KOT accepted by mock printer.";
        } else if (res.printResult?.status === "UNAVAILABLE") {
          printMsg = "Order accepted. KOT ready (printer unavailable).";
        }

        setActionFeedback((prev) => ({
          ...prev,
          [order.id]: {
            type: res.printResult?.status === "UNAVAILABLE" ? "warning" : "success",
            message: printMsg,
          },
        }));
      }
    } catch (err: any) {
      setActionFeedback((prev) => ({
        ...prev,
        [order.id]: { type: "error", message: err?.message || "Unexpected error accepting order" },
      }));
    } finally {
      setInFlightOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  const handleReprintKot = async (order: CounterOrder) => {
    if (inFlightOrderIds.has(order.id)) return;

    setInFlightOrderIds((prev) => new Set(prev).add(order.id));
    try {
      const kotLabel = getKotLabel(order);
      const res = await CounterOrderActionService.reprintKot(order, kotLabel, cafeName);
      setActionFeedback((prev) => ({
        ...prev,
        [order.id]: {
          type: res.success ? "success" : "warning",
          message: res.printResult?.message || (res.success ? "KOT dispatched to printer" : "Print failed"),
        },
      }));
    } finally {
      setInFlightOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950 select-none">
      {/* View Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${meta.accentBg} ${meta.accentBorder}`}>
            {meta.icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              {meta.title}
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {channelOrders.length} Active
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Direct counter orders & aggregator delivery queue
            </p>
          </div>
        </div>

        <button
          onClick={onOpenNewOrder}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-md shadow-orange-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New {channel.replace(/_/g, " ")} Order</span>
        </button>
      </div>

      {/* Orders Grid / List */}
      <div className="flex-1 overflow-y-auto p-4">
        {channelOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className={`p-4 rounded-2xl border ${meta.accentBg} ${meta.accentBorder} mb-3`}>
              {meta.icon}
            </div>
            <h3 className="text-sm font-semibold text-zinc-300">
              No Active {channel.replace(/_/g, " ")} Orders
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4">
              There are currently no active orders in the {channel.toLowerCase()} queue. Click below to punch a new order.
            </p>
            <button
              onClick={onOpenNewOrder}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Punch New Order</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channelOrders.map((order) => {
              const isInFlight = inFlightOrderIds.has(order.id);
              const feedback = actionFeedback[order.id];
              const isPending = order.status.toLowerCase() === "pending";
              const isPreparing =
                order.status.toLowerCase() === "preparing" ||
                order.status.toLowerCase() === "kot_sent";

              return (
                <div
                  key={order.id}
                  className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between space-y-3"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono bg-zinc-800 px-2 py-0.5 rounded">
                          #{order.orderNumber}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                          <Clock className="w-3 h-3" />
                          {formatTime(order.createdAt)}
                        </span>
                      </div>
                      {order.syncStatus === "PENDING_SYNC" ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Pending Sync
                        </span>
                      ) : (
                        getStatusBadge(order.status)
                      )}
                    </div>

                    {/* External Ref Tag for Swiggy / Zomato */}
                    {order.externalOrderRef && (
                      <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono font-semibold text-orange-300">
                        <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
                        <span>Ref: #{order.externalOrderRef}</span>
                      </div>
                    )}

                    {/* Customer Info */}
                    {(order.customerName || order.customerPhone) && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/60">
                        {order.customerName && (
                          <span className="flex items-center gap-1 truncate">
                            <User className="w-3.5 h-3.5 text-zinc-500" />
                            {order.customerName}
                          </span>
                        )}
                        {order.customerPhone && (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="w-3.5 h-3.5 text-zinc-500" />
                            {order.customerPhone}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Items List */}
                    <div className="mt-3 space-y-2 border-t border-zinc-800/60 pt-2.5 max-h-40 overflow-y-auto pr-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-start justify-between text-xs">
                          <div className="flex-1 pr-2">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-bold text-orange-400 font-mono">
                                {item.qty}x
                              </span>
                              <span className="text-zinc-200 font-medium">{item.name}</span>
                            </div>
                            {item.note && (
                              <p className="text-[11px] text-amber-300/80 italic pl-5 mt-0.5">
                                {item.note}
                              </p>
                            )}
                          </div>
                          <span className="font-mono text-zinc-300 font-medium">
                            {formatCurrency(item.priceCents * item.qty)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Note */}
                    {order.note && (
                      <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-zinc-400 bg-zinc-950/80 p-2 rounded-lg border border-zinc-800/60">
                        <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                        <span className="italic">{order.note}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer Total & Actions */}
                  <div>
                    <div className="flex justify-between items-center pt-2.5 border-t border-zinc-800 text-xs mb-3">
                      <span className="text-zinc-400">Total</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">
                        {formatCurrency(order.totalCents)}
                      </span>
                    </div>

                    {/* Feedback Banner */}
                    {feedback && (
                      <div
                        className={`text-[11px] p-2 rounded-lg flex items-center gap-1.5 mb-2 ${
                          feedback.type === "success"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : feedback.type === "warning"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {feedback.type === "success" ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{feedback.message}</span>
                      </div>
                    )}

                    {/* Actions */}
                    {isPending && (
                      <button
                        onClick={() => handleAcceptOrder(order)}
                        disabled={isInFlight}
                        className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-md shadow-orange-600/20"
                      >
                        {isInFlight ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Accepting...</span>
                          </>
                        ) : (
                          <>
                            <ChefHat className="w-4 h-4" />
                            <span>Accept Order & Send KOT</span>
                          </>
                        )}
                      </button>
                    )}

                    {isPreparing && (
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-blue-400" />
                          Preparing in Kitchen
                        </span>
                        <button
                          onClick={() => handleReprintKot(order)}
                          disabled={isInFlight}
                          className="text-[11px] font-medium text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-1 border border-zinc-700/50 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Reprint KOT</span>
                        </button>
                      </div>
                    )}

                    {/* Settle Button — visible for preparing/ready/served */}
                    {!isPending && (
                      <button
                        onClick={() => setSettlingOrder(order)}
                        className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20 transition-all border border-emerald-500/40 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Settle ({formatCurrency(order.totalCents)})</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bill & Settlement Modal for Channel Orders */}
      {settlingOrder && (
        <BillSettlementModal
          isOpen={!!settlingOrder}
          onClose={() => setSettlingOrder(null)}
          orders={[settlingOrder]}
          channel={channel}
          cafeId={cafeId}
          cafeName={cafeName}
          onSettlementCompleted={() => {
            setSettlingOrder(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
};
