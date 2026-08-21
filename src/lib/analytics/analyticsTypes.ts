import { PaymentMethod, PaymentStatus } from '../billing/types';

export type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';

export interface DateRange {
  startDate: string; // ISO string
  endDate: string;   // ISO string
  preset?: DatePreset;
}

export interface ExecutiveSummary {
  grossSales: number;
  netSales: number;
  totalDiscounts: number;
  totalServiceCharges: number;
  totalCgst: number;
  totalSgst: number;
  totalRoundOff: number;
  totalBills: number;
  paidBills: number;
  pendingBills: number;
  cancelledBills: number;
  refundedBills: number;
  avgBillValue: number;
  avgItemsPerBill: number;
}

export interface RevenueTrendPoint {
  date: string;
  grossSales: number;
  netSales: number;
  discounts: number;
  taxes: number;
  billCount: number;
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod;
  count: number;
  amount: number;
  percentage: number;
}

export interface MenuItemAnalytics {
  itemName: string;
  quantitySold: number;
  totalRevenue: number;
  avgUnitPrice: number;
  revenuePercentage: number;
}

export interface KitchenOperationsAnalytics {
  avgPrepMins: number;
  avgTicketMins: number;
  readyOrdersCount: number;
  overdueOrdersCount: number;
  totalCompletedOrders: number;
  peakHourLabel: string;
}

export interface TimeAnalytics {
  peakHour: string;
  peakDay: string;
  hourlyBreakdown: Array<{ hour: number; hourLabel: string; sales: number; billCount: number }>;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
  avgSpendPerCustomer: number;
}

export interface FullDashboardAnalytics {
  dateRange: DateRange;
  summary: ExecutiveSummary;
  revenueTrend: RevenueTrendPoint[];
  payments: PaymentMethodBreakdown[];
  topMenuItems: MenuItemAnalytics[];
  kitchen: KitchenOperationsAnalytics;
  timeAnalytics: TimeAnalytics;
  customerAnalytics: CustomerAnalytics | null;
}

/**
 * Authoritative Owner Analytics Range Contracts (Milestone 2C.3)
 */
export interface OwnerAnalyticsFinancialSummary {
  gross_subtotal: number;
  total_discounts: number;
  total_tax: number;
  cgst: number;
  sgst: number;
  total_service_charge: number;
  total_round_off: number;
  net_collected: number;
  paid_bills_count: number;
  total_items_sold: number;
  average_bill_value: number;
}

export interface OwnerAnalyticsDayPoint {
  business_date: string;
  day: string;
  revenue: number;
  gross_subtotal: number;
  paid_bills: number;
  items_sold: number;
}

export interface OwnerAnalyticsTopItem {
  name: string;
  qty: number;
  revenue: number;
  percentage: number;
}

export interface OwnerAnalyticsTenders {
  cash: number;
  upi: number;
  card: number;
  other: number;
}

export interface OwnerAnalyticsOperationalSummary {
  total_orders_placed: number;
  cancelled_orders_count: number;
  unsettled_orders_count: number;
  unsettled_pipeline_cents: number;
}

export interface OwnerAnalyticsRangeResponse {
  cafe_id: string;
  current_business_date: string;
  start_business_date: string;
  end_business_date: string;
  range_days: number;
  range_financials: OwnerAnalyticsFinancialSummary;
  today_financials: OwnerAnalyticsFinancialSummary;
  tenders: OwnerAnalyticsTenders;
  by_day: OwnerAnalyticsDayPoint[];
  top_items: OwnerAnalyticsTopItem[];
  operational_summary: OwnerAnalyticsOperationalSummary;
}
