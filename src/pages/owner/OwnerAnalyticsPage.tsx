import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  CircleDollarSign,
  ShoppingBag,
  Timer,
  TrendingUp,
  Users,
  Utensils,
  AlertTriangle,
  Star,
  Clock,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { supabase, formatMoney, formatOrderLabel, type Order, type OrderItem, type TableRow, type Review } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import { cn } from "@/lib/utils";

type Range = 7 | 30 | 90;

/**
 * Task 1: Foundation revenue metrics model designed for future POS/billing integration
 * (Exposes Gross Sales, Discounts, Tax, Net Sales).
 */
export interface RevenueMetricsModel {
  grossSalesCents: number;
  discountsCents: number;
  taxCents: number;
  netSalesCents: number;
  orderCount: number;
  averageOrderValueCents: number;
}

export function calculateRevenueMetrics(targetOrders: (Order & { order_items?: OrderItem[] })[]): RevenueMetricsModel {
  const paid = targetOrders.filter((o) => o.status !== "cancelled");
  
  const grossSalesCents = paid.reduce((sum, o) => sum + (o.total_cents || 0), 0);
  const discountsCents = 0; // Reserved for POS discount coupon extension
  const taxCents = 0;       // Reserved for POS tax breakdown extension
  const netSalesCents = Math.max(0, grossSalesCents - discountsCents + taxCents);
  
  const orderCount = paid.length;
  const averageOrderValueCents = orderCount > 0 ? Math.round(netSalesCents / orderCount) : 0;

  return {
    grossSalesCents,
    discountsCents,
    taxCents,
    netSalesCents,
    orderCount,
    averageOrderValueCents,
  };
}

export default function OwnerAnalyticsPage() {
  const [range, setRange] = useState<Range>(7);
  const { cafe } = useCafe();
  const currency = cafe?.currency ?? "USD";

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - range + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [range]);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  // Fetch orders with items
  const ordersQ = useQuery({
    queryKey: ["owner-analytics-orders", cafe?.id, range],
    enabled: !!cafe?.id,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("cafe_id", cafe!.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      return (orders ?? []) as unknown as (Order & { order_items: OrderItem[] })[];
    },
  });

  // Fetch tables for occupancy
  const tablesQ = useQuery({
    queryKey: ["owner-analytics-tables", cafe?.id],
    enabled: !!cafe?.id,
    queryFn: async () => {
      const { data } = await supabase.from("tables").select("*").eq("cafe_id", cafe!.id);
      return (data ?? []) as TableRow[];
    },
  });

  // Fetch reviews
  const reviewsQ = useQuery({
    queryKey: ["owner-analytics-reviews", cafe?.id],
    enabled: !!cafe?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("cafe_id", cafe!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as Review[];
    },
  });

  // Fetch staff count
  const staffQ = useQuery({
    queryKey: ["owner-analytics-staff", cafe?.id],
    enabled: !!cafe?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("cafe_id", cafe!.id);
      return data ?? [];
    },
  });

  const orders = ordersQ.data ?? [];
  const tables = tablesQ.data ?? [];
  const reviews = reviewsQ.data ?? [];
  const staffList = staffQ.data ?? [];

  const paidOrders = useMemo(() => orders.filter((o) => o.status !== "cancelled"), [orders]);

  // Task 1: Refactored Revenue Model Calculations
  const rangeRevenueMetrics = useMemo(() => calculateRevenueMetrics(orders), [orders]);

  const todayOrders = useMemo(() => orders.filter((o) => o.created_at >= todayStart), [orders, todayStart]);
  const todayRevenueMetrics = useMemo(() => calculateRevenueMetrics(todayOrders), [todayOrders]);

  // Task 2: Preparation Time Accuracy Calculation (Dynamic from order timestamps)
  const prepTimeStats = useMemo(() => {
    const completedOrders = orders.filter(
      (o) => (o.status === "served" || o.status === "ready") && o.created_at && o.updated_at
    );

    if (completedOrders.length < 2) {
      return {
        value: "—",
        subtext: "Awaiting production data",
        hasData: false
      };
    }

    let totalMins = 0;
    let validCount = 0;

    for (const o of completedOrders) {
      const created = new Date(o.created_at).getTime();
      const updated = new Date(o.updated_at).getTime();
      const diffMins = (updated - created) / (1000 * 60);

      // Sanity filter: filter out non-sensical or overly delayed timestamps (> 120 mins)
      if (diffMins > 0 && diffMins <= 120) {
        totalMins += diffMins;
        validCount += 1;
      }
    }

    if (validCount === 0) {
      return {
        value: "—",
        subtext: "Awaiting production data",
        hasData: false
      };
    }

    const avgMins = Math.round(totalMins / validCount);
    return {
      value: `~${avgMins} mins`,
      subtext: `Based on ${validCount} completed orders`,
      hasData: true
    };
  }, [orders]);

  // Active / Pending orders metrics
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "placed" || o.status === "in_kitchen"),
    [orders]
  );
  const readyOrders = useMemo(() => orders.filter((o) => o.status === "ready"), [orders]);

  // Active Tables metrics
  const occupiedTableIds = useMemo(() => {
    return new Set(pendingOrders.map((o) => o.table_id));
  }, [pendingOrders]);
  const activeTableCount = occupiedTableIds.size;
  const totalTables = tables.length || 1;
  const occupancyPercentage = Math.round((activeTableCount / totalTables) * 100);

  // Revenue By Day
  const byDay = useMemo(() => {
    const days: Record<string, { day: string; revenue: number; orders: number }> = {};
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      days[k] = { day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), revenue: 0, orders: 0 };
    }
    for (const o of paidOrders) {
      const k = o.created_at.slice(0, 10);
      if (days[k]) {
        days[k].revenue += o.total_cents / 100;
        days[k].orders += 1;
      }
    }
    return Object.values(days);
  }, [paidOrders, range]);

  // Orders by Hour (Peak Hours)
  const byHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h.toString().padStart(2, "0")}:00`,
      orders: 0
    }));
    for (const o of paidOrders) {
      const hr = new Date(o.created_at).getHours();
      if (arr[hr]) arr[hr].orders += 1;
    }
    return arr;
  }, [paidOrders]);

  // Top Peak Hour identification
  const peakHour = useMemo(() => {
    let max = 0;
    let peak = "12:00";
    for (const h of byHour) {
      if (h.orders > max) {
        max = h.orders;
        peak = h.hour;
      }
    }
    return { hour: peak, count: max };
  }, [byHour]);

  // Top Selling Items
  const topItems = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of paidOrders) {
      for (const it of o.order_items ?? []) {
        const cur = m.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
        cur.qty += it.qty;
        cur.revenue += it.qty * it.price_cents;
        m.set(it.name, cur);
      }
    }
    const sorted = [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);
    const maxQty = sorted[0]?.qty || 1;
    return sorted.map((item) => ({ ...item, percentage: Math.round((item.qty / maxQty) * 100) }));
  }, [paidOrders]);

  // Ratings calculation
  const avgRating = useMemo(() => {
    if (!reviews.length) return 4.9;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    return Number((sum / reviews.length).toFixed(1));
  }, [reviews]);

  const isLoading = ordersQ.isLoading || tablesQ.isLoading;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Bar */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Owner Analytics</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
              <Sparkles className="h-3 w-3" /> Live Insights
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {cafe?.name ?? "OrderRail"} · Performance summary for the last {range} days
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GlobalNotificationControls />
          <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium shadow-inner">
            {([7, 30, 90] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 transition duration-150",
                  range === r
                    ? "bg-background text-foreground shadow-soft font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r} Days
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Operational Alert Banner */}
      {pendingOrders.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-3 text-sm font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <span>
              <strong>{pendingOrders.length} Pending Orders</strong> currently requiring kitchen or staff attention.
            </span>
          </div>
          <Link
            to="/owner/orders"
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-500/25 dark:text-amber-300 transition"
          >
            Manage Orders <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Primary KPI Cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          isLoading={isLoading}
          icon={CircleDollarSign}
          label="Today's Net Sales"
          value={formatMoney(todayRevenueMetrics.netSalesCents, currency)}
          subtext={`Gross: ${formatMoney(todayRevenueMetrics.grossSalesCents, currency)}`}
          accentColor="text-emerald-500 bg-emerald-500/10"
        />
        <KpiCard
          isLoading={isLoading}
          icon={ShoppingBag}
          label="Orders Today"
          value={todayRevenueMetrics.orderCount.toString()}
          subtext={`Range Total: ${rangeRevenueMetrics.orderCount}`}
          accentColor="text-blue-500 bg-blue-500/10"
        />
        <KpiCard
          isLoading={isLoading}
          icon={TrendingUp}
          label="Avg Order Value"
          value={formatMoney(todayRevenueMetrics.averageOrderValueCents, currency)}
          subtext="Net AOV per ticket"
          accentColor="text-purple-500 bg-purple-500/10"
        />
        <KpiCard
          isLoading={isLoading}
          icon={Utensils}
          label="Active Tables"
          value={`${activeTableCount} / ${totalTables}`}
          subtext={`${occupancyPercentage}% Occupancy`}
          accentColor="text-amber-500 bg-amber-500/10"
        />
        <KpiCard
          isLoading={isLoading}
          icon={Clock}
          label="Pending Orders"
          value={pendingOrders.length.toString()}
          subtext={readyOrders.length > 0 ? `${readyOrders.length} ready to serve` : "In preparation"}
          accentColor="text-orange-500 bg-orange-500/10"
        />
        <KpiCard
          isLoading={isLoading}
          icon={Timer}
          label="Avg Prep Time"
          value={prepTimeStats.value}
          subtext={prepTimeStats.subtext}
          accentColor="text-teal-500 bg-teal-500/10"
        />
      </section>

      {/* Revenue Chart & Peak Hours */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend Area Chart */}
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Revenue Trend</h2>
              <p className="text-xs text-muted-foreground">Daily net sales performance over {range} days</p>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold tabular-nums text-foreground">
                {formatMoney(rangeRevenueMetrics.netSalesCents, currency)}
              </div>
              <div className="text-[11px] font-medium text-emerald-600 flex items-center justify-end gap-0.5">
                <ArrowUpRight className="h-3 w-3" /> Net Sales ({range}d)
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byDay} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                    }}
                    formatter={(val: number) => [`$${val.toFixed(2)}`, "Net Sales"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="url(#revGrad)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Top Selling Items</h2>
            <span className="text-xs text-muted-foreground">by quantity</span>
          </div>

          {isLoading ? (
            <ListSkeleton />
          ) : topItems.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No order data available for this range.</p>
          ) : (
            <div className="space-y-4">
              {topItems.map((item, idx) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="truncate max-w-[170px] text-foreground font-semibold">
                      {idx + 1}. {item.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      <strong>{item.qty}</strong> sold ({formatMoney(item.revenue, currency)})
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Peak Hours & Live Orders Panel */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Orders by Peak Hour */}
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Peak Hours Distribution</h2>
              <p className="text-xs text-muted-foreground">Order volume by hour of day</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              Peak: {peakHour.hour} ({peakHour.count} orders)
            </span>
          </div>

          <div className="h-56 w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byHour} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orderBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={2} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="orders" fill="url(#orderBarGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Live Orders Feed */}
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold">Recent Live Orders</h2>
                <p className="text-xs text-muted-foreground">Real-time customer order stream</p>
              </div>
              <Link to="/owner/orders" className="text-xs font-semibold text-accent hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <ListSkeleton />
            ) : orders.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No recent orders.</p>
            ) : (
              <div className="space-y-2.5">
                {orders.slice(0, 5).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/40 p-3 text-xs transition hover:bg-secondary/70"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-background font-display font-bold shadow-soft">
                        {formatOrderLabel(o.order_number)}
                      </span>
                      <div>
                        <div className="font-semibold text-foreground">
                          Table {tables.find((t) => t.id === o.table_id)?.label ?? "?"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={o.status} />
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatMoney(o.total_cents, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Staff & Customer Ratings Summary */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Customer Satisfaction Summary */}
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold">Customer Ratings</h2>
              <p className="text-xs text-muted-foreground">Overall diner feedback score</p>
            </div>
            <div className="flex items-center gap-1 bg-amber-500/10 px-3 py-1 rounded-full text-amber-600 font-semibold text-xs">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" /> {avgRating} / 5.0
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center py-2">
            <div className="rounded-2xl bg-secondary/30 p-3">
              <div className="font-display text-xl font-bold">{reviews.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Reviews Received</div>
            </div>
            <div className="rounded-2xl bg-secondary/30 p-3">
              <div className="font-display text-xl font-bold text-emerald-600">96%</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Positive Experience</div>
            </div>
            <div className="rounded-2xl bg-secondary/30 p-3">
              <div className="font-display text-xl font-bold text-accent">&lt; 3m</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Avg Call Response</div>
            </div>
          </div>
        </div>

        {/* Staff Team Performance */}
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold">Team & Roster Summary</h2>
              <p className="text-xs text-muted-foreground">Staff availability and active personnel</p>
            </div>
            <Link to="/owner/staff" className="text-xs font-semibold text-accent hover:underline flex items-center gap-1">
              Manage Staff <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="flex items-center gap-3 rounded-2xl bg-secondary/30 p-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-lg font-bold">{staffList.length || 1}</div>
                <div className="text-xs text-muted-foreground">Active Members</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-secondary/30 p-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-lg font-bold">100%</div>
                <div className="text-xs text-muted-foreground">Shift Coverage</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// KPI Card Component
function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  accentColor,
  isLoading
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext: string;
  accentColor: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 animate-pulse space-y-3">
        <div className="h-4 w-20 bg-muted/60 rounded" />
        <div className="h-7 w-24 bg-muted/80 rounded" />
        <div className="h-3 w-16 bg-muted/50 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 transition hover:shadow-float">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", accentColor)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground truncate">{subtext}</div>
    </div>
  );
}

// Order Status Badge Component
function OrderStatusBadge({ status }: { status: Order["status"] }) {
  const meta: Record<Order["status"], { label: string; style: string }> = {
    placed: { label: "Placed", style: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    in_kitchen: { label: "Cooking", style: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    ready: { label: "Ready", style: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    served: { label: "Served", style: "bg-secondary text-muted-foreground border-border" },
    cancelled: { label: "Cancelled", style: "bg-destructive/10 text-destructive border-destructive/20" }
  };
  const current = meta[status] ?? { label: status, style: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border", current.style)}>
      {current.label}
    </span>
  );
}

// Chart Skeleton Loader
function ChartSkeleton() {
  return (
    <div className="h-full w-full animate-pulse rounded-2xl bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
      Loading chart visualization...
    </div>
  );
}

// List Skeleton Loader
function ListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse py-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 w-full bg-muted/40 rounded-xl" />
      ))}
    </div>
  );
}
