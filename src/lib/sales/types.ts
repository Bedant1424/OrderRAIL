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
  pipeline: DailySalesPipeline;
}

export interface DailySalesServiceOptions {
  forceRefresh?: boolean;
}
