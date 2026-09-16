import React, { useState } from "react";
import {
  Clock,
  User,
  Phone,
  FileText,
  ShoppingCart,
  ChefHat,
  Printer,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { CounterOrderActionService } from "../services/counterOrderActionService";
import type { CounterTable, CounterOrder } from "../types/counterTypes";

interface OrderDetailsPanelProps {
  table: CounterTable | null;
  cafeName?: string;
  onOrderUpdated?: (orderId: string, newStatus: "preparing") => void;
  onPunchOrderForTable?: (tableId: string) => void;
}

export const OrderDetailsPanel: React.FC<OrderDetailsPanelProps> = ({
  table,
  cafeName = "Cheese Corner",
  onOrderUpdated,
  onPunchOrderForTable,
}) => {
  const [inFlightOrderIds, setInFlightOrderIds] = useState<Set<string>>(new Set());
  const [actionFeedback, setActionFeedback] = useState<Record<string, { type: "success" | "error" | "warning"; message: string }>>({});

  const formatCurrency = (cents: number) => {
    return `₹${(cents / 100).toFixed(2)}`;
  };

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

  const handleAcceptOrder = async (order: CounterOrder) => {
    if (inFlightOrderIds.has(order.id) || !table) return;

    setInFlightOrderIds((prev) => new Set(prev).add(order.id));
    setActionFeedback((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });

    try {
      const res = await CounterOrderActionService.acceptOrder(order, table.label, cafeName);

      if (!res.success) {
        setActionFeedback((prev) => ({
          ...prev,
          [order.id]: { type: "error", message: res.error || "Order acceptance failed" },
        }));
      } else {
        // Successful DB transition to preparing
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
    if (inFlightOrderIds.has(order.id) || !table) return;

    setInFlightOrderIds((prev) => new Set(prev).add(order.id));
    try {
      const res = await CounterOrderActionService.reprintKot(order, table.label, cafeName);
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

  if (!table) {
    return (
      <div className="w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col items-center justify-center p-6 text-center select-none">
        <ShoppingCart className="w-12 h-12 text-zinc-700 mb-3" />
        <h3 className="text-sm font-medium text-zinc-400">No Table Selected</h3>
        <p className="text-xs text-zinc-600 mt-1">Select a table from the left grid to view active orders.</p>
      </div>
    );
  }

  const activeOrders = table.orders.filter((o) => o.status !== "cancelled");

  return (
    <aside className="w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full overflow-hidden select-none">
      {/* Panel Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              {table.label}
              <span
                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  table.status === "occupied"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
                }`}
              >
                {table.status === "occupied" ? "Occupied" : "Vacant"}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {table.activeSessionId ? `Session #${table.activeSessionId.substring(0, 6)}` : "No active session"}
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-zinc-400">Total Unbilled</div>
            <div className="text-base font-bold font-mono text-emerald-400">
              {formatCurrency(table.unbilledTotalCents)}
            </div>
          </div>
        </div>

        {/* Quick Table Action Button */}
        {onPunchOrderForTable && (
          <button
            onClick={() => onPunchOrderForTable(table.id)}
            className="w-full mt-3 py-2 px-3 rounded-xl bg-orange-600/90 hover:bg-orange-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/20 transition-all border border-orange-500/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Punch Order / Add Items to {table.label}</span>
          </button>
        )}
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeOrders.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center text-zinc-500 text-xs p-4">
            <ShoppingCart className="w-8 h-8 text-zinc-700 mb-2" />
            <span className="font-semibold text-zinc-400">No active orders for this table</span>
            <span className="text-[11px] text-zinc-600 mt-0.5 mb-3">
              Table is currently free or has no pending orders in session.
            </span>
            {onPunchOrderForTable && (
              <button
                onClick={() => onPunchOrderForTable(table.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                <span>Punch First Order</span>
              </button>
            )}
          </div>
        ) : (
          activeOrders.map((order) => {
            const isInFlight = inFlightOrderIds.has(order.id);
            const feedback = actionFeedback[order.id];
            const isPending = order.status.toLowerCase() === "pending";
            const isPreparing = order.status.toLowerCase() === "preparing" || order.status.toLowerCase() === "kot_sent";

            return (
              <div
                key={order.id}
                className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 shadow-sm space-y-2.5"
              >
                {/* Order Card Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono bg-zinc-800 px-2 py-0.5 rounded">
                      #{order.orderNumber}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <Clock className="w-3 h-3" />
                      {formatTime(order.createdAt)}
                    </span>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                {/* Customer Info if present */}
                {(order.customerName || order.customerPhone) && (
                  <div className="flex items-center gap-3 text-xs text-zinc-400 bg-zinc-900/50 px-2 py-1 rounded border border-zinc-800/50">
                    {order.customerName && (
                      <span className="flex items-center gap-1 truncate">
                        <User className="w-3 h-3 text-zinc-500" />
                        {order.customerName}
                      </span>
                    )}
                    {order.customerPhone && (
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Phone className="w-3 h-3 text-zinc-500" />
                        {order.customerPhone}
                      </span>
                    )}
                  </div>
                )}

                {/* Order Items */}
                <div className="space-y-1.5 divide-y divide-zinc-900">
                  {order.items.map((item) => (
                    <div key={item.id} className="pt-1.5 first:pt-0 flex items-start justify-between text-xs">
                      <div className="flex-1 pr-2">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-orange-400 font-mono">{item.qty}x</span>
                          <span className="text-zinc-200 font-medium">{item.name}</span>
                        </div>
                        {item.note && (
                          <p className="text-[11px] text-amber-300/80 italic mt-0.5 pl-5">
                            Note: {item.note}
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-zinc-300 font-medium">
                        {formatCurrency(item.priceCents * item.qty)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Order Footer Note & Total */}
                {order.note && (
                  <div className="flex items-start gap-1 text-[11px] text-zinc-400 bg-zinc-900/40 p-1.5 rounded border border-zinc-800/40">
                    <FileText className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
                    <span className="italic">{order.note}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-zinc-800/80 text-xs">
                  <span className="text-zinc-400">Order Subtotal</span>
                  <span className="font-bold font-mono text-white">
                    {formatCurrency(order.totalCents)}
                  </span>
                </div>

                {/* Feedback Message Banner */}
                {feedback && (
                  <div
                    className={`text-[11px] p-2 rounded flex items-center gap-1.5 ${
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

                {/* Primary Action Button */}
                {isPending && (
                  <button
                    onClick={() => handleAcceptOrder(order)}
                    disabled={isInFlight}
                    className="w-full mt-1.5 py-2 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-md shadow-orange-600/20"
                  >
                    {isInFlight ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Accepting & Generating KOT...</span>
                      </>
                    ) : (
                      <>
                        <ChefHat className="w-4 h-4" />
                        <span>Accept Order & Start Preparing</span>
                      </>
                    )}
                  </button>
                )}

                {/* Preparing Order KOT Reprint Option */}
                {isPreparing && (
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-blue-400" />
                      In Kitchen
                    </span>
                    <button
                      onClick={() => handleReprintKot(order)}
                      disabled={isInFlight}
                      className="text-[11px] font-medium text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-1 border border-zinc-700/50 transition-colors"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Print KOT</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
