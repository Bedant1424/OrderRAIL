import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { KitchenTicket, KitchenStatus, KotPriority, KitchenMetrics } from '@/lib/kitchen/types';
import { PriorityEngine } from '@/lib/kitchen/priorityEngine';
import { KOT } from '@/components/kitchen/KOT';
import { useCafe } from '@/lib/cafe';
import { supabase } from '@/lib/db';
import { updateOrderStatusInDb } from '@/lib/orders/repository';
import { printService, type KotPrintPayloadData } from '@/lib/printing';
import { toast } from 'sonner';
import {
  Flame,
  Search,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Utensils,
  Filter,
  ArrowUpDown,
  ChefHat,
} from 'lucide-react';

export default function KitchenDisplayPage() {
  const { cafe } = useCafe();
  const cafeId = cafe?.id || '';

  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'oldest' | 'priority' | 'newest'>('oldest');

  // Live timer tick every second to keep elapsed time & priority badges dynamic
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active kitchen orders from DB
  const loadKitchenOrders = useCallback(async () => {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*, order_items(*), tables(label)')
        .not('status', 'in', '("served","cancelled","paid")')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[KitchenDisplay] Error loading orders:', error.message);
        return;
      }

      if (orders) {
        const formattedTickets: KitchenTicket[] = orders.map((o: any) => {
          const createdAtMs = new Date(o.created_at).getTime();
          const dbStatus = (o.status || 'pending').toLowerCase();

          let status: KitchenStatus = 'NEW';
          if (dbStatus === 'preparing') status = 'PREPARING';
          else if (dbStatus === 'ready') status = 'READY';
          else if (dbStatus === 'served') status = 'SERVED';

          const tableLabel = o.tables?.label
            ? (o.tables.label.toLowerCase().startsWith('table') ? o.tables.label : `Table ${o.tables.label}`)
            : (o.order_type === 'takeaway' ? 'Takeaway' : 'Express');

          const items = (o.order_items || []).map((item: any) => ({
            id: item.id,
            name: item.name || 'Menu Item',
            qty: item.qty || item.quantity || 1,
            notes: item.notes || null,
          }));

          return {
            id: o.id,
            orderNumber: o.order_number || Math.floor(100 + Math.random() * 900),
            tableLabel,
            orderType: o.order_type === 'takeaway' ? 'TAKEAWAY' : 'DINE_IN',
            timestamp: new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
            createdAtMs,
            status,
            items,
            priority: PriorityEngine.getPriority(createdAtMs, Date.now()),
            elapsedMins: PriorityEngine.getElapsedMins(createdAtMs, Date.now()),
          };
        });

        setTickets(formattedTickets);
      }
    } catch (e: any) {
      console.warn('[KitchenDisplay] loadKitchenOrders exception:', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load & Supabase Realtime subscription
  useEffect(() => {
    void loadKitchenOrders();

    const channel = supabase
      .channel('kitchen-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void loadKitchenOrders();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadKitchenOrders]);

  // Handle Kitchen Status Transition
  const handleStatusChange = async (ticketId: string, nextStatus: KitchenStatus) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    if (!PriorityEngine.isValidTransition(ticket.status, nextStatus)) {
      toast.error(`Invalid transition from ${ticket.status} to ${nextStatus}`);
      return;
    }

    // Map KitchenStatus to DB Order status
    let dbStatus: 'preparing' | 'ready' | 'served' = 'preparing';
    if (nextStatus === 'PREPARING') dbStatus = 'preparing';
    else if (nextStatus === 'READY') dbStatus = 'ready';
    else if (nextStatus === 'SERVED') dbStatus = 'served';

    // Optimistic UI update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t))
    );

    try {
      await updateOrderStatusInDb(ticketId, dbStatus as any, 'staff');
      toast.success(`KOT #${ticket.orderNumber} updated to ${nextStatus}`);
    } catch (e: any) {
      toast.error(`Failed to update status: ${e?.message || e}`);
      void loadKitchenOrders();
    }
  };

  // Handle KOT Print Trigger
  const handlePrintKot = async (ticket: KitchenTicket) => {
    const payload: KotPrintPayloadData = {
      type: 'KOT',
      orderId: ticket.id,
      orderNumber: ticket.orderNumber,
      tableLabel: ticket.tableLabel,
      timestamp: ticket.timestamp,
      items: ticket.items.map((i) => ({ id: i.id || i.name, name: i.name, price: 0, qty: i.qty, notes: i.notes || undefined })),
    };

    const { success } = await printService.enqueue('KOT', 'KOT_PRINTER', payload, { orderId: ticket.id });
    if (success) {
      toast.success(`🖨️ KOT #${ticket.orderNumber} printed for kitchen.`);
    } else {
      toast.error(`❌ Failed to print KOT #${ticket.orderNumber}.`);
    }
  };

  // Live Metrics Summary
  const metrics: KitchenMetrics = useMemo(() => {
    const activeTickets = tickets.filter((t) => t.status !== 'SERVED').length;
    const preparingTickets = tickets.filter((t) => t.status === 'PREPARING').length;
    const readyTickets = tickets.filter((t) => t.status === 'READY').length;
    const overdueTickets = tickets.filter(
      (t) => t.status !== 'SERVED' && PriorityEngine.getElapsedMins(t.createdAtMs, nowMs) >= 15
    ).length;

    const activeList = tickets.filter((t) => t.status !== 'SERVED');
    const totalElapsed = activeList.reduce(
      (acc, t) => acc + PriorityEngine.getElapsedMins(t.createdAtMs, nowMs),
      0
    );
    const avgPrepMins = activeList.length > 0 ? Math.round(totalElapsed / activeList.length) : 0;

    return { activeTickets, preparingTickets, readyTickets, avgPrepMins, overdueTickets };
  }, [tickets, nowMs]);

  // Filtered & Sorted Tickets
  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        // Search
        const query = searchQuery.trim().toLowerCase();
        if (query) {
          const matchesNum = `kot #${t.orderNumber}`.toLowerCase().includes(query) || `${t.orderNumber}`.includes(query);
          const matchesTable = t.tableLabel.toLowerCase().includes(query);
          const matchesItem = t.items.some((i) => i.name.toLowerCase().includes(query));
          if (!matchesNum && !matchesTable && !matchesItem) return false;
        }

        // Status Filter
        if (statusFilter !== 'ALL' && t.status !== statusFilter) {
          return false;
        }

        // Priority Filter
        const curPriority = PriorityEngine.getPriority(t.createdAtMs, nowMs);
        if (priorityFilter !== 'ALL' && curPriority !== priorityFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return b.createdAtMs - a.createdAtMs;
        }
        if (sortBy === 'priority') {
          const priorityWeight: Record<KotPriority, number> = {
            CRITICAL: 4,
            URGENT: 3,
            HIGH: 2,
            NORMAL: 1,
          };
          const pA = priorityWeight[PriorityEngine.getPriority(a.createdAtMs, nowMs)];
          const pB = priorityWeight[PriorityEngine.getPriority(b.createdAtMs, nowMs)];
          if (pA !== pB) return pB - pA;
        }
        return a.createdAtMs - b.createdAtMs; // oldest first (default)
      });
  }, [tickets, searchQuery, statusFilter, priorityFilter, sortBy, nowMs]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* 1. TOP KITCHEN NAVBAR */}
      <header className="h-14 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/counter"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/30 hover:bg-muted text-foreground font-bold text-xs transition"
          >
            <ArrowLeft className="w-4 h-4" /> POS Workstation
          </Link>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <h1 className="text-base font-extrabold flex items-center gap-2 tracking-tight">
            <ChefHat className="w-5 h-5 text-primary" /> Kitchen Display System (KDS)
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadKitchenOrders()}
            className="h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold flex items-center gap-1.5 transition"
            title="Refresh Kitchen Queue"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <div className="text-xs font-mono text-muted-foreground hidden md:block">
            {cafe?.name ?? 'OrderRail Cafe'}
          </div>
        </div>
      </header>

      {/* 2. MAIN KITCHEN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        {/* METRICS DASHBOARD CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Tickets</span>
            <span className="text-2xl font-extrabold font-mono text-foreground">{metrics.activeTickets}</span>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Preparing</span>
            <span className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">{metrics.preparingTickets}</span>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Ready</span>
            <span className="text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">{metrics.readyTickets}</span>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Avg Prep Time</span>
            <span className="text-2xl font-extrabold font-mono text-foreground">{metrics.avgPrepMins}m</span>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-1 shadow-sm col-span-2 md:col-span-1">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Overdue (&gt;15m)
            </span>
            <span className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">{metrics.overdueTickets}</span>
          </div>
        </div>

        {/* SEARCH, FILTER & SORT TOOLBAR */}
        <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search KOT #, Table Label, or Item Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 h-10 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">NEW</option>
              <option value="PREPARING">PREPARING</option>
              <option value="READY">READY</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ALL">All Priorities</option>
              <option value="NORMAL">NORMAL (&lt;5m)</option>
              <option value="HIGH">HIGH (5-10m)</option>
              <option value="URGENT">URGENT (10-15m)</option>
              <option value="CRITICAL">CRITICAL (&gt;15m)</option>
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="oldest">Sort: Oldest First</option>
              <option value="priority">Sort: Highest Priority</option>
              <option value="newest">Sort: Newest First</option>
            </select>
          </div>
        </div>

        {/* KITCHEN TICKETS GRID */}
        {loading ? (
          <div className="p-16 text-center text-muted-foreground text-xs font-medium">
            Loading active kitchen tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center gap-2 text-muted-foreground bg-card border border-border/60 rounded-2xl shadow-sm">
            <Utensils className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm font-semibold">Kitchen Queue Clear! No active tickets match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {filteredTickets.map((t) => (
              <KOT
                key={t.id}
                ticket={t}
                nowMs={nowMs}
                onStatusChange={handleStatusChange}
                onPrintKot={handlePrintKot}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
