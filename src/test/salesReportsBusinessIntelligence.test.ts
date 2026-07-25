import { describe, it, expect, beforeEach } from 'vitest';
import { Bill, BillItem } from '../lib/billing/types';
import {
  AnalyticsCalculator,
  AnalyticsService,
  ExportEngine,
  type DateRange,
} from '../lib/analytics';

describe('Sales Reports & Business Intelligence Tests', () => {
  const mockBills: Bill[] = [
    {
      id: 'b-1',
      bill_number: 101,
      cafe_id: 'cafe-analytics-1',
      session_id: 's-1',
      table_id: 'Table 1',
      cashier_id: 'c-1',
      customer_name: 'Alice',
      customer_phone: '9876543210',
      order_type: 'DINE_IN',
      payment_status: 'PAID',
      payment_method: 'UPI',
      subtotal: 500,
      discount: 50,
      service_charge: 25,
      cgst: 11.88,
      sgst: 11.88,
      round_off: 0.24,
      grand_total: 499,
      total_items: 3,
      notes: null,
      created_at: '2026-07-25T10:00:00.000Z',
    },
    {
      id: 'b-2',
      bill_number: 102,
      cafe_id: 'cafe-analytics-1',
      session_id: 's-2',
      table_id: 'Table 2',
      cashier_id: 'c-1',
      customer_name: 'Bob',
      customer_phone: null,
      order_type: 'TAKEAWAY',
      payment_status: 'PAID',
      payment_method: 'CASH',
      subtotal: 300,
      discount: 0,
      service_charge: 0,
      cgst: 7.5,
      sgst: 7.5,
      round_off: 0,
      grand_total: 315,
      total_items: 2,
      notes: null,
      created_at: '2026-07-25T11:00:00.000Z',
    },
    {
      id: 'b-3',
      bill_number: 103,
      cafe_id: 'cafe-analytics-1',
      session_id: 's-3',
      table_id: 'Table 3',
      cashier_id: null,
      customer_name: null,
      customer_phone: null,
      order_type: 'DINE_IN',
      payment_status: 'PENDING',
      payment_method: 'CASH',
      subtotal: 200,
      discount: 0,
      service_charge: 0,
      cgst: 5,
      sgst: 5,
      round_off: 0,
      grand_total: 210,
      total_items: 1,
      notes: null,
      created_at: '2026-07-25T12:00:00.000Z',
    },
  ];

  const mockBillItems: BillItem[] = [
    {
      id: 'bi-1',
      bill_id: 'b-1',
      menu_item_id: 'm-1',
      item_name: 'Cappuccino',
      unit_price: 150,
      quantity: 2,
      subtotal: 300,
      discount: 0,
      tax: 15,
      line_total: 300,
      created_at: '2026-07-25T10:00:00.000Z',
    },
    {
      id: 'bi-2',
      bill_id: 'b-1',
      menu_item_id: 'm-2',
      item_name: 'Avocado Toast',
      unit_price: 200,
      quantity: 1,
      subtotal: 200,
      discount: 50,
      tax: 10,
      line_total: 200,
      created_at: '2026-07-25T10:00:00.000Z',
    },
    {
      id: 'bi-3',
      bill_id: 'b-2',
      menu_item_id: 'm-1',
      item_name: 'Cappuccino',
      unit_price: 150,
      quantity: 2,
      subtotal: 300,
      discount: 0,
      tax: 15,
      line_total: 300,
      created_at: '2026-07-25T11:00:00.000Z',
    },
  ];

  it('1. AnalyticsCalculator: Executive KPI Summary accurately reconciles billing figures', () => {
    const summary = AnalyticsCalculator.calculateExecutiveSummary(mockBills);

    expect(summary.grossSales).toBe(1000); // 500 + 300 + 200
    expect(summary.netSales).toBe(814); // 499 + 315 (PAID bills only)
    expect(summary.totalDiscounts).toBe(50);
    expect(summary.totalServiceCharges).toBe(25);
    expect(summary.totalBills).toBe(3);
    expect(summary.paidBills).toBe(2);
    expect(summary.pendingBills).toBe(1);
    expect(summary.avgBillValue).toBe(407); // 814 / 2
  });

  it('2. AnalyticsCalculator: Payment breakdown calculates method totals and percentages correctly', () => {
    const payments = AnalyticsCalculator.calculatePaymentBreakdown(mockBills);

    const upi = payments.find((p) => p.method === 'UPI');
    const cash = payments.find((p) => p.method === 'CASH');

    expect(upi).toBeDefined();
    expect(upi?.amount).toBe(499);
    expect(cash?.amount).toBe(315);
    expect(upi?.count).toBe(1);
    expect(cash?.count).toBe(1);
  });

  it('3. AnalyticsCalculator: Menu item performance aggregates sales and quantities from bill_items', () => {
    const menuPerf = AnalyticsCalculator.calculateMenuItemPerformance(mockBillItems);

    expect(menuPerf.length).toBe(2);
    const capp = menuPerf.find((m) => m.itemName === 'Cappuccino');
    expect(capp).toBeDefined();
    expect(capp?.quantitySold).toBe(4);
    expect(capp?.totalRevenue).toBe(600);
  });

  it('4. ExportEngine: Generates clean, valid CSV formatted text strings', () => {
    const summary = AnalyticsCalculator.calculateExecutiveSummary(mockBills);
    const revenueCsv = ExportEngine.exportRevenueToCsv(summary);

    expect(revenueCsv).toContain('Gross Sales,1000.00');
    expect(revenueCsv).toContain('Net Sales,814.00');

    const payments = AnalyticsCalculator.calculatePaymentBreakdown(mockBills);
    const paymentCsv = ExportEngine.exportPaymentsToCsv(payments);

    expect(paymentCsv).toContain('Payment Method,Transaction Count,Total Amount (₹),Share (%)');
    expect(paymentCsv).toContain('UPI,1,499.00');

    const menuPerf = AnalyticsCalculator.calculateMenuItemPerformance(mockBillItems);
    const menuCsv = ExportEngine.exportMenuAnalyticsToCsv(menuPerf);

    expect(menuCsv).toContain('Item Name,Quantity Sold,Avg Unit Price (₹),Total Revenue (₹),Revenue Share (%)');
    expect(menuCsv).toContain('Cappuccino,4,150.00,600.00');
  });

  it('5. AnalyticsService: Full dashboard aggregation API returns structured dataset', async () => {
    const dateRange: DateRange = {
      startDate: '2026-07-25T00:00:00.000Z',
      endDate: '2026-07-25T23:59:59.999Z',
      preset: 'TODAY',
    };

    const dashboard = await AnalyticsService.getDashboard('cafe-analytics-1', dateRange);

    expect(dashboard).toBeDefined();
    expect(dashboard.summary).toBeDefined();
    expect(dashboard.payments).toBeDefined();
    expect(dashboard.revenueTrend).toBeDefined();
    expect(dashboard.topMenuItems).toBeDefined();
  });
});
