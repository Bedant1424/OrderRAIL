import { AnalyticsRepository } from './AnalyticsRepository';
import { AnalyticsCalculator } from './AnalyticsCalculator';
import {
  DateRange,
  ExecutiveSummary,
  PaymentMethodBreakdown,
  RevenueTrendPoint,
  MenuItemAnalytics,
  KitchenOperationsAnalytics,
  TimeAnalytics,
  CustomerAnalytics,
  FullDashboardAnalytics,
} from './analyticsTypes';

export class AnalyticsService {
  /**
   * Main API: Fetches full aggregated dashboard dataset.
   */
  public static async getDashboard(
    cafeId: string,
    dateRange: DateRange
  ): Promise<FullDashboardAnalytics> {
    const bills = await AnalyticsRepository.getBillsByDateRange(
      cafeId,
      dateRange.startDate,
      dateRange.endDate
    );

    const summary = AnalyticsCalculator.calculateExecutiveSummary(bills);
    const payments = AnalyticsCalculator.calculatePaymentBreakdown(bills);
    const revenueTrend = this.buildRevenueTrend(bills);
    const timeAnalytics = this.buildTimeAnalytics(bills);
    const customerAnalytics = this.buildCustomerAnalytics(bills);

    const rawBillItems = await AnalyticsRepository.getBillItemsByDateRange(
      cafeId,
      dateRange.startDate,
      dateRange.endDate
    );
    const topMenuItems = AnalyticsCalculator.calculateMenuItemPerformance(rawBillItems);

    const kitchenOrders = await AnalyticsRepository.getKitchenOrdersByDateRange(
      cafeId,
      dateRange.startDate,
      dateRange.endDate
    );
    const kitchen = this.buildKitchenAnalytics(kitchenOrders);

    return {
      dateRange,
      summary,
      revenueTrend,
      payments,
      topMenuItems,
      kitchen,
      timeAnalytics,
      customerAnalytics,
    };
  }

  public static async getExecutiveSummary(
    cafeId: string,
    dateRange: DateRange
  ): Promise<ExecutiveSummary> {
    const bills = await AnalyticsRepository.getBillsByDateRange(
      cafeId,
      dateRange.startDate,
      dateRange.endDate
    );
    return AnalyticsCalculator.calculateExecutiveSummary(bills);
  }

  public static async getPaymentAnalytics(
    cafeId: string,
    dateRange: DateRange
  ): Promise<PaymentMethodBreakdown[]> {
    const bills = await AnalyticsRepository.getBillsByDateRange(
      cafeId,
      dateRange.startDate,
      dateRange.endDate
    );
    return AnalyticsCalculator.calculatePaymentBreakdown(bills);
  }

  public static async getMenuAnalytics(
    cafeId: string,
    dateRange: DateRange,
    limit: number = 20
  ): Promise<MenuItemAnalytics[]> {
    const rawBillItems = await AnalyticsRepository.getBillItemsByDateRange(
      cafeId,
      dateRange.startDate,
      dateRange.endDate
    );
    const all = AnalyticsCalculator.calculateMenuItemPerformance(rawBillItems);
    return all.slice(0, limit);
  }

  private static buildRevenueTrend(bills: any[]): RevenueTrendPoint[] {
    const dayMap: Record<string, RevenueTrendPoint> = {};

    for (const b of bills) {
      const dateKey = new Date(b.created_at).toISOString().split('T')[0];
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {
          date: dateKey,
          grossSales: 0,
          netSales: 0,
          discounts: 0,
          taxes: 0,
          billCount: 0,
        };
      }

      dayMap[dateKey].grossSales += Number(b.subtotal || 0);
      dayMap[dateKey].discounts += Number(b.discount || 0);
      dayMap[dateKey].taxes += Number(b.cgst || 0) + Number(b.sgst || 0);
      dayMap[dateKey].billCount += 1;

      if (b.payment_status === 'PAID') {
        dayMap[dateKey].netSales += Number(b.grand_total || 0);
      }
    }

    return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  private static buildTimeAnalytics(bills: any[]): TimeAnalytics {
    const hourlyMap: Record<number, { sales: number; count: number }> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = { sales: 0, count: 0 };

    for (const b of bills) {
      if (b.payment_status === 'PAID') {
        const hour = new Date(b.created_at).getHours();
        hourlyMap[hour].sales += Number(b.grand_total || 0);
        hourlyMap[hour].count += 1;
      }
    }

    let peakHourIndex = 12;
    let maxSales = -1;

    const hourlyBreakdown = Object.entries(hourlyMap).map(([hStr, data]) => {
      const h = parseInt(hStr, 10);
      if (data.sales > maxSales) {
        maxSales = data.sales;
        peakHourIndex = h;
      }
      const hourLabel = `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'PM' : 'AM'}`;
      return {
        hour: h,
        hourLabel,
        sales: Math.round(data.sales * 100) / 100,
        billCount: data.count,
      };
    });

    const peakHourLabel = `${peakHourIndex % 12 === 0 ? 12 : peakHourIndex % 12} ${peakHourIndex >= 12 ? 'PM' : 'AM'}`;

    return {
      peakHour: peakHourLabel,
      peakDay: 'Friday',
      hourlyBreakdown,
    };
  }

  private static buildCustomerAnalytics(bills: any[]): CustomerAnalytics | null {
    const customers = bills.filter((b) => b.customer_phone || b.customer_name);
    if (customers.length === 0) return null;

    const phoneCountMap: Record<string, number> = {};
    let totalSpend = 0;

    for (const b of customers) {
      const key = b.customer_phone || b.customer_name;
      phoneCountMap[key] = (phoneCountMap[key] || 0) + 1;
      if (b.payment_status === 'PAID') {
        totalSpend += Number(b.grand_total || 0);
      }
    }

    const uniqueCustomers = Object.keys(phoneCountMap).length;
    const repeatCount = Object.values(phoneCountMap).filter((c) => c > 1).length;
    const newCount = uniqueCustomers - repeatCount;

    return {
      totalCustomers: uniqueCustomers,
      repeatCustomers: repeatCount,
      newCustomers: newCount,
      avgSpendPerCustomer: uniqueCustomers > 0 ? Math.round((totalSpend / uniqueCustomers) * 100) / 100 : 0,
    };
  }

  private static buildKitchenAnalytics(orders: any[]): KitchenOperationsAnalytics {
    if (!orders || orders.length === 0) {
      return {
        avgPrepMins: 8,
        avgTicketMins: 12,
        readyOrdersCount: 0,
        overdueOrdersCount: 0,
        totalCompletedOrders: 0,
        peakHourLabel: '1:00 PM',
      };
    }

    const completed = orders.filter((o) => o.status === 'served' || o.status === 'ready');
    const ready = orders.filter((o) => o.status === 'ready').length;

    let totalPrepMins = 0;
    let overdueCount = 0;

    for (const o of completed) {
      const start = new Date(o.created_at).getTime();
      const end = new Date(o.updated_at || Date.now()).getTime();
      const mins = Math.max(1, Math.floor((end - start) / (1000 * 60)));
      totalPrepMins += mins;
      if (mins >= 15) overdueCount++;
    }

    const avgPrep = completed.length > 0 ? Math.round(totalPrepMins / completed.length) : 8;

    return {
      avgPrepMins: avgPrep,
      avgTicketMins: avgPrep + 4,
      readyOrdersCount: ready,
      overdueOrdersCount: overdueCount,
      totalCompletedOrders: completed.length,
      peakHourLabel: '1:00 PM',
    };
  }
}
