import React, { useState } from "react";
import { useCafe } from "@/lib/cafe";
import { useCounterRealtime } from "../hooks/useCounterRealtime";
import { CounterHeader } from "../components/CounterHeader";
import { TableGrid } from "../components/TableGrid";
import { OrderDetailsPanel } from "../components/OrderDetailsPanel";
import { ChannelOrdersView } from "../components/ChannelOrdersView";
import { ChannelOrderEntryModal } from "../components/ChannelOrderEntryModal";
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
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);

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
        onSelectChannel={setActiveChannel}
        onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {activeChannel === "DINE_IN" ? (
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
            />
          </>
        ) : (
          <ChannelOrdersView
            channel={activeChannel}
            orders={channelOrders}
            cafeName={cafe?.name || "Cheese Corner"}
            onOrderUpdated={updateLocalOrderStatus}
            onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
          />
        )}
      </main>

      {/* Order Entry Modal */}
      <ChannelOrderEntryModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        channel={activeChannel}
        cafeId={effectiveCafeId}
        cafeName={cafe?.name || "Cheese Corner"}
        tables={tables}
        selectedTableId={selectedTableId}
        onOrderCreated={() => {
          void refresh();
        }}
      />
    </div>
  );
};

export default WindowsCounterApp;
