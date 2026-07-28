import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  X
} from "lucide-react";
import { AnchoredPopover } from "@/components/ui/AnchoredPopover";
import { cn } from "@/lib/utils";

export type DatePresetKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "all"
  | "custom";

interface OrderRailDateRangePickerProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
  initialStartDate?: string | null; // YYYY-MM-DD
  initialEndDate?: string | null;   // YYYY-MM-DD
  initialPreset?: DatePresetKey;
  onApply: (startDate: string | null, endDate: string | null, presetKey: DatePresetKey) => void;
}

// Helper: Format YYYY-MM-DD string to DD/MM/YYYY
export function formatDateDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const [yr, mo, dy] = dateStr.split("-");
  if (!yr || !mo || !dy) return dateStr;
  return `${dy.padStart(2, "0")}/${mo.padStart(2, "0")}/${yr}`;
}

// Helper: Get YYYY-MM-DD from Date object
export function toISODateString(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
}

// Helper: Get range bounds for preset
export function getPresetDates(key: DatePresetKey, refNow: Date = new Date()): { start: string | null; end: string | null } {
  const now = refNow;
  if (key === "today") {
    const s = toISODateString(now);
    return { start: s, end: s };
  }
  if (key === "yesterday") {
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const s = toISODateString(yest);
    return { start: s, end: s };
  }
  if (key === "7d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { start: toISODateString(start), end: toISODateString(now) };
  }
  if (key === "30d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    return { start: toISODateString(start), end: toISODateString(now) };
  }
  if (key === "90d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
    return { start: toISODateString(start), end: toISODateString(now) };
  }
  if (key === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toISODateString(start), end: toISODateString(end) };
  }
  if (key === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toISODateString(start), end: toISODateString(end) };
  }
  if (key === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start: toISODateString(start), end: toISODateString(end) };
  }
  return { start: null, end: null };
}

export function OrderRailDateRangePicker({
  open,
  onClose,
  triggerRef,
  initialStartDate,
  initialEndDate,
  initialPreset = "all",
  onApply,
}: OrderRailDateRangePickerProps) {
  const [draftPreset, setDraftPreset] = useState<DatePresetKey>(initialPreset);
  const [draftStart, setDraftStart] = useState<string | null>(initialStartDate ?? null);
  const [draftEnd, setDraftEnd] = useState<string | null>(initialEndDate ?? null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Month 1 reference date (defaults to current month or draftStart month)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    if (initialStartDate) {
      const [y, m] = initialStartDate.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Sync draft state when opened
  useEffect(() => {
    if (open) {
      setDraftPreset(initialPreset);
      setDraftStart(initialStartDate ?? null);
      setDraftEnd(initialEndDate ?? null);

      if (initialStartDate) {
        const [y, m] = initialStartDate.split("-").map(Number);
        setCurrentMonthDate(new Date(y, m - 1, 1));
      } else {
        const d = new Date();
        setCurrentMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [open, initialStartDate, initialEndDate, initialPreset]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Derived Month 2 (Next month)
  const month2Date = useMemo(() => {
    return new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
  }, [currentMonthDate]);

  // Handlers for month/year navigation
  const prevMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const prevYear = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
  };
  const nextYear = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
  };

  // Preset selection handler
  const handleSelectPreset = (key: DatePresetKey) => {
    setDraftPreset(key);
    if (key === "all") {
      setDraftStart(null);
      setDraftEnd(null);
    } else {
      const { start, end } = getPresetDates(key);
      setDraftStart(start);
      setDraftEnd(end);
      if (start) {
        const [y, m] = start.split("-").map(Number);
        setCurrentMonthDate(new Date(y, m - 1, 1));
      }
    }
  };

  // Day click handler (2-click selection model)
  const handleDayClick = (isoDate: string) => {
    setDraftPreset("custom");
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(isoDate);
      setDraftEnd(null);
    } else if (draftStart && !draftEnd) {
      if (isoDate < draftStart) {
        setDraftStart(isoDate);
        setDraftEnd(null);
      } else {
        setDraftEnd(isoDate);
      }
    }
  };

  const handleApply = () => {
    onApply(draftStart, draftEnd || draftStart, draftPreset);
    onClose();
  };

  // Render month calendar grid helper
  const renderCalendarMonth = (monthDate: Date, showPrevNav = false, showNextNav = false) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthName = monthDate.toLocaleString("en-US", { month: "long" });

    // First day of month (0 = Sunday, 1 = Monday, etc.)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Convert Sunday-indexed to Monday-indexed (Mon=0, Tue=1... Sun=6)
    const startingOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dayCells = [];
    // Padding cells before day 1
    for (let i = 0; i < startingOffset; i++) {
      dayCells.push(<div key={`pad-${i}`} className="h-8 w-8" />);
    }

    // Active day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, "0");
      const moStr = String(month + 1).padStart(2, "0");
      const isoDate = `${year}-${moStr}-${dayStr}`;

      const isStart = draftStart === isoDate;
      const isEnd = draftEnd === isoDate;
      const isSingle = draftStart === isoDate && (draftEnd === isoDate || (!draftEnd && hoverDate === isoDate));

      // Range evaluation
      const effectiveEnd = draftEnd || (draftStart && hoverDate && hoverDate > draftStart ? hoverDate : null);
      const isInRange =
        draftStart && effectiveEnd && isoDate > draftStart && isoDate < effectiveEnd;

      dayCells.push(
        <button
          key={isoDate}
          onClick={() => handleDayClick(isoDate)}
          onMouseEnter={() => setHoverDate(isoDate)}
          className={cn(
            "h-8 w-8 text-xs font-semibold rounded-full transition duration-150 flex items-center justify-center cursor-pointer select-none",
            isSingle
              ? "bg-primary text-primary-foreground font-bold shadow-soft scale-105"
              : isStart
              ? "bg-primary text-primary-foreground font-bold rounded-r-none shadow-soft"
              : isEnd
              ? "bg-primary text-primary-foreground font-bold rounded-l-none shadow-soft"
              : isInRange
              ? "bg-primary/20 text-primary rounded-none font-bold"
              : "text-foreground hover:bg-muted/70"
          )}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="w-64 space-y-3">
        {/* Month Header Navigation */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            {showPrevNav && (
              <>
                <button
                  onClick={prevYear}
                  title="Previous Year"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={prevMonth}
                  title="Previous Month"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          <span className="font-display text-sm font-bold text-foreground">
            {monthName} {year}
          </span>

          <div className="flex items-center gap-1">
            {showNextNav && (
              <>
                <button
                  onClick={nextMonth}
                  title="Next Month"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={nextYear}
                  title="Next Year"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
          <span>Su</span>
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7 gap-y-1 place-items-center" onMouseLeave={() => setHoverDate(null)}>
          {dayCells}
        </div>
      </div>
    );
  };

  const presetList: { id: DatePresetKey; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "Last 7 Days" },
    { id: "30d", label: "Last 30 Days" },
    { id: "90d", label: "Last 90 Days" },
    { id: "this_month", label: "This Month" },
    { id: "last_month", label: "Last Month" },
    { id: "this_year", label: "This Year" },
    { id: "all", label: "All Time" },
  ];

  return (
    <AnchoredPopover open={open} onClose={onClose} triggerRef={triggerRef} className="w-[660px] max-w-[95vw]">
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-2xl space-y-4 text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold tracking-tight">Custom Reporting Date Range</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dual Calendar & Sidebar Layout */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Quick Presets Sidebar */}
          <div className="w-full md:w-40 space-y-1 border-b md:border-b-0 md:border-r border-border/50 pb-3 md:pb-0 md:pr-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Presets</div>
            {presetList.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={cn(
                  "w-full flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer text-left",
                  draftPreset === p.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{p.label}</span>
                {draftPreset === p.id && <CheckCircle2 className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>

          {/* Dual Month Calendars */}
          <div className="flex-1 flex flex-col sm:flex-row gap-6 justify-center">
            {renderCalendarMonth(currentMonthDate, true, false)}
            {renderCalendarMonth(month2Date, false, true)}
          </div>
        </div>

        {/* Footer & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
          {/* Selected Period Preview */}
          <div className="text-xs">
            <span className="text-muted-foreground mr-1">Selected Range:</span>
            <span className="font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
              {draftPreset === "all"
                ? "All Time"
                : draftStart === (draftEnd || draftStart)
                ? formatDateDDMMYYYY(draftStart)
                : `${formatDateDDMMYYYY(draftStart)} → ${formatDateDDMMYYYY(draftEnd || draftStart)}`}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-border/60 bg-secondary/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="rounded-full bg-primary px-5 py-1.5 text-xs font-bold text-primary-foreground shadow-soft transition hover:bg-primary/90 active:scale-95 cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </AnchoredPopover>
  );
}
