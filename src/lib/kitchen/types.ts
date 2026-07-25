/**
 * Kitchen Domain Types
 * Single source of truth for OrderRail Kitchen Operations & KOT Engine.
 */

export type KotPriority = 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';

export type KitchenStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED';

export interface KitchenTicketItem {
  id?: string;
  name: string;
  qty: number;
  notes?: string | null;
  isPrepared?: boolean;
}

export interface KitchenTicket {
  id: string;
  orderNumber: number;
  tableLabel: string;
  orderType: 'DINE_IN' | 'TAKEAWAY';
  timestamp: string;
  createdAtMs: number;
  status: KitchenStatus;
  items: KitchenTicketItem[];
  priority: KotPriority;
  elapsedMins: number;
}

export interface KitchenMetrics {
  activeTickets: number;
  preparingTickets: number;
  readyTickets: number;
  avgPrepMins: number;
  overdueTickets: number;
}
