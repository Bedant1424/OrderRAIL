/**
 * Billing Domain Types
 * Single source of truth for OrderRail financial data architecture.
 */

export type OrderType = 'DINE_IN' | 'TAKEAWAY';

export type PaymentStatus = 
  | 'PENDING'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'MIXED';

export interface BillItemSnapshot {
  id?: string;
  bill_id?: string;
  menu_item_id?: string | null;
  item_name: string;
  category_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  line_total: number;
  special_instructions?: string | null;
}

export interface Bill {
  id: string;
  bill_number: number;
  cafe_id: string;
  session_id: string;
  table_id?: string | null;
  cashier_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
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
  notes?: string | null;
  created_at: string;
  paid_at?: string | null;
  closed_at?: string | null;
}

export interface BillWithItems extends Bill {
  items: BillItemSnapshot[];
}

export interface RawInputItem {
  id?: string;
  menuItemId?: string;
  name: string;
  category?: string;
  price: number;
  qty: number;
  notes?: string;
}

export interface BillCalculationOptions {
  discountAmt?: number;
  discountPct?: number;
  serviceChargeAmt?: number;
  serviceChargePct?: number;
  cgstRatePct?: number; // Default e.g. 2.5%
  sgstRatePct?: number; // Default e.g. 2.5%
}

export interface BillCalculationResult {
  subtotal: number;
  discount: number;
  service_charge: number;
  cgst: number;
  sgst: number;
  round_off: number;
  grand_total: number;
  total_items: number;
  itemSnapshots: BillItemSnapshot[];
}
