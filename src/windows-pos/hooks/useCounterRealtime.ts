import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/db";
import { loadActiveCounterState } from "../services/counterSyncService";
import type { CounterTable, ConnectionStatus } from "../types/counterTypes";

export interface UseCounterRealtimeResult {
  tables: CounterTable[];
  channelOrders: CounterOrder[];
  selectedTable: CounterTable | null;
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  connectionStatus: ConnectionStatus;
  lastSyncedAt: Date | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  updateLocalOrderStatus: (orderId: string, newStatus: string) => void;
}

export function useCounterRealtime(cafeId: string | undefined): UseCounterRealtimeResult {
  const [tables, setTables] = useState<CounterTable[]>([]);
  const [channelOrders, setChannelOrders] = useState<CounterOrder[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isReconcilingRef = useRef<boolean>(false);
  const pendingReconcileRef = useRef<boolean>(false);

  // Authoritative reconciliation fetch
  const performReconciliation = useCallback(async () => {
    if (!cafeId) return;
    if (isReconcilingRef.current) {
      pendingReconcileRef.current = true;
      return;
    }

    isReconcilingRef.current = true;
    try {
      const state = await loadActiveCounterState(cafeId);
      setTables(state.tables);
      setChannelOrders(state.channelOrders || []);
      setLastSyncedAt(state.lastSyncedAt);

      // Auto-select first table if nothing is selected or previous selection no longer exists
      setSelectedTableId((currentSelected) => {
        if (currentSelected && state.tables.some((t) => t.id === currentSelected)) {
          return currentSelected;
        }
        return state.tables[0]?.id || null;
      });
    } catch (err) {
      console.error("[useCounterRealtime] Reconciliation error:", err);
    } finally {
      isReconcilingRef.current = false;
      setIsLoading(false);

      if (pendingReconcileRef.current) {
        pendingReconcileRef.current = false;
        void performReconciliation();
      }
    }
  }, [cafeId]);

  // Initial startup authoritative fetch
  useEffect(() => {
    if (!cafeId) return;
    setIsLoading(true);
    void performReconciliation();
  }, [cafeId, performReconciliation]);

  // Realtime subscription + Connection monitoring
  useEffect(() => {
    if (!cafeId) return;

    setConnectionStatus("reconnecting");

    const channelName = `counter-pos-${cafeId}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `cafe_id=eq.${cafeId}`,
        },
        () => {
          // Authoritative reconciliation ensures full consistency
          void performReconciliation();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dining_sessions",
        },
        () => {
          void performReconciliation();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tables",
          filter: `cafe_id=eq.${cafeId}`,
        },
        () => {
          void performReconciliation();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("reconnecting");
        } else if (status === "CLOSED") {
          setConnectionStatus("disconnected");
        }
      });

    // Browser network event listeners for reconnect reconciliation
    const handleOnline = () => {
      setConnectionStatus("connected");
      void performReconciliation();
    };

    const handleOffline = () => {
      setConnectionStatus("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      void supabase.removeChannel(channel);
    };
  }, [cafeId, performReconciliation]);

  const updateLocalOrderStatus = useCallback((orderId: string, newStatus: string) => {
    setTables((prevTables) =>
      prevTables.map((tbl) => ({
        ...tbl,
        orders: tbl.orders.map((ord) =>
          ord.id === orderId ? { ...ord, status: newStatus } : ord
        ),
      }))
    );
    setChannelOrders((prevOrders) =>
      prevOrders.map((ord) =>
        ord.id === orderId ? { ...ord, status: newStatus } : ord
      )
    );
  }, []);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || null;

  return {
    tables,
    channelOrders,
    selectedTable,
    selectedTableId,
    setSelectedTableId,
    connectionStatus,
    lastSyncedAt,
    isLoading,
    refresh: performReconciliation,
    updateLocalOrderStatus,
  };
}
