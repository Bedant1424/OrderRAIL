import { useState, useMemo } from "react";
import { TableCard, type TableCardData, type TableState } from "./TableCard";
import { LayoutGrid, Droplet, Receipt, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface TableGridProps {
  tables?: TableCardData[];
  selectedTableId?: string | null;
  onSelectTable?: (table: TableCardData) => void;
}

// Sample fallback table layout for Foundation shell
const DEFAULT_TABLES: TableCardData[] = [
  { id: "t-1", label: "Table 1", seats: 4, status: "free" },
  { id: "t-2", label: "Table 2", seats: 2, status: "occupied", elapsedTime: "14m ago", itemsCount: 3, totalAmount: 28.5 },
  { id: "t-3", label: "Table 3", seats: 6, status: "free" },
  { id: "t-4", label: "Table 4", seats: 4, status: "bill_requested", elapsedTime: "32m ago", itemsCount: 4, totalAmount: 37.5, sessionCode: "s-9821" },
  { id: "t-5", label: "Table 5", seats: 2, status: "free" },
  { id: "t-6", label: "Table 6", seats: 8, status: "occupied", elapsedTime: "05m ago", itemsCount: 2, totalAmount: 16.0 },
  { id: "t-7", label: "Table 7", seats: 4, status: "free" },
  { id: "t-8", label: "Table 8", seats: 4, status: "free" },
  { id: "t-9", label: "Table 9", seats: 2, status: "free" },
  { id: "t-10", label: "Table 10", seats: 6, status: "free" },
  { id: "t-11", label: "Table 11", seats: 4, status: "free" },
  { id: "t-12", label: "Table 12", seats: 4, status: "occupied", elapsedTime: "48m ago", itemsCount: 5, totalAmount: 52.0 },
];

export function TableGrid({ tables = DEFAULT_TABLES, selectedTableId = "t-4", onSelectTable }: TableGridProps) {
  const [filter, setFilter] = useState<"all" | "free" | "occupied">("all");

  const counts = useMemo(() => {
    const total = tables.length;
    const free = tables.filter((t) => t.status === "free").length;
    const occupied = tables.filter((t) => t.status !== "free").length;
    return { total, free, occupied };
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (filter === "free") return tables.filter((t) => t.status === "free");
    if (filter === "occupied") return tables.filter((t) => t.status !== "free");
    return tables;
  }, [tables, filter]);

  return (
    <div className="flex flex-col h-full bg-card rounded-3xl p-4 shadow-soft ring-1 ring-border/60 justify-between select-none">
      {/* Header & Filter Tabs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-semibold flex items-center gap-1.5 text-foreground">
            <LayoutGrid className="h-4 w-4 text-brand" />
            <span>PHYSICAL TABLES</span>
          </h2>
          <span className="text-xs font-mono text-muted-foreground font-medium">
            (Alt+T)
          </span>
        </div>

        {/* Filter Pills */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-secondary/80 text-xs font-medium mb-3">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "py-1.5 rounded-xl transition text-center",
              filter === "all"
                ? "bg-card text-foreground font-semibold shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({counts.total})
          </button>
          <button
            onClick={() => setFilter("free")}
            className={cn(
              "py-1.5 rounded-xl transition text-center",
              filter === "free"
                ? "bg-card text-emerald-600 dark:text-emerald-400 font-semibold shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Free ({counts.free})
          </button>
          <button
            onClick={() => setFilter("occupied")}
            className={cn(
              "py-1.5 rounded-xl transition text-center",
              filter === "occupied"
                ? "bg-card text-amber-600 dark:text-amber-400 font-semibold shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Occupied ({counts.occupied})
          </button>
        </div>
      </div>

      {/* Grid of Table Cards */}
      <div className="flex-1 overflow-y-auto section-scroll pr-1 my-1">
        <div className="grid grid-cols-2 gap-2.5">
          {filteredTables.map((t) => (
            <TableCard
              key={t.id}
              table={t}
              isSelected={selectedTableId === t.id}
              onSelect={onSelectTable}
            />
          ))}
        </div>
      </div>

      {/* Unread Service Requests Alert Block */}
      <div className="mt-3 pt-3 border-t border-border/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 animate-bounce" /> UNREAD SERVICE REQUESTS (2)
          </span>
        </div>
        <div className="space-y-1.5 text-xs font-medium">
          <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-amber-900 dark:text-amber-300">
            <span className="flex items-center gap-1.5">
              <Droplet className="h-3.5 w-3.5 text-blue-500" /> Table 2: Water
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">45s ago</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-orange-500/10 border border-orange-500/20 px-2.5 py-1.5 text-orange-900 dark:text-orange-300">
            <span className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-orange-500" /> Table 4: Bill Request
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">12s ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
