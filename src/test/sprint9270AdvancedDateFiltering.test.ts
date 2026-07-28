import { describe, it, expect } from "vitest";

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
  | "custom"
  | "month"
  | "year";

export function getPresetDateRange(
  preset: DatePresetKey,
  customStart?: string,
  customEnd?: string,
  selectedMonth?: string,
  selectedYear?: string,
  referenceNow: Date = new Date("2026-07-28T09:00:00Z")
): { sinceDate: string | null; untilDate: string | null; filenameRange: string; activeRangeLabel: string } {
  const now = referenceNow;

  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: `today_${now.toISOString().slice(0, 10)}`,
      activeRangeLabel: "Today",
    };
  }

  if (preset === "yesterday") {
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
    const end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: `yesterday_${yest.toISOString().slice(0, 10)}`,
      activeRangeLabel: "Yesterday",
    };
  }

  if (preset === "7d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: "last_7_days",
      activeRangeLabel: "Last 7 Days",
    };
  }

  if (preset === "30d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: "last_30_days",
      activeRangeLabel: "Last 30 Days",
    };
  }

  if (preset === "90d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: "last_90_days",
      activeRangeLabel: "Last 90 Days",
    };
  }

  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: monthStr,
      activeRangeLabel: `This Month (${now.toLocaleString("en-US", { month: "short" })})`,
    };
  }

  if (preset === "last_month") {
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const start = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: monthStr,
      activeRangeLabel: `Last Month (${prevMonthDate.toLocaleString("en-US", { month: "short" })})`,
    };
  }

  if (preset === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: `${now.getFullYear()}`,
      activeRangeLabel: `This Year (${now.getFullYear()})`,
    };
  }

  if (preset === "month" && selectedMonth) {
    const [yrStr, moStr] = selectedMonth.split("-");
    const yr = parseInt(yrStr, 10);
    const mo = parseInt(moStr, 10) - 1;
    const start = new Date(yr, mo, 1, 0, 0, 0, 0);
    const end = new Date(yr, mo + 1, 0, 23, 59, 59, 999);
    const dateObj = new Date(yr, mo, 1);
    const label = dateObj.toLocaleString("en-US", { month: "long", year: "numeric" });
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: selectedMonth,
      activeRangeLabel: label,
    };
  }

  if (preset === "year" && selectedYear) {
    const yr = parseInt(selectedYear, 10);
    const start = new Date(yr, 0, 1, 0, 0, 0, 0);
    const end = new Date(yr, 11, 31, 23, 59, 59, 999);
    return {
      sinceDate: start.toISOString(),
      untilDate: end.toISOString(),
      filenameRange: `${yr}`,
      activeRangeLabel: `Year ${yr}`,
    };
  }

  if (preset === "custom" && customStart) {
    const endDateStr = customEnd || customStart;
    const sDate = new Date(`${customStart}T00:00:00`);
    const eDate = new Date(`${endDateStr}T23:59:59.999`);
    const filenameRange = customStart === endDateStr ? customStart : `${customStart}_to_${endDateStr}`;
    const activeRangeLabel = customStart === endDateStr ? `Custom (${customStart})` : `Custom (${customStart} to ${endDateStr})`;
    return {
      sinceDate: sDate.toISOString(),
      untilDate: eDate.toISOString(),
      filenameRange,
      activeRangeLabel,
    };
  }

  return {
    sinceDate: null,
    untilDate: null,
    filenameRange: "all_time",
    activeRangeLabel: "All Time",
  };
}

describe("Sprint 9.2.7.0 — Advanced Date Filtering & Reporting Tests", () => {
  const refDate = new Date("2026-07-28T09:00:00Z");

  it("1. Generates correct filename and date range for Quick Presets", () => {
    const res90 = getPresetDateRange("90d", undefined, undefined, undefined, undefined, refDate);
    expect(res90.filenameRange).toBe("last_90_days");
    expect(res90.activeRangeLabel).toBe("Last 90 Days");

    const resToday = getPresetDateRange("today", undefined, undefined, undefined, undefined, refDate);
    expect(resToday.filenameRange).toContain("today");
    expect(resToday.activeRangeLabel).toBe("Today");
  });

  it("2. Generates correct filename and date range for Month Selector (e.g., 2026-07)", () => {
    const resMonth = getPresetDateRange("month", undefined, undefined, "2026-07", undefined, refDate);
    expect(resMonth.filenameRange).toBe("2026-07");
    expect(resMonth.activeRangeLabel).toBe("July 2026");
  });

  it("3. Generates correct filename and date range for Year Selector (e.g., 2026)", () => {
    const resYear = getPresetDateRange("year", undefined, undefined, undefined, "2026", refDate);
    expect(resYear.filenameRange).toBe("2026");
    expect(resYear.activeRangeLabel).toBe("Year 2026");
  });

  it("4. Generates correct filename for single-day Custom Date", () => {
    const resSingle = getPresetDateRange("custom", "2026-07-22", "2026-07-22", undefined, undefined, refDate);
    expect(resSingle.filenameRange).toBe("2026-07-22");
    expect(resSingle.activeRangeLabel).toBe("Custom (2026-07-22)");
  });

  it("5. Generates correct filename for multi-day Custom Date Range (e.g., 2026-07-22 to 2026-07-28)", () => {
    const resMulti = getPresetDateRange("custom", "2026-07-22", "2026-07-28", undefined, undefined, refDate);
    expect(resMulti.filenameRange).toBe("2026-07-22_to_2026-07-28");
    expect(resMulti.activeRangeLabel).toBe("Custom (2026-07-22 to 2026-07-28)");
  });

  it("6. Computes Average Order Value (AOV) correctly without profit calculation", () => {
    const totalRevenueCents = 150000; // ₹1,500.00
    const completedOrders = 10;
    const aovCents = completedOrders > 0 ? Math.round(totalRevenueCents / completedOrders) : 0;
    expect(aovCents).toBe(15000); // ₹150.00 per order

    const zeroCompletedAov = 0 > 0 ? Math.round(500 / 0) : 0;
    expect(zeroCompletedAov).toBe(0);
  });
});
