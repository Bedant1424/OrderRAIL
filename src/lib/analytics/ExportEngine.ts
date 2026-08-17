import { Bill } from '../billing/types';
import {
  ExecutiveSummary,
  PaymentMethodBreakdown,
  MenuItemAnalytics,
  KitchenOperationsAnalytics,
} from './analyticsTypes';

export class ExportEngine {
  /**
   * Generates CSV for Bills list.
   */
  public static exportBillsToCsv(bills: Bill[]): string {
    const headers = [
      'Bill Number',
      'Date',
      'Order Type',
      'Customer Name',
      'Payment Status',
      'Payment Method',
      'Total Items',
      'Subtotal (₹)',
      'Discount (₹)',
      'Service Charge (₹)',
      'CGST (₹)',
      'SGST (₹)',
      'Grand Total (₹)',
    ];

    const rows = bills.map((b) => [
      b.bill_number,
      new Date(b.created_at).toLocaleString('en-IN'),
      b.order_type,
      b.customer_name || 'N/A',
      b.payment_status,
      b.payment_method,
      b.total_items,
      b.subtotal.toFixed(2),
      b.discount.toFixed(2),
      b.service_charge.toFixed(2),
      b.cgst.toFixed(2),
      b.sgst.toFixed(2),
      b.grand_total.toFixed(2),
    ]);

    return [headers.join(','), ...rows.map((r) => r.map(ExportEngine.escapeCsv).join(','))].join('\n');
  }

  /**
   * Generates CSV for Executive Revenue summary.
   */
  public static exportRevenueToCsv(summary: ExecutiveSummary): string {
    const rows = [
      ['Metric', 'Value (₹ / Count)'],
      ['Gross Sales', summary.grossSales.toFixed(2)],
      ['Net Sales', summary.netSales.toFixed(2)],
      ['Total Discounts', summary.totalDiscounts.toFixed(2)],
      ['Total Service Charges', summary.totalServiceCharges.toFixed(2)],
      ['CGST Collected', summary.totalCgst.toFixed(2)],
      ['SGST Collected', summary.totalSgst.toFixed(2)],
      ['Round Off', summary.totalRoundOff.toFixed(2)],
      ['Total Bills', summary.totalBills.toString()],
      ['Paid Bills', summary.paidBills.toString()],
      ['Pending Bills', summary.pendingBills.toString()],
      ['Cancelled Bills', summary.cancelledBills.toString()],
      ['Refunded Bills', summary.refundedBills.toString()],
      ['Average Bill Value', summary.avgBillValue.toFixed(2)],
      ['Average Items Per Bill', summary.avgItemsPerBill.toString()],
    ];

    return rows.map((r) => r.map(ExportEngine.escapeCsv).join(',')).join('\n');
  }

  /**
   * Generates CSV for Payment Breakdown.
   */
  public static exportPaymentsToCsv(payments: PaymentMethodBreakdown[]): string {
    const headers = ['Payment Method', 'Transaction Count', 'Total Amount (₹)', 'Share (%)'];
    const rows = payments.map((p) => [
      p.method,
      p.count.toString(),
      p.amount.toFixed(2),
      `${p.percentage}%`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.map(ExportEngine.escapeCsv).join(','))].join('\n');
  }

  /**
   * Generates CSV for Menu Item Performance.
   */
  public static exportMenuAnalyticsToCsv(items: MenuItemAnalytics[]): string {
    const headers = [
      'Item Name',
      'Quantity Sold',
      'Avg Unit Price (₹)',
      'Total Revenue (₹)',
      'Revenue Share (%)',
    ];

    const rows = items.map((i) => [
      i.itemName,
      i.quantitySold.toString(),
      i.avgUnitPrice.toFixed(2),
      i.totalRevenue.toFixed(2),
      `${i.revenuePercentage}%`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.map(ExportEngine.escapeCsv).join(','))].join('\n');
  }

  /**
   * Helper to trigger browser download of a CSV file.
   */
  public static downloadCsv(csvContent: string, filename: string): void {
    if (typeof window === 'undefined') return;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generates CSV for Customer Directory profiles.
   */
  public static exportCustomersToCsv(profiles: Array<{
    name: string;
    phone?: string | null;
    visitCount: number;
    lifetimeSpendCents: number;
    averageBillCents: number;
    firstVisit: string;
    lastVisit: string;
    preferredChannel: string;
  }>): string {
    const headers = [
      'Customer Name',
      'Phone',
      'Visits',
      'Lifetime Spend (₹)',
      'Average Bill (₹)',
      'First Visit',
      'Last Visit',
      'Preferred Channel',
    ];

    const rows = profiles.map((p) => [
      p.name,
      p.phone || 'N/A',
      p.visitCount,
      (p.lifetimeSpendCents / 100).toFixed(2),
      (p.averageBillCents / 100).toFixed(2),
      p.firstVisit ? new Date(p.firstVisit).toLocaleString('en-IN') : 'N/A',
      p.lastVisit ? new Date(p.lastVisit).toLocaleString('en-IN') : 'N/A',
      p.preferredChannel,
    ]);

    return [headers.join(','), ...rows.map((r) => r.map(ExportEngine.escapeCsv).join(','))].join('\n');
  }

  private static escapeCsv(value: string | number): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
