import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Receipt,
  Utensils,
  Bell,
  Check,
  UserCheck,
  Ban
} from "lucide-react";
import { supabase, formatMoney, formatOrderLabel, type TableRow, type Order, type OrderItem, type ServiceRequest } from "@/lib/db";
import { getTableStatus } from "@/lib/tables/occupancy";
import { markTableFreeInDb, fetchTableServiceRequests } from "@/lib/tables/tableRepository";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export interface TableDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: TableRow | null;
  orders: (Order & { order_items: OrderItem[] })[];
  currency?: string;
  onTableFreed?: () => void;
}

export default function TableDetailsDrawer({
  open,
  onOpenChange,
  table,
  orders,
  currency = "USD",
  onTableFreed,
}: TableDetailsDrawerProps) {
  const [isFreeing, setIsFreeing] = useState(false);

  // Fetch service requests for this table
  const srQ = useQuery({
    queryKey: ["table-service-requests", table?.id],
    enabled: !!table?.id && open,
    queryFn: () => fetchTableServiceRequests(table!.id),
    refetchInterval: 5000,
  });

  const tableStatus = useMemo(() => {
    if (!table) return null;
    return getTableStatus(table, orders);
  }, [table, orders]);

  // Orders associated with this table
  const tableOrders = useMemo(() => {
    if (!table) return [];
    return orders
      .filter((o) => o.table_id === table.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [table, orders]);

  const activeOrders = useMemo(() => tableStatus?.activeOrders ?? [], [tableStatus]);
  const servedOrders = useMemo(() => tableStatus?.servedOrders ?? [], [tableStatus]);

  // Grand total billing for current session
  const totalBilledCents = useMemo(() => {
    return tableOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total_cents, 0);
  }, [tableOrders]);

  const handleFreeTable = async () => {
    if (!table) return;
    if (activeOrders.length > 0) {
      toast.error(`Cannot free Table ${table.label} while ${activeOrders.length} order(s) are active.`);
      return;
    }

    setIsFreeing(true);
    try {
      await markTableFreeInDb(table.id, table.active_session_id);
      toast.success(`Table ${table.label} marked Free`);
      onOpenChange(false);
      onTableFreed?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark table free.");
    } finally {
      setIsFreeing(false);
    }
  };

  if (!open || !table || !tableStatus) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md bg-card border-l border-border shadow-float h-full overflow-y-auto p-6 space-y-6 flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Restaurant Floor</div>
              <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                Table {table.label}
              </h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Current Status Card */}
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Status</span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border",
                tableStatus.chipColor === "green" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                tableStatus.chipColor === "amber" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                tableStatus.chipColor === "orange" && "bg-orange-500/10 text-orange-600 border-orange-500/20",
                tableStatus.chipColor === "blue" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                tableStatus.chipColor === "gray" && "bg-secondary text-muted-foreground border-border"
              )}>
                <span className={cn("h-2 w-2 rounded-full",
                  tableStatus.chipColor === "green" && "bg-emerald-500",
                  tableStatus.chipColor === "amber" && "bg-amber-500 animate-pulse",
                  tableStatus.chipColor === "orange" && "bg-orange-500",
                  tableStatus.chipColor === "blue" && "bg-blue-500",
                  tableStatus.chipColor === "gray" && "bg-muted-foreground"
                )} />
                {tableStatus.statusLabel}
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div><strong>Active Session:</strong> {table.active_session_id ? table.active_session_id.slice(0, 8) : "None"}</div>
              <div><strong>Active Orders:</strong> {activeOrders.length}</div>
              <div><strong>Served Orders:</strong> {servedOrders.length}</div>
            </div>
          </div>

          {/* Service Requests */}
          {(srQ.data ?? []).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-amber-500" /> Active Service Requests
              </h3>
              <div className="space-y-2">
                {(srQ.data ?? []).map((sr) => (
                  <div
                    key={sr.id}
                    className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
                  >
                    <div>
                      <span className="font-bold capitalize">{sr.type.replace("_", " ")}</span>
                      <div className="text-[10px] opacity-80">{new Date(sr.created_at).toLocaleTimeString()}</div>
                    </div>
                    <span className="text-[10px] uppercase font-bold bg-amber-500/20 px-2 py-0.5 rounded-full">
                      {sr.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Order Timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Utensils className="h-3.5 w-3.5" /> Order Timeline ({tableOrders.length})
            </h3>

            {tableOrders.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground italic border border-dashed rounded-2xl p-4">
                No orders recorded for this table.
              </div>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {tableOrders.map((o) => (
                  <div key={o.id} className="rounded-2xl border border-border/60 bg-background p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-foreground">
                        {formatOrderLabel(o.order_number)}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        {o.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-muted-foreground">
                      {(o.order_items ?? []).map((it) => (
                        <div key={it.id} className="flex justify-between">
                          <span>{it.qty}x {it.name}</span>
                          <span className="tabular-nums font-medium">{formatMoney(it.qty * it.price_cents, currency)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between border-t border-border/40 pt-1.5 font-bold text-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatMoney(o.total_cents, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session Billing Summary */}
          <div className="rounded-2xl bg-secondary/40 p-4 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Session Total Billed</span>
              <span className="font-display font-bold text-base text-foreground tabular-nums">
                {formatMoney(totalBilledCents, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Footer: Mark Table Free */}
        <div className="border-t border-border/60 pt-4 space-y-2">
          {tableStatus.isOccupied ? (
            <>
              <button
                type="button"
                disabled={activeOrders.length > 0 || isFreeing}
                onClick={() => void handleFreeTable()}
                className="w-full rounded-2xl bg-destructive py-3 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 transition shadow-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                <span>{isFreeing ? "Freeing Table..." : "Mark Table Free"}</span>
              </button>

              {activeOrders.length > 0 && (
                <p className="text-center text-[11px] text-destructive font-semibold">
                  ⚠️ Complete all {activeOrders.length} active order(s) before marking Table {table.label} free.
                </p>
              )}
            </>
          ) : (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-900 dark:text-emerald-200 text-center font-bold">
              ✓ Table {table.label} is Available (Free)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
