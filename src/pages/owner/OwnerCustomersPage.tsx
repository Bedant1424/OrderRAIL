import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  ArrowUpDown,
  ChevronRight,
  Phone,
  Calendar,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  X,
  CheckCircle2,
  ChevronDown,
  UserCheck
} from "lucide-react";
import { formatMoney, type Order } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { useCustomerProfiles } from "@/hooks/useCustomerProfiles";
import { type CustomerProfile } from "@/lib/customers/customerService";
import { formatDateDDMMYYYY } from "@/components/ui/OrderRailDateRangePicker";
import OrderDetailsModal from "@/components/orders/OrderDetailsModal";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import { cn } from "@/lib/utils";

type CustomerSortOption = "highest" | "recent" | "orders" | "name" | "newest" | "oldest";

export default function OwnerCustomersPage() {
  const { cafe, currency } = useCafe();
  const navigate = useNavigate();

  const { customerProfiles: allProfiles, isLoading } = useCustomerProfiles(cafe?.id);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<CustomerSortOption>("highest");
  const [isSortOpen, setIsSortOpen] = useState(false);

  const [selectedProfile, setSelectedProfile] = useState<CustomerProfile | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Overall directory statistics
  const stats = useMemo(() => {
    const totalProfiles = allProfiles.length;
    const totalSpendCents = allProfiles.reduce((sum, p) => sum + p.lifetimeSpendCents, 0);
    const avgSpendCents = totalProfiles > 0 ? Math.round(totalSpendCents / totalProfiles) : 0;
    const repeatCount = allProfiles.filter((p) => p.visitCount > 1).length;

    return {
      totalProfiles,
      totalSpendCents,
      avgSpendCents,
      repeatCount,
    };
  }, [allProfiles]);

  // Filter & Sort Profiles
  const filteredProfiles = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allProfiles
      .filter((p) => {
        if (!query) return true;
        const nameMatch = p.name.toLowerCase().includes(query);
        const phoneMatch = p.phone?.toLowerCase().includes(query) ?? false;
        const channelMatch = p.preferredChannel.toLowerCase().includes(query);
        return nameMatch || phoneMatch || channelMatch;
      })
      .sort((a, b) => {
        if (sortBy === "recent") {
          return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
        }
        if (sortBy === "orders") {
          return b.visitCount - a.visitCount;
        }
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "newest") {
          return new Date(b.firstVisit).getTime() - new Date(a.firstVisit).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.firstVisit).getTime() - new Date(b.firstVisit).getTime();
        }
        // Default: Highest Spend
        return b.lifetimeSpendCents - a.lifetimeSpendCents;
      });
  }, [allProfiles, searchQuery, sortBy]);

  // Channel badge helper
  const renderChannelBadge = (chStr: string) => {
    const src = chStr.toLowerCase();
    if (src.includes("swiggy"))
      return <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 text-orange-600 px-2.5 py-0.5 border border-orange-500/20 text-xs font-semibold">🛵 Swiggy</span>;
    if (src.includes("zomato"))
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 px-2.5 py-0.5 border border-red-500/20 text-xs font-semibold">🛵 Zomato</span>;
    if (src.includes("takeaway"))
      return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-600 px-2.5 py-0.5 border border-blue-500/20 text-xs font-semibold">🥡 Takeaway</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 border border-emerald-500/20 text-xs font-semibold">🍽 Dine In</span>;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <header className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Customer Directory
              </h1>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent border border-accent/20">
                Customer Intelligence
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Automatically derived customer profiles and lifetime intelligence from historical sales records.
            </p>
          </div>

          <GlobalNotificationControls />
        </div>
      </header>

      {/* Overview Statistics Strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <Users className="h-4 w-4 text-primary" /> Total Profiles
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">{stats.totalProfiles}</div>
          <div className="text-[11px] text-muted-foreground">Unique customer accounts</div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <DollarSign className="h-4 w-4 text-emerald-500" /> Lifetime Customer Spend
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatMoney(stats.totalSpendCents, currency)}
          </div>
          <div className="text-[11px] text-muted-foreground">Total customer revenue</div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <TrendingUp className="h-4 w-4 text-primary" /> Average Customer Spend
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-primary">
            {formatMoney(stats.avgSpendCents, currency)}
          </div>
          <div className="text-[11px] text-muted-foreground">Lifetime spend per profile</div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <UserCheck className="h-4 w-4 text-amber-500" /> Repeat Customers
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {stats.repeatCount}
          </div>
          <div className="text-[11px] text-muted-foreground">Visited more than once</div>
        </div>
      </section>

      {/* Controls Bar (Search & Sort) */}
      <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 flex flex-wrap items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Customer Name, Phone, or Preferred Channel..."
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

        {/* Sort By Popover Selector */}
        <div className="relative">
          <button
            onClick={() => setIsSortOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border/60 bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground transition-all duration-150 cursor-pointer shadow-xs hover:bg-muted/50 h-9"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              Sort:{" "}
              {sortBy === "highest"
                ? "Highest Spend"
                : sortBy === "recent"
                ? "Most Recent Visit"
                : sortBy === "orders"
                ? "Most Orders"
                : sortBy === "name"
                ? "Alphabetical"
                : sortBy === "newest"
                ? "Newest Customer"
                : "Oldest Customer"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {isSortOpen && (
            <div className="absolute right-0 mt-2 z-50 w-48 rounded-2xl border border-border/80 bg-popover p-1.5 shadow-xl space-y-0.5">
              {[
                { id: "highest", label: "Highest Spend" },
                { id: "recent", label: "Most Recent Visit" },
                { id: "orders", label: "Most Orders" },
                { id: "name", label: "Alphabetical" },
                { id: "newest", label: "Newest Customer" },
                { id: "oldest", label: "Oldest Customer" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSortBy(opt.id as CustomerSortOption);
                    setIsSortOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer text-left",
                    sortBy === opt.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span>{opt.label}</span>
                  {sortBy === opt.id && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading customer profiles...</div>
      ) : filteredProfiles.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl bg-card p-12 text-center shadow-soft ring-1 ring-border/60 space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
            <Users className="h-7 w-7" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground">No customer profiles yet.</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Customer profiles are automatically created when customer information (Name or Phone Number) is collected during billing.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table View */}
          <div className="hidden sm:block rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border/60">
                  <tr>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4 text-center">Orders</th>
                    <th className="p-4 text-right">Lifetime Spend</th>
                    <th className="p-4 text-right">Average Bill</th>
                    <th className="p-4">Last Visit</th>
                    <th className="p-4">Preferred Channel</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredProfiles.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProfile(p)}
                      className="cursor-pointer transition hover:bg-secondary/40 select-none"
                    >
                      <td className="p-4 font-semibold text-foreground flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20 shrink-0">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{p.name}</span>
                      </td>
                      <td className="p-4 text-xs font-mono text-muted-foreground">
                        {p.phone ?? "—"}
                      </td>
                      <td className="p-4 text-center font-bold tabular-nums text-foreground">
                        {p.visitCount}
                      </td>
                      <td className="p-4 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatMoney(p.lifetimeSpendCents, currency)}
                      </td>
                      <td className="p-4 text-right font-semibold tabular-nums text-foreground">
                        {formatMoney(p.averageBillCents, currency)}
                      </td>
                      <td className="p-4 text-xs text-muted-foreground tabular-nums">
                        {formatDateDDMMYYYY(p.lastVisit.slice(0, 10))}
                      </td>
                      <td className="p-4">
                        {renderChannelBadge(p.preferredChannel)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProfile(p);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 cursor-pointer"
                        >
                          View Profile <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="block sm:hidden space-y-3">
            {filteredProfiles.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedProfile(p)}
                className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 space-y-3 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20 shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-foreground text-sm">{p.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{p.phone ?? "—"}</div>
                    </div>
                  </div>
                  {renderChannelBadge(p.preferredChannel)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Lifetime Spend</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">
                      {formatMoney(p.lifetimeSpendCents, currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Visits</span>
                    <span className="font-bold text-foreground tabular-nums text-sm">{p.visitCount} visits</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Customer Details Side Drawer */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setSelectedProfile(null)} />

          <div className="relative z-10 w-full max-w-lg h-full bg-card shadow-2xl border-l border-border/80 flex flex-col animate-in slide-in-from-right duration-200 text-foreground">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center border border-primary/20">
                  {selectedProfile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">{selectedProfile.name}</h2>
                  <p className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {selectedProfile.phone ?? "No phone on file"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Business Metrics Grid */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business Metrics</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-secondary/50 p-3 border border-border/40">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Visits</span>
                    <span className="font-display text-lg font-bold tabular-nums text-foreground">{selectedProfile.visitCount}</span>
                  </div>

                  <div className="rounded-2xl bg-secondary/50 p-3 border border-border/40">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Lifetime Spend</span>
                    <span className="font-display text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatMoney(selectedProfile.lifetimeSpendCents, currency)}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-secondary/50 p-3 border border-border/40">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Average Bill</span>
                    <span className="font-display text-lg font-bold tabular-nums text-primary">
                      {formatMoney(selectedProfile.averageBillCents, currency)}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-secondary/50 p-3 border border-border/40">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Preferred Channel</span>
                    <div className="mt-1">{renderChannelBadge(selectedProfile.preferredChannel)}</div>
                  </div>

                  <div className="rounded-2xl bg-secondary/50 p-3 border border-border/40">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">First Visit</span>
                    <span className="font-semibold text-xs text-foreground tabular-nums">
                      {formatDateDDMMYYYY(selectedProfile.firstVisit.slice(0, 10))}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-secondary/50 p-3 border border-border/40">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Last Visit</span>
                    <span className="font-semibold text-xs text-foreground tabular-nums">
                      {formatDateDDMMYYYY(selectedProfile.lastVisit.slice(0, 10))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Orders (Last 10 completed) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Recent Orders (Last 10)
                </h3>
                <div className="space-y-2">
                  {selectedProfile.orders.slice(0, 10).map((o) => (
                    <div
                      key={o.id}
                      onClick={() => setSelectedOrder(o)}
                      className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs hover:border-primary/40 transition cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-foreground text-sm">Order #{o.order_number}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDateDDMMYYYY(o.created_at.slice(0, 10))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">{formatMoney(o.total_cents, currency)}</div>
                        <div className="mt-0.5">{renderChannelBadge(o.order_source || o.order_type || "dine_in")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal Integration */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
