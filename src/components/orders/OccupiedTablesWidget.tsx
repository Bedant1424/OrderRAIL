import { useMemo } from "react";
import { Utensils, CheckCircle2, ChevronRight, Users } from "lucide-react";
import type { TableRow, Order } from "@/lib/db";
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
  // Map occupied tables to their active pending orders count
  const occupiedTableStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of pendingOrders) {
      const cur = map.get(o.table_id) ?? 0;
      map.set(o.table_id, cur + 1);
    }
    return map;
  }, [pendingOrders]);

  const totalTables = tables.length || 1;
  const occupiedCount = occupiedTableStats.size;
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

      {/* Table Chips Stream */}
      <div className="flex flex-wrap items-center gap-2">
        {tables.map((table) => {
          const activeOrdersCount = occupiedTableStats.get(table.id) ?? 0;
          const isOccupied = activeOrdersCount > 0;
          const isSelected = selectedTableId === table.id;

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
                <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[10px] font-extrabold text-amber-950 tabular-nums">
                  {activeOrdersCount}
                </span>
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
