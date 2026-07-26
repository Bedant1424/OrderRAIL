import { compareTableLabels, sortTablesNatural } from '@/lib/tables/naturalTableSort';

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
  public static sortCounterTables<T extends SortableTable>(tables: T[]): T[] {
    return sortTablesNatural(tables);
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
