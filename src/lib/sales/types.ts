/**
 * Daily Sales Domain Types
 * Single source of truth for OrderRail authoritative daily sales report contracts.
 */

export interface DailySalesTenders {
  cash: number;
  upi: number;
  card: number;
  other: number;
}

export interface DailySalesPipeline {
  unsettled_orders_count: number;
  unsettled_pipeline_cents: number;
  cancelled_orders_count: number;
}

export interface DailySalesHourlyBucket {
  hour: number;
  label: string;
  revenue: number;
  paid_bills: number;
  items_sold: number;
  cash: number;
  upi: number;
  card: number;
  other: number;
}

export interface DailySalesReport {
  business_date: string;
  cafe_id: string;
  net_collected: number;
  gross_subtotal: number;
  total_discounts: number;
  total_tax: number;
  cgst: number;
  sgst: number;
  total_service_charge: number;
  total_round_off: number;
  paid_bills_count: number;
  total_items_sold: number;
  average_bill_value: number;
  tenders: DailySalesTenders;
  hourly: DailySalesHourlyBucket[];
  pipeline: DailySalesPipeline;
}

export interface DailySalesTransactionItem {
  item_name: string;
  quantity: number;
  line_total: number;
}

export interface DailySalesTransaction {
  bill_id: string;
  bill_number: number;
  table_label: string;
  order_source: string;
  customer_name: string | null;
  customer_phone: string | null;
  cashier_id: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  service_charge: number;
  round_off: number;
  grand_total: number;
  total_items: number;
  paid_at: string;
  business_date: string;
  items: DailySalesTransactionItem[];
  tenders?: {
    method: string;
    amount: number;
    tendered_amount?: number;
    change_due?: number;
    transaction_ref?: string;
  }[];
}

export interface DailySalesTransactionsResponse {
  business_date: string;
  cafe_id: string;
  transactions: DailySalesTransaction[];
}

export interface DailySalesServiceOptions {
  forceRefresh?: boolean;
}
