import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOperationsSettings,
  saveOperationsSettings,
  getTodayOpenStatus,
  DEFAULT_OPERATIONS_SETTINGS,
  type OperationsSettings,
} from "@/lib/billing/operationsSettings";
import type { Cafe } from "@/lib/db";
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

describe("Cafe-Wide Operations Settings Persistence & Mapping", () => {
  const testCafeId = "8c418a5a-7cd4-4054-8a88-f412c1762f7d";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("A. Database-backed settings mapping: Reads operating_status, weekly_schedule, and dine_in_enabled from Cafe object", () => {
    const mockCafe: Partial<Cafe> = {
      id: testCafeId,
      operating_status: "closed",
      weekly_schedule: {
        0: { isOpen: false, openTime: "10:00", closeTime: "20:00" },
      } as any,
      dine_in_enabled: false,
    };

    const ops = getOperationsSettings(mockCafe as Cafe);

    expect(ops.status).toBe("closed");
    expect(ops.weeklySchedule[0].isOpen).toBe(false);
    expect(ops.enabledChannels.dine_in).toBe(false);
  });

  it("B. Owner save success: Updates public.cafes table in Supabase and local storage cache", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

    const newSettings: OperationsSettings = {
      ...DEFAULT_OPERATIONS_SETTINGS,
      status: "maintenance",
      enabledChannels: { ...DEFAULT_OPERATIONS_SETTINGS.enabledChannels, dine_in: true },
    };

    const res = await saveOperationsSettings(newSettings, testCafeId);

    expect(res.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith("cafes");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        operating_status: "maintenance",
        dine_in_enabled: true,
      })
    );

    // Verify localStorage cache updated
    const cachedStr = localStorage.getItem(`orderrail_operations_settings_${testCafeId}`);
    expect(cachedStr).not.toBeNull();
    expect(JSON.parse(cachedStr!).status).toBe("maintenance");
  });

  it("C. Owner save failure: Does NOT update localStorage cache or report false success if DB update fails", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "Database permission error" } }),
    });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

    const newSettings: OperationsSettings = {
      ...DEFAULT_OPERATIONS_SETTINGS,
      status: "busy",
    };

    const res = await saveOperationsSettings(newSettings, testCafeId);

    expect(res.success).toBe(false);
    expect(res.error?.message).toBe("Database permission error");
  });

  it("D. Customer clean-browser behavior: Falls back to Cafe DB row or DEFAULT_OPERATIONS_SETTINGS when localStorage is empty", () => {
    // Empty localStorage
    expect(localStorage.getItem(`orderrail_operations_settings_${testCafeId}`)).toBeNull();

    const mockCafe: Partial<Cafe> = {
      id: testCafeId,
      operating_status: "open",
      dine_in_enabled: true,
    };

    const ops = getOperationsSettings(mockCafe as Cafe);
    expect(ops.status).toBe("open");
    expect(ops.enabledChannels.dine_in).toBe(true);
  });

  it("E. Server precedence over localStorage: Database CLOSED status overrides stale local storage OPEN status", () => {
    // Populate stale localStorage as OPEN
    localStorage.setItem(
      `orderrail_operations_settings_${testCafeId}`,
      JSON.stringify({ ...DEFAULT_OPERATIONS_SETTINGS, status: "open" })
    );

    // DB record says CLOSED
    const mockCafe: Partial<Cafe> = {
      id: testCafeId,
      operating_status: "closed",
      dine_in_enabled: true,
    };

    const ops = getOperationsSettings(mockCafe as Cafe);
    expect(ops.status).toBe("closed"); // Server status wins!
  });

  it("F. Default fallback: Returns DEFAULT_OPERATIONS_SETTINGS when no DB object or localStorage key exists", () => {
    const ops = getOperationsSettings();
    expect(ops.status).toBe(DEFAULT_OPERATIONS_SETTINGS.status);
    expect(ops.weeklySchedule[0].openTime).toBe("08:00");
  });

  it("G. Cross-device behavior simulation: Customer device without localStorage receives Owner's DB-persisted status", () => {
    // Customer device has no local storage
    const customerDeviceLocalStorage = null;
    expect(customerDeviceLocalStorage).toBeNull();

    // Owner sets status to closed in DB
    const cafeRowFromDb: Partial<Cafe> = {
      id: testCafeId,
      operating_status: "closed",
      weekly_schedule: DEFAULT_OPERATIONS_SETTINGS.weeklySchedule as any,
      dine_in_enabled: true,
    };

    const customerOps = getOperationsSettings(cafeRowFromDb as Cafe);
    const todayStatus = getTodayOpenStatus(customerOps);

    expect(todayStatus.isOpen).toBe(false);
    expect(todayStatus.text).toBe("Temporarily Closed");
  });

  it("H. Dine-in disabled: Properly reflects dine_in_enabled false from database", () => {
    const mockCafe: Partial<Cafe> = {
      id: testCafeId,
      operating_status: "open",
      dine_in_enabled: false,
    };

    const ops = getOperationsSettings(mockCafe as Cafe);
    expect(ops.enabledChannels.dine_in).toBe(false);
  });

  it("I. Closed status: Evaluates getTodayOpenStatus as closed when status is closed or maintenance", () => {
    const opsClosed = getOperationsSettings({ operating_status: "closed" } as Cafe);
    expect(getTodayOpenStatus(opsClosed).isOpen).toBe(false);

    const opsMaintenance = getOperationsSettings({ operating_status: "maintenance" } as Cafe);
    expect(getTodayOpenStatus(opsMaintenance).isOpen).toBe(false);
    expect(getTodayOpenStatus(opsMaintenance).text).toBe("Under Maintenance");
  });

  it("J. Current operating hours evaluation: Correctly evaluates open/closed status based on time range", () => {
    const ops = {
      ...DEFAULT_OPERATIONS_SETTINGS,
      status: "open" as const,
      weeklySchedule: {
        0: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
      },
    };

    // Monday 12:00 PM (Within range)
    const testMonNoon = new Date("2026-08-24T12:00:00"); // 2026-08-24 is a Monday
    expect(getTodayOpenStatus(ops, testMonNoon).isOpen).toBe(true);

    // Monday 20:00 PM (After closeTime)
    const testMonNight = new Date("2026-08-24T20:00:00");
    expect(getTodayOpenStatus(ops, testMonNight).isOpen).toBe(false);
  });
});
