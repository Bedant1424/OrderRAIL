import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Download,
  CheckSquare,
  Square,
  ChevronRight,
  X,
  Clock,
  Utensils,
  ArrowUpDown,
  Calendar,
  Sparkles,
  LayoutGrid,
  History,
  Radio,
  Timer,
  AlertCircle,
  CheckCircle2,
  Users
} from "lucide-react";
import { supabase, formatMoney, formatOrderLabel, type Order, type OrderItem, type TableRow } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import SharedOrderKanban from "@/components/orders/SharedOrderKanban";
import OccupiedTablesWidget from "@/components/orders/OccupiedTablesWidget";
import { ORDER_STATUS_MAP, getNextOrderStatus, computeDailyOrderNumbers } from "@/lib/orders/orderUtils";
import { calculateOperationalSummary } from "@/lib/orders/metrics";
import { generateOrdersCSV } from "@/lib/orders/csvExporter";
import { useOrders } from "@/lib/orders/useOrders";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import { fetchCafeTables } from "@/lib/tables/tableRepository";

type MainTab = "live" | "history";
type SortOption = "newest" | "oldest" | "highest" | "lowest";
type StatusFilter = "all" | "completed" | "cancelled";
export type DatePresetKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "all"
  | "custom"
  | "month"
  | "year";

export default function OwnerOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { cafe } = useCafe();
  const currency = cafe?.currency ?? "INR";

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<MainTab>(
    (searchParams.get("tab") as MainTab) ?? "live"
  );

  // Advanced Reporting Date Filter States
  const [preset, setPreset] = useState<DatePresetKey>(() => {
    const range = searchParams.get("range");
    if (range === "today") return "today";
    if (range === "7d") return "7d";
    if (range === "30d") return "30d";
    return "all";
  });

  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) ?? "all"
  );
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedTableIdFilter, setSelectedTableIdFilter] = useState<string | null>(null);

  // Compute sinceDate, untilDate, filenameRange, and activeRangeLabel
  const { sinceDate, untilDate, filenameRange, activeRangeLabel } = useMemo(() => {
    const now = new Date();

    if (preset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: `today_${now.toISOString().slice(0, 10)}`,
        activeRangeLabel: "Today"
      };
    }

    if (preset === "yesterday") {
      const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
      const end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: `yesterday_${yest.toISOString().slice(0, 10)}`,
        activeRangeLabel: "Yesterday"
      };
    }

    if (preset === "7d") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: "last_7_days",
        activeRangeLabel: "Last 7 Days"
      };
    }

    if (preset === "30d") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: "last_30_days",
        activeRangeLabel: "Last 30 Days"
      };
    }

    if (preset === "90d") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: "last_90_days",
        activeRangeLabel: "Last 90 Days"
      };
    }

    if (preset === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: monthStr,
        activeRangeLabel: `This Month (${now.toLocaleString("en-US", { month: "short" })})`
      };
    }

    if (preset === "last_month") {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const start = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: monthStr,
        activeRangeLabel: `Last Month (${prevMonthDate.toLocaleString("en-US", { month: "short" })})`
      };
    }

    if (preset === "this_year") {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: `${now.getFullYear()}`,
        activeRangeLabel: `This Year (${now.getFullYear()})`
      };
    }

    if (preset === "month" && selectedMonth) {
      const [yrStr, moStr] = selectedMonth.split("-");
      const yr = parseInt(yrStr, 10);
      const mo = parseInt(moStr, 10) - 1;
      const start = new Date(yr, mo, 1, 0, 0, 0, 0);
      const end = new Date(yr, mo + 1, 0, 23, 59, 59, 999);
      const dateObj = new Date(yr, mo, 1);
      const label = dateObj.toLocaleString("en-US", { month: "long", year: "numeric" });
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: selectedMonth,
        activeRangeLabel: label
      };
    }

    if (preset === "year" && selectedYear) {
      const yr = parseInt(selectedYear, 10);
      const start = new Date(yr, 0, 1, 0, 0, 0, 0);
      const end = new Date(yr, 11, 31, 23, 59, 59, 999);
      return {
        sinceDate: start.toISOString(),
        untilDate: end.toISOString(),
        filenameRange: `${yr}`,
        activeRangeLabel: `Year ${yr}`
      };
    }

    if (preset === "custom" && customStartDate) {
      const endDateStr = customEndDate || customStartDate;
      const sDate = new Date(`${customStartDate}T00:00:00`);
      const eDate = new Date(`${endDateStr}T23:59:59.999`);
      const filenameRange = customStartDate === endDateStr ? customStartDate : `${customStartDate}_to_${endDateStr}`;
      const activeRangeLabel = customStartDate === endDateStr ? `Custom (${customStartDate})` : `Custom (${customStartDate} to ${endDateStr})`;
      return {
        sinceDate: sDate.toISOString(),
        untilDate: eDate.toISOString(),
        filenameRange,
        activeRangeLabel
      };
    }

    return {
      sinceDate: null,
      untilDate: null,
      filenameRange: "all_time",
      activeRangeLabel: "All Time"
    };
  }, [preset, customStartDate, customEndDate, selectedMonth, selectedYear]);

  // Drawer & Selection States
  const [selectedOrder, setSelectedOrder] = useState<(Order & { order_items: OrderItem[] }) | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Consuming Shared Order Engine Hook with custom Date Filter
  const { orders, isLoading, updateStatus, cancelOrder, isUpdating } = useOrders({
    cafeId: cafe?.id,
    sinceDate,
    untilDate
  });

  // Dynamic Options for Month & Year dropdowns
  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      opts.push({ value, label });
    }
    return opts;
  }, []);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(String);
  }, []);

  // Handlers for Reporting Filter controls
  const handlePresetSelect = (key: DatePresetKey) => {
    setPreset(key);
    setSelectedMonth("");
    setSelectedYear("");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const handleMonthSelect = (val: string) => {
    if (!val) return;
    setSelectedMonth(val);
    setPreset("month");
    setSelectedYear("");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const handleYearSelect = (val: string) => {
    if (!val) return;
    setSelectedYear(val);
    setPreset("year");
    setSelectedMonth("");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const handleCustomStartChange = (val: string) => {
    setCustomStartDate(val);
    if (val && !customEndDate) {
      setCustomEndDate(val);
    }
    setPreset("custom");
    setSelectedMonth("");
    setSelectedYear("");
  };

  const handleCustomEndChange = (val: string) => {
    setCustomEndDate(val);
    setPreset("custom");
    setSelectedMonth("");
    setSelectedYear("");
  };

  // Daily Display Order Numbers Mapping (Resets per calendar day)
  const dailyOrderNumMap = useMemo(() => computeDailyOrderNumbers(orders), [orders]);

  // Sync tab & filters from URL params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "live" || tabParam === "history") setActiveTab(tabParam);

    const statusParam = searchParams.get("status");
    if (statusParam && (statusParam === "all" || statusParam === "completed" || statusParam === "cancelled")) {
      setStatusFilter(statusParam as StatusFilter);
    }

    const rangeParam = searchParams.get("range");
    if (rangeParam) setDateRange(rangeParam as DateRangeFilter);
  }, [searchParams]);

  // Fetch tables mapping
  const tablesQ = useQuery({
    queryKey: ["owner-orders-tables", cafe?.id],
    enabled: !!cafe?.id,
    queryFn: () => fetchCafeTables(cafe!.id),
  });

  const tables = tablesQ.data ?? [];

  // Table Label Mapping Helper
  const tableLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tables) map.set(t.id, t.label);
    return map;
  }, [tables]);

  // Operational summary metrics
  const summary = useMemo(() => calculateOperationalSummary(orders, tables), [orders, tables]);

  // Deep-link trigger for orderId param
  useEffect(() => {
    const orderIdParam = searchParams.get("orderId");
    if (orderIdParam && orders.length > 0) {
      const match = orders.find((o) => {
        const dailyNum = dailyOrderNumMap.get(o.id) ?? o.order_number;
        return o.id === orderIdParam || formatOrderLabel(dailyNum) === `#${orderIdParam}` || formatOrderLabel(o.order_number) === `#${orderIdParam}`;
      });
      if (match) setSelectedOrder(match);
    }
  }, [searchParams, orders, dailyOrderNumMap]);

  // Filtered & Sorted Orders for History View (Newest -> Oldest Default)
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedTableIdFilter && o.table_id !== selectedTableIdFilter) return false;

      const tableLabel = tableLabelMap.get(o.table_id) ?? "";
      const dailyNum = dailyOrderNumMap.get(o.id) ?? o.order_number;
      const dailyOrderLabel = formatOrderLabel(dailyNum).toLowerCase();
      const rawNumStr = String(dailyNum);
      const dbNumStr = String(o.order_number);
      const query = searchQuery.toLowerCase().trim();

      const d = new Date(o.created_at);
      const dateFormattedStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toLowerCase();
      const isoDateStr = isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
      const itemsStr = (o.order_items ?? []).map((it) => it.name.toLowerCase()).join(" ");

      if (query) {
        const matchesQuery =
          dailyOrderLabel.includes(query) ||
          rawNumStr.includes(query) ||
          dbNumStr.includes(query) ||
          tableLabel.toLowerCase().includes(query) ||
          itemsStr.includes(query) ||
          dateFormattedStr.includes(query) ||
          isoDateStr.includes(query) ||
          o.notes?.toLowerCase().includes(query);

        if (!matchesQuery) return false;
      }

      // History Status Filters (All / Completed / Cancelled)
      if (statusFilter === "completed") {
        if (o.status !== "served" && o.status !== "ready") return false;
      } else if (statusFilter === "cancelled") {
        if (o.status !== "cancelled") return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "oldest") {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }
      if (sortBy === "highest") {
        const diff = b.total_cents - a.total_cents;
        return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "lowest") {
        const diff = a.total_cents - b.total_cents;
        return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // Default: Newest First
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return diff !== 0 ? diff : b.id.localeCompare(a.id);
    });
  }, [orders, searchQuery, statusFilter, tableLabelMap, sortBy, selectedTableIdFilter, dailyOrderNumMap]);

  // Selection helpers
  const isAllSelected = filteredOrders.length > 0 && selectedIds.length === filteredOrders.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  // Status Update Handler using Shared Repository Engine
  const handleUpdateStatus = async (orderId: string, nextStatus: Order["status"]) => {
    try {
      await updateStatus(orderId, nextStatus);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch {
      // Toast already triggered by hook
    }
  };

  // Standardized CSV Exporter using Daily Order Numbers and Reporting Filename
  const handleExportCSV = () => {
    const listToExport = selectedIds.length > 0
      ? filteredOrders.filter((o) => selectedIds.includes(o.id))
      : filteredOrders;

    if (listToExport.length === 0) {
      toast.error("No orders available to export.");
      return;
    }

    const csvContent = generateOrdersCSV(listToExport, tableLabelMap, dailyOrderNumMap);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const exportFilename = `orders_${filenameRange}.csv`;
    link.setAttribute("download", exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${listToExport.length} orders as ${exportFilename}`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Order Operations Center</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
              <Radio className="h-3 w-3 animate-pulse text-emerald-500" /> Live Sync Active
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {cafe?.name ?? "OrderRail"} · Shared real-time restaurant orders & historical sales ledger
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GlobalNotificationControls />

          {/* Navigation Tabs */}
          <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium shadow-inner">
            <button
              onClick={() => setActiveTab("live")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 transition duration-150 font-semibold cursor-pointer",
                activeTab === "live"
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Live KDS
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 transition duration-150 font-semibold cursor-pointer",
                activeTab === "history"
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="h-3.5 w-3.5" /> Sales History
            </button>
          </div>
        </div>
      </header>

      {/* Advanced Reporting Date Filter Controls */}
      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Reporting Period</span>
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary border border-primary/20">
              {activeRangeLabel}
            </span>
          </div>

          {/* Selectors: Month, Year, Custom Range */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Selector */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1 text-xs font-medium">
              <span className="text-muted-foreground">Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthSelect(e.target.value)}
                className="bg-transparent outline-none cursor-pointer text-foreground font-semibold"
              >
                <option value="">Select Month</option>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1 text-xs font-medium">
              <span className="text-muted-foreground">Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearSelect(e.target.value)}
                className="bg-transparent outline-none cursor-pointer text-foreground font-semibold"
              >
                <option value="">Select Year</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Custom Start & End Date Inputs */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1 text-xs font-medium">
              <span className="text-muted-foreground">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => handleCustomStartChange(e.target.value)}
                className="bg-transparent outline-none cursor-pointer text-foreground font-semibold"
              />
              <span className="text-muted-foreground">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => handleCustomEndChange(e.target.value)}
                className="bg-transparent outline-none cursor-pointer text-foreground font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Quick Presets Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
          <span className="text-[11px] font-bold text-muted-foreground mr-1.5 uppercase tracking-wider">Presets:</span>
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "7d", label: "Last 7 Days" },
            { id: "30d", label: "Last 30 Days" },
            { id: "90d", label: "Last 90 Days" },
            { id: "this_month", label: "This Month" },
            { id: "last_month", label: "Last Month" },
            { id: "this_year", label: "This Year" },
            { id: "all", label: "All Time" },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => handlePresetSelect(chip.id as DatePresetKey)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer border",
                preset === chip.id
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-secondary/60 text-muted-foreground border-border/40 hover:bg-secondary hover:text-foreground"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Orders</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{summary.activeCount}</div>
          <div className="text-[11px] text-muted-foreground">{summary.activeOrdersText} in pipeline</div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Preparing</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">{summary.preparingCount}</div>
          <div className="text-[11px] text-muted-foreground">In kitchen</div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ready</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary.readyCount}</div>
          <div className="text-[11px] text-muted-foreground">To serve</div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Completed ({activeRangeLabel})</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary.completedCount}</div>
          <div className="text-[11px] text-muted-foreground">Served orders</div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue ({activeRangeLabel})</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{formatMoney(summary.totalRevenue || 0, currency)}</div>
          <div className="text-[11px] text-muted-foreground">Gross revenue</div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Occupied Tables</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary.occupiedTablesCount}</div>
          <div className="text-[11px] text-muted-foreground">{summary.occupiedTablesText}</div>
        </div>
      </section>

      {/* Occupied Tables Operational Widget */}
      <OccupiedTablesWidget
        tables={tables}
        orders={orders}
        onSelectTable={(t) => setSelectedTableIdFilter(selectedTableIdFilter === t.id ? null : t.id)}
        selectedTableId={selectedTableIdFilter}
      />

      {/* VIEW 1: LIVE OPERATIONS KANBAN */}
      {activeTab === "live" && (
        <section className="space-y-4">
          <SharedOrderKanban
            orders={selectedTableIdFilter ? orders.filter((o) => o.table_id === selectedTableIdFilter) : orders}
            tableLabelMap={tableLabelMap}
            currency={currency}
            cafeId={cafe?.id}
            role="owner"
            onSelectOrder={(order) => setSelectedOrder(order)}
            onUpdateStatus={handleUpdateStatus}
            isUpdatingStatus={isUpdating}
          />
        </section>
      )}

      {/* VIEW 2: HISTORICAL SALES LEDGER TABLE */}
      {activeTab === "history" && (
        <section className="space-y-6">
          {/* Controls Bar */}
          <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order #, Table, Items, or Date..."
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Sort By Selector (Default: Newest First) */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-medium">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent outline-none cursor-pointer text-foreground"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Total</option>
                  <option value="lowest">Lowest Total</option>
                </select>
              </div>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground shadow-soft transition hover:bg-secondary/80 active:scale-95 cursor-pointer"
              >
                <Download className="h-4 w-4" /> Export CSV ({selectedIds.length || filteredOrders.length})
              </button>
            </div>

            {/* History-focused Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
              {[
                { id: "all", label: "All Orders" },
                { id: "completed", label: "Completed" },
                { id: "cancelled", label: "Cancelled" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as StatusFilter)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-semibold transition duration-150 cursor-pointer",
                    statusFilter === tab.id
                      ? "bg-brand text-brand-foreground shadow-soft"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* History Table */}
          <div className="rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden">
            {isLoading ? (
              <TableSkeleton />
            ) : filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-2">
                <Utensils className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="font-display text-base font-semibold">No sales history orders found</p>
                <p className="text-xs">Adjust your search parameters, date filters, or status selection.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border/60">
                    <tr>
                      <th className="p-4 w-10">
                        <button onClick={toggleSelectAll} className="grid place-items-center cursor-pointer">
                          {isAllSelected ? (
                            <CheckSquare className="h-4 w-4 text-accent" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </th>
                      <th className="p-4">Order #</th>
                      <th className="p-4">Table</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Item Summary</th>
                      <th className="p-4 text-right">Total</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Time</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredOrders.map((o) => {
                      const isSelected = selectedIds.includes(o.id);
                      const dailyNum = dailyOrderNumMap.get(o.id) ?? o.order_number;
                      const dateObj = new Date(o.created_at);
                      const dateFormatted = isNaN(dateObj.getTime())
                        ? "—"
                        : dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                      const timeFormatted = isNaN(dateObj.getTime())
                        ? "—"
                        : dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
                      
                      const itemsSummary = (o.order_items ?? []).length > 0
                        ? (o.order_items ?? []).map((it) => `${it.name} ×${it.qty}`).join(", ")
                        : "1× Order Items";

                      return (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedOrder(o)}
                          className={cn(
                            "cursor-pointer transition hover:bg-secondary/40 select-none",
                            isSelected && "bg-accent/5"
                          )}
                        >
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => toggleSelectRow(o.id)} className="grid place-items-center cursor-pointer">
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-accent" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                          <td className="p-4 font-display font-bold text-foreground">
                            {formatOrderLabel(dailyNum)}
                          </td>
                          <td className="p-4 font-medium text-foreground">
                            Table {tableLabelMap.get(o.table_id) ?? "?"}
                          </td>
                          <td className="p-4">
                            <OrderStatusBadge status={o.status} />
                          </td>
                          <td className="p-4 text-xs text-muted-foreground max-w-xs truncate font-medium">
                            {itemsSummary}
                          </td>
                          <td className="p-4 text-right font-semibold tabular-nums text-foreground">
                            {formatMoney(o.total_cents, currency)}
                          </td>
                          <td className="p-4 text-xs text-muted-foreground tabular-nums font-medium">
                            {dateFormatted}
                          </td>
                          <td className="p-4 text-right text-xs text-muted-foreground tabular-nums font-mono">
                            {timeFormatted}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(o);
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 cursor-pointer"
                            >
                              Details <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Order Details Drawer */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="w-full max-w-md bg-card border-l border-border shadow-float h-full overflow-y-auto p-6 space-y-6 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Order Details</div>
                  <h2 className="font-display text-2xl font-bold">
                    {formatOrderLabel(dailyOrderNumMap.get(selectedOrder.id) ?? selectedOrder.order_number)}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Order Meta Header */}
              <div className="my-4 flex items-center justify-between rounded-2xl bg-secondary/50 p-4">
                <div>
                  <div className="text-xs text-muted-foreground">Location</div>
                  <div className="font-display text-base font-semibold">
                    Table {tableLabelMap.get(selectedOrder.table_id) ?? "?"}
                  </div>
                </div>
                <OrderStatusBadge status={selectedOrder.status} />
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order Items ({selectedOrder.order_items?.length ?? 0})
                </h3>
                <div className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-background p-3">
                  {(selectedOrder.order_items ?? []).map((it) => (
                    <div key={it.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{it.qty}x</span> {it.name}
                        {it.notes && <p className="text-[11px] text-muted-foreground italic">Note: {it.notes}</p>}
                      </div>
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatMoney(it.qty * it.price_cents, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Notes */}
              {selectedOrder.notes && (
                <div className="mt-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Special Instructions:</strong> {selectedOrder.notes}
                </div>
              )}

              {/* Billing Breakdown */}
              <div className="mt-6 space-y-2 rounded-2xl bg-secondary/30 p-4 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Subtotal</span>
                  <span className="tabular-nums">{formatMoney(selectedOrder.total_cents, currency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discounts</span>
                  <span className="tabular-nums">$0.00</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (Included)</span>
                  <span className="tabular-nums">$0.00</span>
                </div>
                <hr className="border-border/60 my-2" />
                <div className="flex justify-between font-display text-base font-bold text-foreground">
                  <span>Net Total</span>
                  <span className="tabular-nums">{formatMoney(selectedOrder.total_cents, currency)}</span>
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-4 text-[11px] text-muted-foreground space-y-1">
                <div>Created: {new Date(selectedOrder.created_at).toLocaleString()}</div>
                <div>Last Updated: {new Date(selectedOrder.updated_at).toLocaleString()}</div>
              </div>
            </div>

            {/* Terminal State Order Details Drawer Actions */}
            <div className="border-t border-border/60 pt-4">
              {selectedOrder.status === "served" || selectedOrder.status === "cancelled" ? (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <strong>Order Completed ({selectedOrder.status})</strong>
                    <p className="text-[11px] text-muted-foreground">This workflow is in terminal read-only state.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Next Action</div>
                  {getNextOrderStatus(selectedOrder.status) && (
                    <button
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(selectedOrder.id, getNextOrderStatus(selectedOrder.status)!)}
                      className="w-full rounded-xl bg-brand text-brand-foreground py-2.5 text-xs font-semibold shadow-soft hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <span>
                        {getNextOrderStatus(selectedOrder.status) === "in_kitchen" && "Start Preparing Order"}
                        {getNextOrderStatus(selectedOrder.status) === "ready" && "Mark Order Ready"}
                        {getNextOrderStatus(selectedOrder.status) === "served" && "Serve Order"}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    disabled={isUpdating}
                    onClick={() => cancelOrder(selectedOrder.id)}
                    className="w-full rounded-xl bg-destructive/10 text-destructive border border-destructive/20 py-2 text-xs font-semibold hover:bg-destructive/20 transition disabled:opacity-50"
                  >
                    Cancel Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Order Status Badge Component
function OrderStatusBadge({ status }: { status: Order["status"] }) {
  const meta = ORDER_STATUS_MAP[status] ?? { label: status, badgeStyle: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border", meta.badgeStyle)}>
      {meta.label}
    </span>
  );
}

// Table Skeleton Loader
function TableSkeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 w-full bg-muted/40 rounded-xl" />
      ))}
    </div>
  );
}
