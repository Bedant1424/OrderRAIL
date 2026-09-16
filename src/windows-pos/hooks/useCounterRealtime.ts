import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/db";
import { loadActiveCounterState } from "../services/counterSyncService";
import { NetworkManager } from "@/lib/offline/networkManager";
import { SyncManager } from "@/lib/offline/syncManager";
import { OfflineEventBus } from "@/lib/offline/events";
import { getPendingOperations } from "@/lib/offline/indexedDbQueue";
import { orderIdMapping } from "@/lib/orders/orderService";
import type { CounterTable, CounterOrder, ConnectionStatus } from "../types/counterTypes";

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
  pendingSyncCount: number;
}

export function useCounterRealtime(cafeId: string | undefined): UseCounterRealtimeResult {
  const [tables, setTables] = useState<CounterTable[]>([]);
  const [channelOrders, setChannelOrders] = useState<CounterOrder[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    NetworkManager.isOnline() ? "connected" : "offline"
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

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
      // 1. Authoritative fetch (or cache fallback if network is down)
      const state = await loadActiveCounterState(cafeId);

      // 2. Fetch pending local offline operations to overlay onto state
      let pendingOps: any[] = [];
      try {
        pendingOps = await getPendingOperations();
      } catch {
        pendingOps = [];
      }

      const pendingOrderOps = pendingOps.filter(
        (op) =>
          (op.operationType === "CREATE_ORDER" || op.operationType === "CREATE_COUNTER_ORDER") &&
          op.payload?.cafe_id === cafeId
      );

      setPendingSyncCount(pendingOrderOps.length);

      let mergedTables = [...state.tables];
      let mergedChannelOrders = [...(state.channelOrders || [])];

      // Overlay pending offline orders that have not yet synced to Supabase
      for (const op of pendingOrderOps) {
        const payload = op.payload;
        const realId = orderIdMapping.get(payload.id) || payload.id;

        const existsInTables = mergedTables.some((t) =>
          t.orders.some((o) => o.id === realId || o.id === payload.id)
        );
        const existsInChannelOrders = mergedChannelOrders.some(
          (o) => o.id === realId || o.id === payload.id
        );

        if (!existsInTables && !existsInChannelOrders) {
          const pendingOrder: CounterOrder = {
            id: payload.id,
            orderNumber: payload.daily_order_number ?? payload.order_number ?? 9000,
            tableId: payload.table_id || null,
            diningSessionId: payload.dining_session_id || null,
            status: payload.status || "preparing",
            orderSource: payload.order_source || "TAKEAWAY",
            createdAt: payload.created_at || op.createdAt || new Date().toISOString(),
            totalCents: payload.total_cents || 0,
            customerName: payload.customer_name || null,
            customerPhone: payload.customer_phone || null,
            externalOrderRef: payload.external_order_ref || null,
            note: payload.note || null,
            syncStatus: "PENDING_SYNC",
            isOfflineCreated: true,
            items: (payload.items || []).map((i: any) => ({
              id: i.id || crypto.randomUUID(),
              menuItemId: i.menu_item_id,
              name: i.name,
              priceCents: i.price_cents,
              qty: i.qty,
              note: i.note,
            })),
          };

          if (payload.order_source === "DINE_IN" && payload.table_id) {
            mergedTables = mergedTables.map((t) => {
              if (t.id === payload.table_id) {
                return {
                  ...t,
                  status: "occupied",
                  orders: [...t.orders, pendingOrder],
                  unbilledTotalCents: t.unbilledTotalCents + pendingOrder.totalCents,
                };
              }
              return t;
            });
          } else {
            mergedChannelOrders.push(pendingOrder);
          }
        }
      }

      setTables(mergedTables);
      setChannelOrders(mergedChannelOrders);
      setLastSyncedAt(state.lastSyncedAt);

      // Auto-select first table if nothing is selected or previous selection no longer exists
      setSelectedTableId((currentSelected) => {
        if (currentSelected && mergedTables.some((t) => t.id === currentSelected)) {
          return currentSelected;
        }
        return mergedTables[0]?.id || null;
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

    // Browser online/offline listeners for window events
    const handleOnline = () => {
      setConnectionStatus("connected");
      void SyncManager.startSync();
      void performReconciliation();
    };

    const handleOffline = () => {
      setConnectionStatus("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // NetworkManager and OfflineEventBus listeners for offline resilience and sync
    const unsubNet = NetworkManager.subscribe((netState) => {
      if (!netState.isOnline) {
        setConnectionStatus("offline");
      }
    });

    const unsubConnected = OfflineEventBus.on("NetworkConnected", () => {
      setConnectionStatus("connected");
      void SyncManager.startSync();
    });

    const unsubDisconnected = OfflineEventBus.on("NetworkDisconnected", () => {
      setConnectionStatus("offline");
    });

    const unsubSyncCompleted = OfflineEventBus.on("SyncCompleted", (payload) => {
      if (payload && payload.processed > 0) {
        void performReconciliation();
      }
    });

    const unsubQueueChanged = OfflineEventBus.on("QueueChanged", () => {
      void performReconciliation();
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubNet();
      unsubConnected();
      unsubDisconnected();
      unsubSyncCompleted();
      unsubQueueChanged();
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
    pendingSyncCount,
  };
}
