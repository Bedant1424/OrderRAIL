import React, { useState, useMemo } from "react";
import { useCafe } from "@/lib/cafe";
import { useCounterRealtime } from "../hooks/useCounterRealtime";
import { CounterHeader } from "../components/CounterHeader";
import { TableGrid } from "../components/TableGrid";
import { OrderDetailsPanel } from "../components/OrderDetailsPanel";
import { ChannelOrdersView } from "../components/ChannelOrdersView";
import { OrderEntryView } from "../components/OrderEntryView";
import type { OrderSource } from "../types/counterTypes";

export const WindowsCounterApp: React.FC = () => {
  const { cafe, cafeId } = useCafe();

  // Cheese Corner canonical fallback if context is initializing
  const effectiveCafeId = cafeId || cafe?.id || "8c418a5a-7cd4-4054-8a88-f412c1762f7d";

  const {
    tables,
    channelOrders,
    selectedTable,
    selectedTableId,
    setSelectedTableId,
    connectionStatus,
    lastSyncedAt,
    isLoading,
    refresh,
    updateLocalOrderStatus,
  } = useCounterRealtime(effectiveCafeId);

  const [activeChannel, setActiveChannel] = useState<OrderSource>("DINE_IN");
  const [mode, setMode] = useState<"MONITOR" | "ORDER_ENTRY">("MONITOR");

  // Dynamic order / active table counts for each channel badge
  const channelCounts = useMemo(() => {
    const dineInCount = tables.filter(
      (t) => t.status === "occupied" || (t.orders && t.orders.some((o) => o.status !== "cancelled"))
    ).length;

    const takeawayCount = channelOrders.filter(
      (o) => o.orderSource === "TAKEAWAY" && o.status !== "cancelled"
    ).length;

    const swiggyCount = channelOrders.filter(
      (o) => o.orderSource === "SWIGGY" && o.status !== "cancelled"
    ).length;

    const zomatoCount = channelOrders.filter(
      (o) => o.orderSource === "ZOMATO" && o.status !== "cancelled"
    ).length;

    return {
      DINE_IN: dineInCount,
      TAKEAWAY: takeawayCount,
      SWIGGY: swiggyCount,
      ZOMATO: zomatoCount,
    };
  }, [tables, channelOrders]);

  const handlePunchOrderForTable = (tableId: string) => {
    setSelectedTableId(tableId);
    setActiveChannel("DINE_IN");
    setMode("ORDER_ENTRY");
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      {/* Top Header Station Bar */}
      <CounterHeader
        cafeName={cafe?.name || "Cheese Corner"}
        connectionStatus={connectionStatus}
        lastSyncedAt={lastSyncedAt}
        isLoading={isLoading}
        onRefresh={refresh}
        activeChannel={activeChannel}
        onSelectChannel={(ch) => {
          setActiveChannel(ch);
        }}
        onOpenNewOrder={() => setMode("ORDER_ENTRY")}
        channelCounts={channelCounts}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex overflow-hidden">
        {mode === "ORDER_ENTRY" ? (
          <OrderEntryView
            channel={activeChannel}
            cafeId={effectiveCafeId}
            cafeName={cafe?.name || "Cheese Corner"}
            tables={tables}
            selectedTableId={selectedTableId}
            onSelectTable={setSelectedTableId}
            onOrderSubmitted={() => {
              void refresh();
              setMode("MONITOR");
            }}
            onClose={() => setMode("MONITOR")}
          />
        ) : activeChannel === "DINE_IN" ? (
          <>
            <TableGrid
              tables={tables}
              selectedTableId={selectedTableId}
              onSelectTable={setSelectedTableId}
            />

            <OrderDetailsPanel
              table={selectedTable}
              cafeName={cafe?.name || "Cheese Corner"}
              onOrderUpdated={updateLocalOrderStatus}
              onPunchOrderForTable={handlePunchOrderForTable}
            />
          </>
        ) : (
          <ChannelOrdersView
            channel={activeChannel}
            orders={channelOrders}
            cafeName={cafe?.name || "Cheese Corner"}
            onOrderUpdated={updateLocalOrderStatus}
            onOpenNewOrder={() => setMode("ORDER_ENTRY")}
          />
        )}
      </main>
    </div>
  );
};

export default WindowsCounterApp;
