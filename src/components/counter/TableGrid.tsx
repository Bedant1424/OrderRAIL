import { useEffect } from "react";
import { TableCard } from "./TableCard";
import { useTableEngine } from "@/lib/counter/tableEngine/tableStore";
import { TableFilterType } from "@/lib/counter/tableEngine/tableTypes";
import { LayoutGrid, Droplet, Receipt, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export function TableGrid() {
  const {
    filteredTables,
    selectedTableId,
    filter,
    counts,
    selectTable,
    setFilter,
    navigateGrid,
    clearSelection,
  } = useTableEngine();

  // Global Keyboard Listener for Grid Navigation (Arrow Keys & Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateGrid("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateGrid("right");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        navigateGrid("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        navigateGrid("down");
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateGrid, clearSelection]);

  const filterTabs: { id: TableFilterType; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "available", label: "Free", count: counts.available },
    { id: "occupied", label: "Occupied", count: counts.occupied },
    { id: "bill_requested", label: "Bill Req", count: counts.bill_requested },
    { id: "cleaning", label: "Cleaning", count: counts.cleaning },
  ];

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
        <div className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-secondary/80 text-[11px] font-medium mb-3">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                "py-1.5 rounded-xl transition text-center truncate px-1",
                filter === tab.id
                  ? "bg-card text-foreground font-semibold shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Table Cards */}
      <div className="flex-1 overflow-y-auto section-scroll pr-1 my-1">
        {filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground text-xs font-medium">
            <span>No tables match current filter.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                isSelected={selectedTableId === table.id}
                onSelect={() => selectTable(table.id)}
              />
            ))}
          </div>
        )}
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
