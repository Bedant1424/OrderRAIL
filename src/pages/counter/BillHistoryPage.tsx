import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BillWithItems, PaymentMethod, PaymentStatus } from '@/lib/billing/types';
import { BillService } from '@/lib/billing/BillService';
import { Receipt } from '@/components/billing/Receipt';
import { useCafe } from '@/lib/cafe';
import { formatCurrency } from '@/lib/db';
import { printService, type ReceiptPrintPayloadData } from '@/lib/printing';
import { toast } from 'sonner';
import {
  Search,
  ArrowLeft,
  Receipt as ReceiptIcon,
  Calendar,
  Filter,
  Eye,
  X,
  Printer,
  CheckCircle2,
  Clock,
  Ban,
  RotateCcw,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export default function BillHistoryPage() {
  const { cafe } = useCafe();
  const cafeId = cafe?.id || 'cafe-demo-1';

  const [bills, setBills] = useState<BillWithItems[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [selectedBill, setSelectedBill] = useState<BillWithItems | null>(null);

  // Load bills on mount
  useEffect(() => {
    async function loadBills() {
      setLoading(true);
      try {
        // Default: Load all bills for cafe
        const res = await BillService.getBillsByDateRange(
          cafeId,
          '2020-01-01T00:00:00.000Z',
          '2030-12-31T23:59:59.999Z'
        );
        setBills(res);
      } catch (e: any) {
        toast.error('Failed to load bill history: ' + (e?.message || e));
      } finally {
        setLoading(false);
      }
    }
    void loadBills();
  }, [cafeId]);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // Search
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchesNumber = `bill #${b.bill_number}`.toLowerCase().includes(query) || `${b.bill_number}`.includes(query);
        const matchesCustomer = (b.customer_name || '').toLowerCase().includes(query) || (b.customer_phone || '').includes(query);
        const matchesTable = (b.table_id || b.order_type).toLowerCase().includes(query);
        if (!matchesNumber && !matchesCustomer && !matchesTable) return false;
      }

      // Status
      if (statusFilter !== 'ALL' && b.payment_status !== statusFilter) {
        return false;
      }

      // Method
      if (methodFilter !== 'ALL' && b.payment_method !== methodFilter) {
        return false;
      }

      // Date Filter
      if (dateFilter !== 'all') {
        const billDate = new Date(b.created_at);
        const now = new Date();
        if (dateFilter === 'today') {
          if (billDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'yesterday') {
          const yest = new Date(now);
          yest.setDate(yest.getDate() - 1);
          if (billDate.toDateString() !== yest.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (billDate < sevenDaysAgo) return false;
        }
      }

      return true;
    });
  }, [bills, searchQuery, statusFilter, methodFilter, dateFilter]);

  // Financial Metrics Summary
  const metrics = useMemo(() => {
    const totalCount = filteredBills.length;
    const paidBills = filteredBills.filter((b) => b.payment_status === 'PAID');
    const totalRevenue = paidBills.reduce((acc, b) => acc + b.grand_total, 0);
    const pendingCount = filteredBills.filter((b) => b.payment_status === 'PENDING').length;

    return { totalCount, paidCount: paidBills.length, totalRevenue, pendingCount };
  }, [filteredBills]);

  // Print Receipt handler
  const handlePrintReceipt = async (bill: BillWithItems) => {
    const payload: ReceiptPrintPayloadData = {
      type: 'RECEIPT',
      orderId: bill.id,
      billNumber: `Bill #${bill.bill_number}`,
      sessionId: bill.session_id,
      tableLabel: bill.table_id || bill.order_type,
      cashierName: bill.cashier_id || 'Counter Staff',
      timestamp: new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      items: bill.items.map((i) => ({ id: i.id || i.item_name, name: i.item_name, price: i.unit_price, qty: i.quantity })),
      subtotal: bill.subtotal,
      tax: bill.cgst + bill.sgst,
      discountPct: 0,
      discountAmt: bill.discount,
      netTotal: bill.grand_total,
      tenders: [{ method: bill.payment_method.toLowerCase() as any, amount: bill.grand_total }],
    };

    const { success } = await printService.enqueue('RECEIPT', 'BILL_PRINTER', payload, { orderId: bill.id });
    if (success) {
      toast.success(`🖨️ Receipt for Bill #${bill.bill_number} sent to printer.`);
    } else {
      toast.error(`❌ Failed to print receipt for Bill #${bill.bill_number}.`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* 1. TOP NAVBAR */}
      <header className="h-14 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/counter"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/30 hover:bg-muted text-foreground font-bold text-xs transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to POS
          </Link>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <h1 className="text-base font-extrabold flex items-center gap-2 tracking-tight">
            <ReceiptIcon className="w-5 h-5 text-primary" /> Bill History & Financial Records
          </h1>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          {cafe?.name ?? 'OrderRail Cafe'}
        </div>
      </header>

      {/* 2. MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Bills</span>
            <span className="text-2xl font-extrabold font-mono text-foreground">{metrics.totalCount}</span>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Paid Revenue</span>
            <span className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.totalRevenue)}
            </span>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Paid Bills</span>
            <span className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {metrics.paidCount}
            </span>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Bills</span>
            <span className="text-2xl font-extrabold font-mono text-amber-500">
              {metrics.pendingCount}
            </span>
          </div>
        </div>

        {/* FILTERS & SEARCH BAR */}
        <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Bill #, Customer Name, Mobile, or Table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 h-10 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="CARD">CARD</option>
              <option value="MIXED">MIXED</option>
            </select>
          </div>
        </div>

        {/* BILLS TABLE */}
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-xs font-medium">
              Loading bill records...
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-2 text-muted-foreground">
              <ReceiptIcon className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold">No bill records found matching your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Bill No</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Table / Type</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-center">Method</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredBills.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBill(b)}
                      className="hover:bg-muted/30 transition cursor-pointer font-medium"
                    >
                      <td className="py-3 px-4 font-mono font-extrabold text-foreground">
                        Bill #{b.bill_number}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                        {new Date(b.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td className="py-3 px-4 text-foreground font-semibold">
                        {b.table_id || b.order_type}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {b.customer_name ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{b.customer_name}</span>
                            {b.customer_phone && <span className="text-[10px] font-mono">{b.customer_phone}</span>}
                          </div>
                        ) : (
                          <span className="italic text-muted-foreground/60">Walk-in</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        {b.total_items}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-foreground text-sm">
                        {formatCurrency(b.grand_total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-foreground uppercase">
                          {b.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {b.payment_status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" /> PAID
                          </span>
                        ) : b.payment_status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                            <Clock className="w-3 h-3" /> PENDING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
                            <Ban className="w-3 h-3" /> {b.payment_status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBill(b);
                          }}
                          className="h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-bold flex items-center justify-center gap-1 ml-auto transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 3. READ-ONLY BILL DETAILS RECEIPT MODAL */}
      <AnimatePresence>
        {selectedBill && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4 relative max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-extrabold text-sm flex items-center gap-2 text-foreground">
                  <ReceiptIcon className="w-4 h-4 text-primary" /> Bill #{selectedBill.bill_number} Details
                </h3>
                <button
                  onClick={() => setSelectedBill(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Render Reusable Receipt Component */}
              <Receipt
                bill={selectedBill}
                showFooterButtons={true}
                onPrint={() => void handlePrintReceipt(selectedBill)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
