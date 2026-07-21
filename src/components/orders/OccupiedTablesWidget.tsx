import { useMemo } from "react";
import { Utensils } from "lucide-react";
import type { TableRow, Order } from "@/lib/db";
import { getTableStatus, calculateOccupiedTables } from "@/lib/tables/occupancy";
import { cn } from "@/lib/utils";

export interface OccupiedTablesWidgetProps {
  tables: TableRow[];
  orders?: Order[];
  onSelectTable?: (table: TableRow, activeOrder?: Order) => void;
  selectedTableId?: string | null;
}

export default function OccupiedTablesWidget({
  tables,
  orders = [],
  onSelectTable,
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

  const occupiedCount = useMemo(() => calculateOccupiedTables(tables, orders).length, [tables, orders]);
  const totalTables = tables.length || 1;

  return (
    <div className="rounded-3xl bg-card p-4 sm:p-5 shadow-soft ring-1 ring-border/60 space-y-3">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 font-bold">
            <Utensils className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">Occupied Tables</h3>
            <p className="text-[11px] text-muted-foreground">
              {occupiedCount} of {totalTables} tables occupied · Active dining sessions
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Free</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Occupied / Seated</span>
        </div>
      </div>

      {/* Table Chips Grid */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {sortedTables.map((table) => {
          const statusInfo = getTableStatus(table, orders);
          const isSelected = selectedTableId === table.id;
          const primaryOrder = statusInfo.activeOrders[0];

          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onSelectTable?.(table, primaryOrder)}
              title={`Table ${table.label} (${statusInfo.isOccupied ? "Occupied" : "Free"})`}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-semibold transition shadow-soft active:scale-95",
                statusInfo.isOccupied
                  ? "bg-amber-500/10 text-amber-900 border-amber-500/30 dark:text-amber-200 font-bold"
                  : "bg-secondary/40 text-foreground border-border/60 hover:bg-secondary",
                isSelected && "ring-2 ring-primary border-transparent"
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", statusInfo.isOccupied ? "bg-amber-500" : "bg-emerald-500")} />
              <span>Table {table.label}</span>
              <span className="text-[10px] font-bold opacity-80">({statusInfo.isOccupied ? "Occupied" : "Free"})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
