import { useState, useEffect } from "react";
import { TableCardV3 } from "./TableCardV3";
import { useTableEngine } from "@/lib/counter/tableEngine/tableStore";
import { TableFilterType } from "@/lib/counter/tableEngine/tableTypes";
import { LayoutGrid, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export function TableGridV3() {
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

  const [activeZone, setActiveZone] = useState<string>("All");

  // Global Keyboard Listener for Grid Navigation (Arrow Keys & Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const floorZones = [
    { id: "All", label: "All", count: counts.all },
    { id: "Main", label: "Main Floor", count: 6 },
    { id: "Patio", label: "Patio", count: 4 },
    { id: "Bar", label: "Bar", count: 2 },
  ];

  const filterTabs: { id: TableFilterType; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "available", label: "Free", count: counts.available },
    { id: "occupied", label: "Active", count: counts.occupied + counts.bill_requested },
  ];

  return (
    <div className="flex flex-col h-full bg-card rounded-3xl p-3.5 shadow-soft ring-1 ring-border/60 justify-between select-none">
      {/* Header & Floor Zone Pills */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-xs font-bold flex items-center gap-1.5 text-foreground uppercase tracking-wider">
            <LayoutGrid className="h-3.5 w-3.5 text-brand" />
            <span>TABLES DECK</span>
          </h2>
          <span className="text-[11px] font-mono text-muted-foreground font-medium">
            (Alt+T)
          </span>
        </div>

        {/* Floor Zone Pills (Recommended in COUNTER_V3_DESIGN_REVIEW.md) */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-[11px] font-medium mb-2">
          {floorZones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => setActiveZone(zone.id)}
              className={cn(
                "px-2.5 py-1 rounded-xl transition whitespace-nowrap border shrink-0 flex items-center gap-1",
                activeZone === zone.id
                  ? "bg-foreground text-background border-foreground font-semibold shadow-soft"
                  : "bg-secondary/40 text-muted-foreground border-border/60 hover:text-foreground"
              )}
            >
              <Layers className="h-3 w-3" />
              <span>{zone.label}</span>
            </button>
          ))}
        </div>

        {/* Status Filter Pills */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-secondary/80 text-[11px] font-medium mb-2">
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
            <span>No tables match current zone/filter.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredTables.map((table) => (
              <TableCardV3
                key={table.id}
                table={table}
                isSelected={selectedTableId === table.id}
                onSelect={() => selectTable(table.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
