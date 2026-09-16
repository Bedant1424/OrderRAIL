import React from "react";
import { useCafe } from "@/lib/cafe";
import { useCounterRealtime } from "../hooks/useCounterRealtime";
import { CounterHeader } from "../components/CounterHeader";
import { TableGrid } from "../components/TableGrid";
import { OrderDetailsPanel } from "../components/OrderDetailsPanel";

export const WindowsCounterApp: React.FC = () => {
  const { cafe, cafeId } = useCafe();

  // Cheese Corner canonical fallback if context is initializing
  const effectiveCafeId = cafeId || cafe?.id || "8c418a5a-7cd4-4054-8a88-f412c1762f7d";

  const {
    tables,
    selectedTable,
    selectedTableId,
    setSelectedTableId,
    connectionStatus,
    lastSyncedAt,
    isLoading,
    refresh,
    updateLocalOrderStatus,
  } = useCounterRealtime(effectiveCafeId);

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      {/* Top Header Station Bar */}
      <CounterHeader
        cafeName={cafe?.name || "Cheese Corner"}
        connectionStatus={connectionStatus}
        lastSyncedAt={lastSyncedAt}
        isLoading={isLoading}
        onRefresh={refresh}
      />

      {/* Main Workspace (Left Grid + Right Order Details) */}
      <main className="flex-1 flex overflow-hidden">
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
      </main>
    </div>
  );
};

export default WindowsCounterApp;
