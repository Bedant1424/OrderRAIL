import { useState } from "react";
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
  CheckCircle2,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  Layers
} from "lucide-react";
import { formatMoney, formatOrderLabel, type Order } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import { cn } from "@/lib/utils";
import { AnalyticsService } from "@/lib/analytics/AnalyticsService";

type Range = 7 | 30 | 90;

export default function OwnerAnalyticsPage() {
  const [range, setRange] = useState<Range>(7);
  const { cafe } = useCafe();
  const currency = cafe?.currency ?? "INR";

  // Priority 1 & 3: Optimized Single Pre-Aggregated Query with 5min staleTime
  const analyticsQ = useQuery({
    queryKey: ["owner-analytics-summary", cafe?.id, range],
    enabled: !!cafe?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    queryFn: () => AnalyticsService.fetchOwnerAnalytics(cafe!.id, range),
  });

  const data = analyticsQ.data;
  const isLoading = analyticsQ.isLoading && !data;

  // Extract Pre-aggregated Analytics Model
  const rangeRevenueMetrics = data?.rangeRevenueMetrics ?? {
    grossSalesCents: 0,
    discountsCents: 0,
    taxCents: 0,
    netSalesCents: 0,
    orderCount: 0,
    paidBillsCount: 0,
    totalItemsSold: 0,
    averageOrderValueCents: 0,
    averageBillValueCents: 0,
  };
  const todayRevenueMetrics = data?.todayRevenueMetrics ?? {
    grossSalesCents: 0,
    discountsCents: 0,
    taxCents: 0,
    netSalesCents: 0,
    orderCount: 0,
    paidBillsCount: 0,
    totalItemsSold: 0,
    averageOrderValueCents: 0,
    averageBillValueCents: 0,
  };
  const prepTimeStats = data?.prepTimeStats ?? {
    value: "—",
    subtext: "Awaiting production data",
    hasData: false,
    averageMinutes: null,
  };
  const pendingOrdersCount = data?.pendingOrdersCount ?? 0;
  const readyOrdersCount = data?.readyOrdersCount ?? 0;
  const activeTableCount = data?.activeTableCount ?? 0;
  const totalTables = data?.totalTables ?? 1;
  const occupancyPercentage = data?.occupancyPercentage ?? 0;
  const byDay = data?.byDay ?? [];
  const byHour = data?.byHour ?? [];
  const peakHour = data?.peakHour ?? { hour: "12:00", count: 0 };
  const topItems = data?.topItems ?? [];
  const tenders = data?.tenders ?? { cash: 0, upi: 0, card: 0, other: 0 };
  const recentOrders = data?.recentOrders ?? [];
  const avgRating = data?.avgRating ?? 4.9;
  const reviewsCount = data?.reviewsCount ?? 0;
  const staffCount = data?.staffCount ?? 1;

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
                  "rounded-full px-3.5 py-1.5 transition duration-150 cursor-pointer",
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
      {pendingOrdersCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-3 text-sm font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <span>
              <strong>{pendingOrdersCount} Pending Orders</strong> currently requiring kitchen or staff attention.
            </span>
          </div>
          <Link
            to="/owner/orders?tab=live&status=pending"
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
          subtext={
            todayRevenueMetrics.paidBillsCount > 0
              ? `${todayRevenueMetrics.paidBillsCount} paid ${todayRevenueMetrics.paidBillsCount === 1 ? "bill" : "bills"} · Gross ${formatMoney(todayRevenueMetrics.grossSalesCents, currency)}`
              : `Gross: ${formatMoney(todayRevenueMetrics.grossSalesCents, currency)}`
          }
          accentColor="text-emerald-500 bg-emerald-500/10"
        />
        <KpiCard
          isLoading={isLoading}
          icon={ShoppingBag}
          label="Orders Today"
          value={todayRevenueMetrics.orderCount.toString()}
          subtext={`Range Total: ${rangeRevenueMetrics.orderCount} orders`}
          accentColor="text-blue-500 bg-blue-500/10"
        />
        <KpiCard
          isLoading={isLoading}
          icon={TrendingUp}
          label="Avg Bill Value"
          value={formatMoney(todayRevenueMetrics.averageBillValueCents || todayRevenueMetrics.averageOrderValueCents, currency)}
          subtext={
            rangeRevenueMetrics.averageBillValueCents > 0
              ? `Range ABV: ${formatMoney(rangeRevenueMetrics.averageBillValueCents, currency)}`
              : "Net realized per bill"
          }
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
          value={pendingOrdersCount.toString()}
          subtext={readyOrdersCount > 0 ? `${readyOrdersCount} ready to serve` : "In preparation"}
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
              <p className="text-xs text-muted-foreground">Daily net realized sales over {range} days</p>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold tabular-nums text-foreground">
                {formatMoney(rangeRevenueMetrics.netSalesCents, currency)}
              </div>
              <div className="text-[11px] font-medium text-emerald-600 flex items-center justify-end gap-0.5">
                <ArrowUpRight className="h-3 w-3" /> Net Sales ({range}d · {rangeRevenueMetrics.paidBillsCount} {rangeRevenueMetrics.paidBillsCount === 1 ? "bill" : "bills"})
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
                    formatter={(val: number) => [formatMoney(Math.round(val * 100), currency), "Net Realized Sales"]}
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
            <span className="text-xs text-muted-foreground">by quantity (paid bills)</span>
          </div>

          {isLoading ? (
            <ListSkeleton />
          ) : topItems.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No finalized bill data available for this range.</p>
          ) : (
            <div className="space-y-4">
              {topItems.map((item, idx) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="truncate max-w-[170px] text-foreground font-semibold">
                      {idx + 1}. {item.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      <strong>{item.qty}</strong> sold ({formatMoney(Math.round(item.revenue * 100), currency)})
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
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                    }}
                    formatter={(val: number) => [`${val} orders`, "Volume"]}
                  />
                  <Bar dataKey="orders" fill="url(#orderBarGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Live Orders Feed */}
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold">Live Order Stream</h2>
                <p className="text-xs text-muted-foreground">Most recent table & quick-serve orders</p>
              </div>
              <Link
                to="/owner/orders"
                className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-0.5"
              >
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <ListSkeleton />
            ) : recentOrders.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No recent orders yet.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {recentOrders.map((ord) => (
                  <div key={ord.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-foreground">
                        {formatOrderLabel(ord as Order)}
                      </span>
                      <span className="text-muted-foreground font-medium">
                        Table {ord.table_label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 font-mono">
                        {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        ord.status === "placed" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                        ord.status === "in_kitchen" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                        ord.status === "ready" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        ord.status === "served" && "bg-secondary text-muted-foreground",
                        ord.status === "cancelled" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                      )}>
                        {ord.status.replace("_", " ")}
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">
                        {formatMoney(ord.total_cents, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Staff Active: <strong>{staffCount}</strong>
            </span>
            <span className="flex items-center gap-1 font-medium">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> <strong>{avgRating}</strong> ({reviewsCount} reviews)
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  isLoading,
  icon: Icon,
  label,
  value,
  subtext,
  accentColor,
}: {
  isLoading: boolean;
  icon: any;
  label: string;
  value: string;
  subtext?: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
        <div className={cn("rounded-xl p-2", accentColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2">
        {isLoading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-secondary" />
        ) : (
          <div className="font-display text-xl font-bold tracking-tight text-foreground tabular-nums truncate">
            {value}
          </div>
        )}
        {subtext && (
          <p className="mt-1 text-[11px] text-muted-foreground truncate">{subtext}</p>
        )}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-32 w-full animate-pulse rounded-xl bg-secondary/50" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-8 animate-pulse rounded-xl bg-secondary/50" />
      ))}
    </div>
  );
}
