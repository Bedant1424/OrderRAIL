import { useMemo } from "react";
import { Utensils } from "lucide-react";
import type { TableRow, Order } from "@/lib/db";
import { ORDER_STATUS_MAP } from "@/lib/orders/orderUtils";
import { getTableStatus, calculateOccupiedTables } from "@/lib/tables/occupancy";
import { cn } from "@/lib/utils";

export interface OccupiedTablesWidgetProps {
  tables: TableRow[];
  pendingOrders: Order[];
  onSelectTableFilter?: (tableId: string | null) => void;
  selectedTableId?: string | null;
}

export default function OccupiedTablesWidget({
  tables,
  pendingOrders,
  onSelectTableFilter,
  selectedTableId = null,
}: OccupiedTablesWidgetProps) {
  // Numerically sort tables (1 2 3 4 5 6 7 8 9 10)
  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => {
      const numA = parseInt(a.label.replace(/\D/g, ""), 10);
      const numB = parseInt(b.label.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [tables]);

  // Single occupancy engine calculation
  const occupiedTables = useMemo(() => calculateOccupiedTables(tables, pendingOrders), [tables, pendingOrders]);
  const totalTables = tables.length || 1;
  const occupiedCount = occupiedTables.length;
  const occupancyPercentage = Math.round((occupiedCount / totalTables) * 100);

  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 space-y-3">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
            <Utensils className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold">Occupied Tables</h3>
            <p className="text-[11px] text-muted-foreground">
              {occupiedCount} of {totalTables} tables occupied ({occupancyPercentage}%)
            </p>
          </div>
        </div>

        {selectedTableId && (
          <button
            onClick={() => onSelectTableFilter?.(null)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Show All Tables
          </button>
        )}
      </div>

      {/* Enhanced Numerically Sorted Table Chips showing Status */}
      <div className="flex flex-wrap items-center gap-2">
        {sortedTables.map((table) => {
          const statusInfo = getTableStatus(table, pendingOrders);
          const isOccupied = statusInfo.isOccupied;
          const isSelected = selectedTableId === table.id;
          const statusMeta = statusInfo.primaryStatus ? ORDER_STATUS_MAP[statusInfo.primaryStatus] : null;
          const activeCount = statusInfo.activeOrders.length;

          return (
            <button
              key={table.id}
              onClick={() => onSelectTableFilter?.(isSelected ? null : table.id)}
              className={cn(
                "flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-semibold transition shadow-soft",
                isOccupied
                  ? isSelected
                    ? "bg-amber-500 text-amber-950 border-amber-500 font-bold"
                    : "bg-amber-500/10 text-amber-900 border-amber-500/30 dark:text-amber-200 hover:bg-amber-500/20"
                  : "bg-secondary/40 text-muted-foreground border-border/50 hover:bg-secondary"
              )}
            >
              <span>Table {table.label}</span>
              {isOccupied ? (
                statusMeta ? (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border", statusMeta.badgeStyle)}>
                    {statusMeta.label}
                    {activeCount > 1 && <span className="font-black">({activeCount})</span>}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    Occupied
                  </span>
                )
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
