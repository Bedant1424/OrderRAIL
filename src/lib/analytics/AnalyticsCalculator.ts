import { Bill, BillItem } from '../billing/types';
import {
  ExecutiveSummary,
  PaymentMethodBreakdown,
  RevenueTrendPoint,
  MenuItemAnalytics,
  TimeAnalytics,
} from './analyticsTypes';

export class AnalyticsCalculator {
  /**
   * Computes Executive KPI summary from array of Bills.
   */
  public static calculateExecutiveSummary(bills: Bill[]): ExecutiveSummary {
    let grossSales = 0;
    let netSales = 0;
    let totalDiscounts = 0;
    let totalServiceCharges = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalRoundOff = 0;
    let paidBills = 0;
    let pendingBills = 0;
    let cancelledBills = 0;
    let refundedBills = 0;
    let totalItems = 0;

    for (const b of bills) {
      grossSales += Number(b.subtotal || 0);
      totalDiscounts += Number(b.discount || 0);
      totalServiceCharges += Number(b.service_charge || 0);
      totalCgst += Number(b.cgst || 0);
      totalSgst += Number(b.sgst || 0);
      totalRoundOff += Number(b.round_off || 0);
      totalItems += Number(b.total_items || 0);

      if (b.payment_status === 'PAID') {
        paidBills++;
        netSales += Number(b.grand_total || 0);
      } else if (b.payment_status === 'PENDING') {
        pendingBills++;
      } else if (b.payment_status === 'CANCELLED') {
        cancelledBills++;
      } else if (b.payment_status === 'REFUNDED') {
        refundedBills++;
      }
    }

    const totalBills = bills.length;
    const avgBillValue = paidBills > 0 ? Math.round((netSales / paidBills) * 100) / 100 : 0;
    const avgItemsPerBill = totalBills > 0 ? Math.round((totalItems / totalBills) * 10) / 10 : 0;

    return {
      grossSales: Math.round(grossSales * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      totalServiceCharges: Math.round(totalServiceCharges * 100) / 100,
      totalCgst: Math.round(totalCgst * 100) / 100,
      totalSgst: Math.round(totalSgst * 100) / 100,
      totalRoundOff: Math.round(totalRoundOff * 100) / 100,
      totalBills,
      paidBills,
      pendingBills,
      cancelledBills,
      refundedBills,
      avgBillValue,
      avgItemsPerBill,
    };
  }

  /**
   * Computes payment method distribution (CASH, UPI, CARD, MIXED).
   */
  public static calculatePaymentBreakdown(bills: Bill[]): PaymentMethodBreakdown[] {
    const paidBills = bills.filter((b) => b.payment_status === 'PAID');
    const totalPaidAmount = paidBills.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);

    const map: Record<string, { count: number; amount: number }> = {
      CASH: { count: 0, amount: 0 },
      UPI: { count: 0, amount: 0 },
      CARD: { count: 0, amount: 0 },
      MIXED: { count: 0, amount: 0 },
    };

    for (const b of paidBills) {
      const method = b.payment_method || 'CASH';
      if (!map[method]) map[method] = { count: 0, amount: 0 };
      map[method].count += 1;
      map[method].amount += Number(b.grand_total || 0);
    }

    return Object.entries(map).map(([method, data]) => {
      const percentage =
        totalPaidAmount > 0 ? Math.round((data.amount / totalPaidAmount) * 1000) / 10 : 0;
      return {
        method: method as any,
        count: data.count,
        amount: Math.round(data.amount * 100) / 100,
        percentage,
      };
    });
  }

  /**
   * Aggregates menu item performance from bill items.
   */
  public static calculateMenuItemPerformance(items: BillItem[]): MenuItemAnalytics[] {
    const itemMap: Record<string, { qty: number; revenue: number; prices: number[] }> = {};

    for (const item of items) {
      const name = item.item_name;
      if (!itemMap[name]) {
        itemMap[name] = { qty: 0, revenue: 0, prices: [] };
      }
      itemMap[name].qty += Number(item.quantity || 0);
      itemMap[name].revenue += Number(item.line_total || 0);
      itemMap[name].prices.push(Number(item.unit_price || 0));
    }

    const totalCategoryRevenue = Object.values(itemMap).reduce((acc, i) => acc + i.revenue, 0);

    const results: MenuItemAnalytics[] = Object.entries(itemMap).map(([name, data]) => {
      const avgPrice =
        data.prices.length > 0
          ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length
          : 0;
      const revenuePercentage =
        totalCategoryRevenue > 0
          ? Math.round((data.revenue / totalCategoryRevenue) * 1000) / 10
          : 0;

      return {
        itemName: name,
        quantitySold: data.qty,
        totalRevenue: Math.round(data.revenue * 100) / 100,
        avgUnitPrice: Math.round(avgPrice * 100) / 100,
        revenuePercentage,
      };
    });

    return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }
}
