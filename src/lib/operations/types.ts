import type { PaymentMethod, PaymentStatus, OrderType } from '@/lib/billing/types';

/**
 * Canonical Domain Entity Interfaces
 * Centralized, normalized DTOs for OrderRail operational architecture.
 */

export interface TableEntity {
  id: string; // PostgreSQL UUID
  label: string; // Human display label ("1", "Table 4")
  seats: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'OUT_OF_SERVICE' | string;
  currentSessionId?: string | null; // PostgreSQL UUID
  sessionStartTimeMs?: number;
  notes?: string | null;
}

export interface DiningSessionEntity {
  id: string; // PostgreSQL UUID
  cafe_id: string; // PostgreSQL UUID
  table_id: string; // PostgreSQL UUID
  status: 'ACTIVE' | 'PAYMENT_PENDING' | 'CLOSED' | string;
  created_at: string;
  closed_at?: string | null;
}

export interface OrderEntity {
  id: string; // PostgreSQL UUID
  order_number: number; // Sequential integer (Display #)
  cafe_id: string; // PostgreSQL UUID
  table_id: string; // PostgreSQL UUID
  dining_session_id?: string | null; // PostgreSQL UUID
  status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED' | string;
  total_cents: number;
  created_at: string;
  updated_at?: string | null;
}

export interface BillEntity {
  id: string; // PostgreSQL UUID
  bill_number: number; // Sequential integer (Bill #)
  cafe_id: string; // PostgreSQL UUID
  session_id: string; // PostgreSQL UUID
  table_id?: string | null; // PostgreSQL UUID (Not string label)
  order_type: OrderType;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  service_charge: number;
  cgst: number;
  sgst: number;
  round_off: number;
  grand_total: number;
  total_items: number;
  created_at: string;
  paid_at?: string | null;
}

export interface ServiceRequestEntity {
  id: string; // PostgreSQL UUID
  cafe_id: string; // PostgreSQL UUID
  table_id: string; // PostgreSQL UUID
  dining_session_id?: string | null; // PostgreSQL UUID
  type: 'water' | 'bill' | 'call_staff' | 'cleaning' | string;
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed' | string;
  created_at: string;
  updated_at?: string | null;
}
