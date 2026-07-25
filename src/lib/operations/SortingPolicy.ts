import { compareTableLabels } from '@/lib/tables/naturalTableSort';

export interface SortableTable {
  id: string;
  label: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING_REQUIRED' | string;
  sessionStartTimeMs?: number | null;
}

export interface SortableOrder {
  id: string;
  order_number?: number;
  status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED' | string;
  created_at: string;
  updated_at?: string | null;
}

export class SortingPolicy {
  /**
   * Counter Table Sorting Policy:
   * 1. Status Priority: OCCUPIED (1) -> RESERVED (2) -> CLEANING_REQUIRED (3) -> AVAILABLE (4)
   * 2. Within OCCUPIED: Oldest active session first (longest waiting guests)
   * 3. Otherwise: Alphanumeric natural table label sorting (e.g. 1, 2, 10, T-01)
   */
  public static sortCounterTables<T extends SortableTable>(tables: T[]): T[] {
    const statusPriority: Record<string, number> = {
      OCCUPIED: 1,
      RESERVED: 2,
      CLEANING_REQUIRED: 3,
      AVAILABLE: 4,
    };

    return [...tables].sort((a, b) => {
      const pA = statusPriority[a.status] ?? 5;
      const pB = statusPriority[b.status] ?? 5;

      if (pA !== pB) {
        return pA - pB;
      }

      // Within OCCUPIED: Oldest active session first
      if (a.status === 'OCCUPIED' && b.status === 'OCCUPIED') {
        const timeA = a.sessionStartTimeMs ?? Number.MAX_SAFE_INTEGER;
        const timeB = b.sessionStartTimeMs ?? Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) {
          return timeA - timeB;
        }
      }

      // Natural label fallback
      return compareTableLabels(a.label, b.label);
    });
  }

  /**
   * Staff Console Queue Sorting Policy:
   * - Incoming (NEW): Oldest first (FIFO)
   * - In Progress (PREPARING): Oldest first (FIFO)
   * - Ready (READY): Oldest first (FIFO)
   * - Completed (SERVED / CANCELLED): Newest first (LIFO)
   */
  public static sortStaffOrders<T extends SortableOrder>(orders: T[]): T[] {
    return [...orders].sort((a, b) => {
      const isAActive = a.status === 'NEW' || a.status === 'PREPARING' || a.status === 'READY';
      const isBActive = b.status === 'NEW' || b.status === 'PREPARING' || b.status === 'READY';

      if (isAActive && isBActive) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (!isAActive && !isBActive) {
        const timeA = new Date(a.updated_at || a.created_at).getTime();
        const timeB = new Date(b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      }

      return isAActive ? -1 : 1;
    });
  }

  /**
   * Customer Order History & Live Tracking Sorting Policy:
   * - Active orders first, sorted oldest first (FIFO)
   * - Completed / Cancelled orders after, sorted newest first
   */
  public static sortCustomerOrders<T extends SortableOrder>(orders: T[]): T[] {
    return this.sortStaffOrders(orders);
  }
}
