import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  formatWeeklySchedule,
  getOpeningHoursSpecification,
  saveOperationsSettings,
  DEFAULT_OPERATIONS_SETTINGS,
  type OperationsSettings,
  type DaySchedule,
} from "@/lib/billing/operationsSettings";
import { supabase } from "@/lib/db";

// Mock Supabase
vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    supabase: {
      from: vi.fn(),
    },
  };
});

describe("weekly_schedule Single Source of Truth Utilities & Persistence", () => {
  const testCafeId = "8c418a5a-7cd4-4054-8a88-f412c1762f7d";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("1. formatWeeklySchedule() Helper Tests", () => {
    it("A. All 7 days identical hours: Formats as 'Open Daily: HH:MM AM/PM - HH:MM AM/PM'", () => {
      const schedule: Record<number, DaySchedule> = {
        0: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        1: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        2: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        3: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        4: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        5: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        6: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
      };

      expect(formatWeeklySchedule(schedule)).toBe("Open Daily: 10:00 AM - 11:00 PM");
    });

    it("B. Mon-Fri / Sat-Sun grouping: Groups consecutive days with identical hours", () => {
      const schedule: Record<number, DaySchedule> = {
        0: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        1: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        2: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        3: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        4: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        5: { isOpen: true, openTime: "08:00", closeTime: "20:00" },
        6: { isOpen: true, openTime: "08:00", closeTime: "20:00" },
      };

      expect(formatWeeklySchedule(schedule)).toBe(
        "Mon-Fri: 07:00 AM - 06:00 PM, Sat-Sun: 08:00 AM - 08:00 PM"
      );
    });

    it("C. Closed day handling: Formats closed days correctly", () => {
      const schedule: Record<number, DaySchedule> = {
        0: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        1: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        2: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        3: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        4: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        5: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        6: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
      };

      expect(formatWeeklySchedule(schedule)).toBe("Mon-Sat: 08:00 AM - 10:00 PM, Sun: Closed");
    });

    it("D. All days closed: Formats as 'Closed'", () => {
      const schedule: Record<number, DaySchedule> = {
        0: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        1: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        2: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        3: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        4: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        5: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        6: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
      };

      expect(formatWeeklySchedule(schedule)).toBe("Closed");
    });

    it("E. Overnight hours: Formats 20:00 to 02:00 properly", () => {
      const schedule: Record<number, DaySchedule> = {
        0: { isOpen: true, openTime: "20:00", closeTime: "02:00" },
        1: { isOpen: true, openTime: "20:00", closeTime: "02:00" },
        2: { isOpen: true, openTime: "20:00", closeTime: "02:00" },
        3: { isOpen: true, openTime: "20:00", closeTime: "02:00" },
        4: { isOpen: true, openTime: "20:00", closeTime: "02:00" },
        5: { isOpen: true, openTime: "20:00", closeTime: "02:00" },
        6: { isOpen: true, openTime: "20:00", closeTime: "02:00" },
      };

      expect(formatWeeklySchedule(schedule)).toBe("Open Daily: 08:00 PM - 02:00 AM");
    });

    it("F. Null or undefined schedule: Safely falls back to DEFAULT_WEEKLY_SCHEDULE", () => {
      const resNull = formatWeeklySchedule(null);
      expect(resNull).toContain("Mon-Thu");
      expect(resNull).toContain("08:00 AM - 10:00 PM");

      const resUndefined = formatWeeklySchedule(undefined);
      expect(resUndefined).toContain("Mon-Thu");
    });
  });

  describe("2. getOpeningHoursSpecification() Helper Tests", () => {
    it("A. All 7 days open: Maps days array and exact opens/closes", () => {
      const schedule: Record<number, DaySchedule> = {
        0: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        1: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        2: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        3: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        4: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        5: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        6: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
      };

      const specs = getOpeningHoursSpecification(schedule);
      expect(specs).toHaveLength(1);
      expect(specs[0]).toEqual({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "10:00",
        closes: "23:00",
      });
    });

    it("B. Omits closed days and handles multiple schedule groups", () => {
      const schedule: Record<number, DaySchedule> = {
        0: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        1: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        2: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        3: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        4: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
        5: { isOpen: true, openTime: "08:00", closeTime: "20:00" },
        6: { isOpen: false, openTime: "08:00", closeTime: "20:00" }, // Closed Sunday
      };

      const specs = getOpeningHoursSpecification(schedule);
      expect(specs).toHaveLength(2);
      expect(specs[0]).toEqual({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "07:00",
        closes: "18:00",
      });
      expect(specs[1]).toEqual({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "08:00",
        closes: "20:00",
      });
    });

    it("C. All days closed: Returns empty array", () => {
      const schedule: Record<number, DaySchedule> = {
        0: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        1: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        2: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        3: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        4: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        5: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
        6: { isOpen: false, openTime: "08:00", closeTime: "22:00" },
      };

      const specs = getOpeningHoursSpecification(schedule);
      expect(specs).toEqual([]);
    });
  });

  describe("3. saveOperationsSettings Legacy Synchronization", () => {
    it("Automatically synchronizes formatted operating_hours to cafes table", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

      const customSettings: OperationsSettings = {
        ...DEFAULT_OPERATIONS_SETTINGS,
        weeklySchedule: {
          0: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
          1: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
          2: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
          3: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
          4: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
          5: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
          6: { isOpen: true, openTime: "10:00", closeTime: "23:00" },
        },
      };

      const res = await saveOperationsSettings(customSettings, testCafeId);
      expect(res.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          weekly_schedule: customSettings.weeklySchedule,
          operating_hours: "Open Daily: 10:00 AM - 11:00 PM",
        })
      );
    });
  });
});
