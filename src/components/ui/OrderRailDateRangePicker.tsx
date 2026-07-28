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
  triggerRef?: React.RefObject<HTMLElement>;
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
  initialStartDate,
  initialEndDate,
  initialPreset = "all",
  onApply,
}: OrderRailDateRangePickerProps) {
  const [draftPreset, setDraftPreset] = useState<DatePresetKey>(initialPreset);
  const [draftStart, setDraftStart] = useState<string | null>(initialStartDate ?? null);
  const [draftEnd, setDraftEnd] = useState<string | null>(initialEndDate ?? null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const todayStr = useMemo(() => toISODateString(new Date()), []);

  // Current month reference date
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

  // Handle ESC key to close & prevent body scroll
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

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

  // Render single month calendar grid helper
  const renderCalendarMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthName = monthDate.toLocaleString("en-US", { month: "long" });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const startingOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dayCells = [];
    for (let i = 0; i < startingOffset; i++) {
      dayCells.push(<div key={`pad-${i}`} className="h-9 w-9" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, "0");
      const moStr = String(month + 1).padStart(2, "0");
      const isoDate = `${year}-${moStr}-${dayStr}`;

      const isStart = draftStart === isoDate;
      const isEnd = draftEnd === isoDate;
      const isSingle = draftStart === isoDate && (draftEnd === isoDate || (!draftEnd && hoverDate === isoDate));
      const isToday = isoDate === todayStr;

      const effectiveEnd = draftEnd || (draftStart && hoverDate && hoverDate > draftStart ? hoverDate : null);
      const isInRange =
        draftStart && effectiveEnd && isoDate > draftStart && isoDate < effectiveEnd;

      dayCells.push(
        <button
          key={isoDate}
          onClick={() => handleDayClick(isoDate)}
          onMouseEnter={() => setHoverDate(isoDate)}
          className={cn(
            "h-9 w-9 text-xs font-semibold rounded-full transition duration-150 flex items-center justify-center cursor-pointer select-none relative",
            isSingle
              ? "bg-primary text-primary-foreground font-bold shadow-soft scale-105 z-10"
              : isStart
              ? "bg-primary text-primary-foreground font-bold rounded-r-none shadow-soft z-10"
              : isEnd
              ? "bg-primary text-primary-foreground font-bold rounded-l-none shadow-soft z-10"
              : isInRange
              ? "bg-primary/20 text-primary rounded-none font-bold"
              : isToday
              ? "ring-1 ring-primary/80 font-bold text-primary hover:bg-primary/10"
              : "text-foreground hover:bg-muted/70"
          )}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="w-full max-w-[320px] space-y-3">
        {/* Month Header Navigation */}
        <div className="flex items-center justify-between px-1 h-9">
          <div className="flex items-center gap-1">
            <button
              onClick={prevYear}
              title="Previous Year"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={prevMonth}
              title="Previous Month"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <span className="font-display text-base font-bold text-foreground tracking-tight">
            {monthName} {year}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={nextMonth}
              title="Next Month"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={nextYear}
              title="Next Year"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Backdrop Backdrop Click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Centered Card */}
      <div className="relative z-10 w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden text-foreground animate-in zoom-in-95 duration-150">
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <h3 className="font-display text-sm font-bold tracking-tight">Custom Reporting Date Range</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Ranges Section */}
          <div className="space-y-1.5 border-b border-border/40 pb-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Ranges</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {presetList.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150 cursor-pointer border shadow-xs h-7 inline-flex items-center justify-center gap-1",
                    draftPreset === p.id
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-soft"
                      : "bg-secondary/60 text-muted-foreground border-border/40 hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span>{p.label}</span>
                  {draftPreset === p.id && <CheckCircle2 className="h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>

          {/* Single Calendar */}
          <div className="flex justify-center py-1">
            {renderCalendarMonth(currentMonthDate)}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-border/50 bg-card shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Selected Range
            </span>
            <div className="font-display text-sm font-bold text-primary mt-0.5">
              {draftPreset === "all"
                ? "All Time"
                : draftStart === (draftEnd || draftStart)
                ? formatDateDDMMYYYY(draftStart)
                : `${formatDateDDMMYYYY(draftStart)} → ${formatDateDDMMYYYY(draftEnd || draftStart)}`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-border/60 bg-secondary/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground cursor-pointer h-9"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="rounded-full bg-primary px-5 py-1.5 text-xs font-bold text-primary-foreground shadow-soft transition hover:bg-primary/90 active:scale-95 cursor-pointer h-9"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
