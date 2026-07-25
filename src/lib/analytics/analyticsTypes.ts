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
