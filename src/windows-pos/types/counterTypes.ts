export type OrderSource = 'DINE_IN' | 'TAKEAWAY' | 'SWIGGY' | 'ZOMATO';

export interface CounterOrderItem {
  id: string;
  menuItemId?: string | null;
  name: string;
  priceCents: number;
  qty: number;
  note?: string | null;
}

export type OrderSyncStatus = 'SYNCED' | 'PENDING_SYNC' | 'FAILED_SYNC';

export interface CounterOrder {
  id: string;
  orderNumber: number;
  tableId?: string | null;
  diningSessionId?: string | null;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'paid' | string;
  orderSource: OrderSource;
  createdAt: string;
  totalCents: number;
  customerName?: string | null;
  customerPhone?: string | null;
  externalOrderRef?: string | null;
  note?: string | null;
  items: CounterOrderItem[];
  syncStatus?: OrderSyncStatus;
  isOfflineCreated?: boolean;
  offlineErrorMessage?: string | null;
}

export interface CounterTable {
  id: string;
  label: string;
  status: 'available' | 'occupied' | 'cleaning' | string;
  activeSessionId?: string | null;
  sessionStartedAt?: string | null;
  orders: CounterOrder[];
  unbilledTotalCents: number;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'offline';

export interface CounterState {
  tables: CounterTable[];
  selectedTableId: string | null;
  connectionStatus: ConnectionStatus;
  lastSyncedAt: Date | null;
  isLoading: boolean;
  error: string | null;
  pendingSyncCount?: number;
}
