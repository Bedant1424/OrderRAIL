import { memo } from "react";
import { cn } from "@/lib/utils";
import { TableEntity } from "@/lib/counter/tableEngine/tableTypes";
import { Clock, Receipt, CheckCircle2, Sparkles, AlertTriangle, Bookmark, Droplet } from "lucide-react";

interface TableCardV3Props {
  table: TableEntity;
  isSelected?: boolean;
  onSelect?: (table: TableEntity) => void;
}

export const TableCardV3 = memo(function TableCardV3({
  table,
  isSelected = false,
  onSelect,
}: TableCardV3Props) {
  const isAvailable = table.status === "AVAILABLE";
  const isOccupied = table.status === "OCCUPIED";
  const isBillReq = table.status === "BILL_REQUESTED";
  const isCleaning = table.status === "CLEANING";
  const isReserved = table.status === "RESERVED";
  const isOutOfService = table.status === "OUT_OF_SERVICE";

  const hasWaterCall = table.id === "t-2";
  const hasBillCall = table.id === "t-4";

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={`${table.label}, status ${table.status}`}
      onClick={() => onSelect?.(table)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(table);
        }
      }}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl p-2.5 transition-all duration-150 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-brand min-h-[72px] shadow-sm hover:shadow-md hover:scale-[1.015] active:scale-[0.985]",
        // Soft background fills instead of heavy borders (Refinement Goal 1 & 6)
        isAvailable && "bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/15",
        isOccupied && "bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/20",
        isBillReq && "bg-orange-500/12 hover:bg-orange-500/20 border border-orange-500/40 animate-pulse",
        isCleaning && "bg-blue-500/8 hover:bg-blue-500/15 border border-blue-500/25 dark:border-blue-500/20",
        isReserved && "bg-purple-500/8 hover:bg-purple-500/15 border border-purple-500/25 dark:border-purple-500/20",
        isOutOfService && "bg-muted/30 border border-border/40 opacity-70 hover:opacity-90",
        // Distinct selection indicator with glowing ring and elevated card fill
        isSelected && "ring-2 ring-brand ring-offset-2 ring-offset-background border-brand bg-brand/10 shadow-float"
      )}
    >
      {/* Top Row: Label & Micro Service Alert Badges */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold text-sm tracking-tight text-foreground">
            {table.label}
          </span>
          {isSelected && (
            <CheckCircle2 className="h-3.5 w-3.5 text-brand fill-brand/20 shrink-0" />
          )}
        </div>

        {/* Micro-badge Service Alert Indicator */}
        {hasWaterCall && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-blue-500 bg-blue-500/15 px-1.5 py-0.5 rounded-md animate-bounce" title="Water Requested">
            <Droplet className="h-2.5 w-2.5 fill-blue-500" />
          </span>
        )}
        {hasBillCall && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-orange-500 bg-orange-500/15 px-1.5 py-0.5 rounded-md animate-pulse" title="Bill Requested">
            <Receipt className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {/* Bottom Row: Status Pill & Elapsed Timer */}
      <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-border/20 text-xs">
        {isAvailable && (
          <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase">
            FREE
          </span>
        )}
        {isOccupied && (
          <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase">
            OCCUPIED
          </span>
        )}
        {isBillReq && (
          <span className="rounded-full bg-orange-500 text-white px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase flex items-center gap-0.5 shadow-soft">
            <Receipt className="h-2.5 w-2.5 animate-spin" /> BILL REQ
          </span>
        )}
        {isCleaning && (
          <span className="rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase flex items-center gap-0.5">
            <Sparkles className="h-2.5 w-2.5" /> CLEANING
          </span>
        )}
        {isReserved && (
          <span className="rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-400 px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase flex items-center gap-0.5">
            <Bookmark className="h-2.5 w-2.5" /> RESERVED
          </span>
        )}
        {isOutOfService && (
          <span className="rounded-full bg-muted/80 text-muted-foreground px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase flex items-center gap-0.5">
            <AlertTriangle className="h-2.5 w-2.5" /> OUT OF SVC
          </span>
        )}

        {(isOccupied || isBillReq) && (
          <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground font-bold">
            <Clock className="h-2.5 w-2.5" />
            <span>14m</span>
          </div>
        )}
      </div>
    </div>
  );
});
