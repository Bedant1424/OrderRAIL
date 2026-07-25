import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  CircleDollarSign,
  ShoppingBag,
  Timer,
  TrendingUp,
  CreditCard,
  Download,
  Calendar,
  Utensils,
  RefreshCw,
  ChefHat,
  Filter,
  Users,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { useCafe } from '@/lib/cafe';
import {
  AnalyticsService,
  ExportEngine,
  type FullDashboardAnalytics,
  type DatePreset,
  type DateRange,
} from '@/lib/analytics';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function OwnerAnalyticsPage() {
  const { cafe } = useCafe();
  const cafeId = cafe?.id || '';

  const [datePreset, setDatePreset] = useState<DatePreset>('LAST_7_DAYS');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [data, setData] = useState<FullDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'payments' | 'menu' | 'kitchen' | 'exports'>('overview');

  // Compute ISO date range based on preset or custom picker
  const computedDateRange = useMemo<DateRange>(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    if (datePreset === 'TODAY') {
      // start is today 00:00:00
    } else if (datePreset === 'YESTERDAY') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (datePreset === 'LAST_7_DAYS') {
      start.setDate(start.getDate() - 6);
    } else if (datePreset === 'LAST_30_DAYS') {
      start.setDate(start.getDate() - 29);
    } else if (datePreset === 'CUSTOM' && startDate && endDate) {
      return {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        preset: 'CUSTOM',
      };
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      preset: datePreset,
    };
  }, [datePreset, startDate, endDate]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AnalyticsService.getDashboard(cafeId, computedDateRange);
      setData(res);
    } catch (e: any) {
      toast.error(`Failed to load analytics: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [cafeId, computedDateRange]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  // Export Trigger Handlers
  const handleExportBills = () => {
    if (!data) return;
    AnalyticsService.getExecutiveSummary(cafeId, computedDateRange).then(() => {
      // Export revenue summary
      const csv = ExportEngine.exportRevenueToCsv(data.summary);
      ExportEngine.downloadCsv(csv, `OrderRail_Revenue_Summary_${datePreset}.csv`);
      toast.success('Downloaded Revenue Summary CSV');
    });
  };

  const handleExportPayments = () => {
    if (!data) return;
    const csv = ExportEngine.exportPaymentsToCsv(data.payments);
    ExportEngine.downloadCsv(csv, `OrderRail_Payment_Breakdown_${datePreset}.csv`);
    toast.success('Downloaded Payment Breakdown CSV');
  };

  const handleExportMenuItems = () => {
    if (!data) return;
    const csv = ExportEngine.exportMenuAnalyticsToCsv(data.topMenuItems);
    ExportEngine.downloadCsv(csv, `OrderRail_Menu_Performance_${datePreset}.csv`);
    toast.success('Downloaded Menu Performance CSV');
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6 font-sans">
      {/* 1. PAGE HEADER & DATE PRESET TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border/60 shadow-sm">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Sales Reports & Business Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Financial analytics powered exclusively by OrderRail Billing Domain (<span className="font-mono text-primary font-bold">bills</span> &amp; <span className="font-mono text-primary font-bold">bill_items</span>).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40">
            {(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold transition',
                  datePreset === preset
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {preset.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={() => void loadAnalytics()}
            className="h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold flex items-center gap-1.5 transition"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE OVERVIEW KPI CARDS */}
      {loading || !data ? (
        <div className="p-12 text-center text-muted-foreground text-xs font-medium">
          Calculating financial metrics from billing domain...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-card border border-border/60 p-4 rounded-2xl flex flex-col gap-1 shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gross Sales</span>
              <span className="text-xl font-black font-mono text-foreground">₹{data.summary.grossSales.toLocaleString('en-IN')}</span>
            </div>

            <div className="bg-card border border-border/60 p-4 rounded-2xl flex flex-col gap-1 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Net Sales</span>
              <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">₹{data.summary.netSales.toLocaleString('en-IN')}</span>
            </div>

            <div className="bg-card border border-border/60 p-4 rounded-2xl flex flex-col gap-1 shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Paid Bills</span>
              <span className="text-xl font-black font-mono text-foreground">{data.summary.paidBills} / {data.summary.totalBills}</span>
            </div>

            <div className="bg-card border border-border/60 p-4 rounded-2xl flex flex-col gap-1 shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg Bill Value</span>
              <span className="text-xl font-black font-mono text-foreground">₹{data.summary.avgBillValue}</span>
            </div>

            <div className="bg-card border border-border/60 p-4 rounded-2xl flex flex-col gap-1 shadow-sm">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Discounts</span>
              <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">₹{data.summary.totalDiscounts}</span>
            </div>

            <div className="bg-card border border-border/60 p-4 rounded-2xl flex flex-col gap-1 shadow-sm col-span-2 md:col-span-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">GST Collected</span>
              <span className="text-xl font-black font-mono text-foreground">₹{(data.summary.totalCgst + data.summary.totalSgst).toFixed(2)}</span>
            </div>
          </div>

          {/* 3. NAVIGATION TABS */}
          <div className="flex items-center gap-2 border-b border-border/60 pb-2">
            {[
              { id: 'overview', label: 'Overview & Revenue' },
              { id: 'payments', label: 'Payment Analytics' },
              { id: 'menu', label: 'Menu Performance' },
              { id: 'kitchen', label: 'Kitchen Metrics' },
              { id: 'exports', label: 'CSV Exports' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold transition',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 4. TAB CONTENTS */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Revenue Chart */}
              <div className="lg:col-span-2 bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 text-primary" /> Net Sales Trend
                  </h2>
                  <span className="text-xs font-mono text-muted-foreground">₹ Net Revenue / Day</span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="netSales" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Financial Breakdown Sidebar */}
              <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
                <h2 className="text-sm font-extrabold">Revenue Breakdown</h2>
                <div className="flex flex-col gap-3 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Gross Sales</span>
                    <span className="font-bold font-mono">₹{data.summary.grossSales.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Total Discounts</span>
                    <span className="font-bold font-mono text-amber-600 dark:text-amber-400">- ₹{data.summary.totalDiscounts.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Service Charge</span>
                    <span className="font-bold font-mono">+ ₹{data.summary.totalServiceCharges.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">CGST (2.5%)</span>
                    <span className="font-bold font-mono">+ ₹{data.summary.totalCgst.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">SGST (2.5%)</span>
                    <span className="font-bold font-mono">+ ₹{data.summary.totalSgst.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 pt-3 font-extrabold text-sm border-t border-border">
                    <span>Net Sales Total</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">₹{data.summary.netSales.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payment Methods Cards */}
              <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
                <h2 className="text-sm font-extrabold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Payment Method Breakdown
                </h2>
                <div className="flex flex-col gap-4">
                  {data.payments.map((p) => (
                    <div key={p.method} className="flex flex-col gap-1.5 p-3 rounded-xl border border-border/40 bg-muted/20">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-foreground">{p.method}</span>
                        <span className="font-mono font-bold text-primary">₹{p.amount.toLocaleString('en-IN')} ({p.percentage}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.min(100, p.percentage)}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground text-right">{p.count} transactions</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-primary" /> Top Menu Item Performance
                </h2>
                <button
                  onClick={handleExportMenuItems}
                  className="h-8 px-3 rounded-xl border border-border bg-muted/30 hover:bg-muted text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Export Menu CSV
                </button>
              </div>

              {data.topMenuItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs font-medium">
                  No menu item sales recorded in this date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                      <tr>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3 text-right">Qty Sold</th>
                        <th className="py-2.5 px-3 text-right">Avg Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Total Revenue</th>
                        <th className="py-2.5 px-3 text-right">Revenue Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.topMenuItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-bold text-foreground">{item.itemName}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{item.quantitySold}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">₹{item.avgUnitPrice.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">₹{item.totalRevenue.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium">{item.revenuePercentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col gap-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg Preparation Time</span>
                <span className="text-3xl font-black font-mono text-foreground">{data.kitchen.avgPrepMins} mins</span>
              </div>

              <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col gap-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Completed Orders</span>
                <span className="text-3xl font-black font-mono text-foreground">{data.kitchen.totalCompletedOrders}</span>
              </div>

              <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col gap-3">
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Overdue Orders (&gt;15m)</span>
                <span className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">{data.kitchen.overdueOrdersCount}</span>
              </div>
            </div>
          )}

          {activeTab === 'exports' && (
            <div className="bg-card border border-border/60 p-6 rounded-2xl shadow-sm flex flex-col gap-5">
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" /> Financial &amp; Operational CSV Exports
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Export financial reporting data directly to CSV for spreadsheet analysis or accounting.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={handleExportBills}
                  className="p-4 rounded-2xl border border-border/60 bg-muted/20 hover:bg-muted/50 transition flex flex-col gap-2 text-left"
                >
                  <span className="font-extrabold text-sm text-foreground flex items-center justify-between">
                    Revenue Summary <Download className="w-4 h-4 text-primary" />
                  </span>
                  <span className="text-xs text-muted-foreground">Gross, Net, Taxes, Discounts KPI CSV</span>
                </button>

                <button
                  onClick={handleExportPayments}
                  className="p-4 rounded-2xl border border-border/60 bg-muted/20 hover:bg-muted/50 transition flex flex-col gap-2 text-left"
                >
                  <span className="font-extrabold text-sm text-foreground flex items-center justify-between">
                    Payment Methods <Download className="w-4 h-4 text-primary" />
                  </span>
                  <span className="text-xs text-muted-foreground">CASH, UPI, CARD distribution CSV</span>
                </button>

                <button
                  onClick={handleExportMenuItems}
                  className="p-4 rounded-2xl border border-border/60 bg-muted/20 hover:bg-muted/50 transition flex flex-col gap-2 text-left"
                >
                  <span className="font-extrabold text-sm text-foreground flex items-center justify-between">
                    Menu Item Sales <Download className="w-4 h-4 text-primary" />
                  </span>
                  <span className="text-xs text-muted-foreground">Top selling items &amp; revenue breakdown CSV</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
