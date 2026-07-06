import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleDollarSign, ShoppingBag, Timer, TrendingUp } from "lucide-react";
import { supabase, formatMoney, type Cafe, type Order, type OrderItem } from "@/lib/db";

import { useCafe } from "@/lib/cafe";

type Range = 7 | 30 | 90;

export default function OwnerAnalyticsPage() {
  const [range, setRange] = useState<Range>(7);
  const { cafe } = useCafe();

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - range + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [range]);

  const q = useQuery({
    queryKey: ["owner-analytics", cafe?.id, range],
    enabled: !!cafe?.id,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("cafe_id", cafe!.id)
        .gte("created_at", since)
        .order("created_at");
      return (orders ?? []) as unknown as (Order & { order_items: OrderItem[] })[];
    },
  });

  const orders = q.data ?? [];
  const paid = orders.filter((o) => o.status !== "cancelled");
  const revenue = paid.reduce((s, o) => s + o.total_cents, 0);
  const avg = paid.length ? Math.round(revenue / paid.length) : 0;

  const byDay = useMemo(() => {
    const days: Record<string, { day: string; revenue: number; orders: number }> = {};
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      days[k] = { day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), revenue: 0, orders: 0 };
    }
    for (const o of paid) {
      const k = o.created_at.slice(0, 10);
      if (days[k]) {
        days[k].revenue += o.total_cents / 100;
        days[k].orders += 1;
      }
    }
    return Object.values(days);
  }, [paid, range]);

  const byHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, orders: 0 }));
    for (const o of paid) arr[new Date(o.created_at).getHours()].orders += 1;
    return arr;
  }, [paid]);

  const topItems = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of paid) {
      for (const it of o.order_items ?? []) {
        const cur = m.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
        cur.qty += it.qty;
        cur.revenue += it.qty * it.price_cents;
        m.set(it.name, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [paid]);

  const currency = cafe?.currency ?? "USD";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">{cafe?.name} · last {range} days</p>
        </div>
        <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium">
          {[7, 30, 90].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r as Range)}
              className={
                "rounded-full px-3 py-1.5 transition " +
                (range === r ? "bg-background shadow-soft" : "text-muted-foreground")
              }
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={CircleDollarSign} label="Revenue" value={formatMoney(revenue, currency)} />
        <Stat icon={ShoppingBag} label="Orders" value={paid.length.toString()} />
        <Stat icon={TrendingUp} label="Avg ticket" value={formatMoney(avg, currency)} />
        <Stat icon={Timer} label="Cancelled" value={(orders.length - paid.length).toString()} />
      </section>

      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h2 className="mb-3 font-display text-base font-semibold">Revenue by day</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={byDay} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h2 className="mb-3 font-display text-base font-semibold">Orders by hour</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={byHour} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h2 className="mb-3 font-display text-base font-semibold">Top items</h2>
          {topItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No orders yet in this range.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {topItems.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                    <span>{t.qty} sold</span>
                    <span className="font-semibold text-foreground">{formatMoney(t.revenue, currency)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
