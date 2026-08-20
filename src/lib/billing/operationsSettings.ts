import { supabase, type Cafe } from "@/lib/db";

export type RestaurantStatus = "open" | "busy" | "closed" | "maintenance";
export type KdsRefreshInterval = "2s" | "5s" | "10s" | "30s";
export type SessionTimeoutOption = "30m" | "60m" | "90m" | "never";

export interface DaySchedule {
  isOpen: boolean;
  openTime: string; // HH:mm format, e.g. "08:00"
  closeTime: string; // HH:mm format, e.g. "22:00"
}

export type OrderChannel = "dine_in" | "counter" | "takeaway" | "swiggy" | "zomato";

export interface OperationsSettings {
  // Restaurant Status
  status: RestaurantStatus;

  // Operating Hours (Monday = 0 ... Sunday = 6)
  weeklySchedule: Record<number, DaySchedule>;

  // Order Channels
  enabledChannels: Record<OrderChannel, boolean>;

  // Kitchen Behavior
  kdsRefreshInterval: KdsRefreshInterval;
  kdsAutoScroll: boolean;
  kdsSoundEnabled: boolean;
  kdsHighlightDelayed: boolean;

  // Table Behavior
  autoReleaseTable: boolean;
  sessionTimeout: SessionTimeoutOption;

  // KOT Printing Behavior
  autoPrintKot: boolean;
  reprintOnEdit: boolean;
  printCustomerCopy: boolean;
  printKitchenCopy: boolean;
}

export const DEFAULT_WEEKLY_SCHEDULE: Record<number, DaySchedule> = {
  0: { isOpen: true, openTime: "08:00", closeTime: "22:00" }, // Monday
  1: { isOpen: true, openTime: "08:00", closeTime: "22:00" }, // Tuesday
  2: { isOpen: true, openTime: "08:00", closeTime: "22:00" }, // Wednesday
  3: { isOpen: true, openTime: "08:00", closeTime: "22:00" }, // Thursday
  4: { isOpen: true, openTime: "08:00", closeTime: "23:00" }, // Friday
  5: { isOpen: true, openTime: "09:00", closeTime: "23:00" }, // Saturday
  6: { isOpen: true, openTime: "08:00", closeTime: "22:00" }, // Sunday
};

export const DEFAULT_OPERATIONS_SETTINGS: OperationsSettings = {
  status: "open",
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
  enabledChannels: {
    dine_in: true,
    counter: true,
    takeaway: true,
    swiggy: true,
    zomato: true,
  },
  kdsRefreshInterval: "5s",
  kdsAutoScroll: true,
  kdsSoundEnabled: true,
  kdsHighlightDelayed: true,
  autoReleaseTable: true,
  sessionTimeout: "60m",
  autoPrintKot: true,
  reprintOnEdit: true,
  printCustomerCopy: true,
  printKitchenCopy: true,
};

/**
 * Checks if the restaurant is currently open based on weekly schedule and status override.
 */
export function getTodayOpenStatus(settings: OperationsSettings, date: Date = new Date()): { isOpen: boolean; text: string } {
  if (settings.status === "closed" || settings.status === "maintenance") {
    return { isOpen: false, text: settings.status === "maintenance" ? "Under Maintenance" : "Temporarily Closed" };
  }

  // JS Date.getDay(): 0 = Sunday, 1 = Monday ... 6 = Saturday
  const jsDay = date.getDay();
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // Map to 0=Mon ... 6=Sun
  const todaySchedule = settings.weeklySchedule[dayIndex] || { isOpen: true, openTime: "08:00", closeTime: "22:00" };

  if (!todaySchedule.isOpen) {
    return { isOpen: false, text: "Closed Today" };
  }

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const [openH, openM] = (todaySchedule.openTime || "08:00").split(":").map(Number);
  const [closeH, closeM] = (todaySchedule.closeTime || "22:00").split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
    return { isOpen: true, text: "Open Now" };
  }

  return { isOpen: false, text: `Closed (Hours: ${todaySchedule.openTime} - ${todaySchedule.closeTime})` };
}

export function getOperationsSettings(cafeOrId?: Cafe | string | null): OperationsSettings {
  let cafeObj: Cafe | null = null;
  let cafeIdStr: string | undefined = undefined;

  if (typeof cafeOrId === "object" && cafeOrId !== null) {
    cafeObj = cafeOrId;
    cafeIdStr = cafeObj.id;
  } else if (typeof cafeOrId === "string") {
    cafeIdStr = cafeOrId;
  }

  let localSettings = DEFAULT_OPERATIONS_SETTINGS;
  try {
    const key = `orderrail_operations_settings_${cafeIdStr || "default"}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      localSettings = {
        ...DEFAULT_OPERATIONS_SETTINGS,
        ...parsed,
        weeklySchedule: {
          ...DEFAULT_WEEKLY_SCHEDULE,
          ...(parsed.weeklySchedule || {}),
        },
        enabledChannels: {
          ...DEFAULT_OPERATIONS_SETTINGS.enabledChannels,
          ...(parsed.enabledChannels || {}),
        },
      };
    }
  } catch {}

  if (!cafeObj) {
    return localSettings;
  }

  // Database values take precedence for customer-facing fields when present on Cafe object
  const dbStatus = (cafeObj as any).operating_status as RestaurantStatus | undefined;
  const dbWeeklySchedule = (cafeObj as any).weekly_schedule as Record<number, DaySchedule> | undefined;
  const dbDineInEnabled = (cafeObj as any).dine_in_enabled as boolean | undefined;

  return {
    ...localSettings,
    status: dbStatus || localSettings.status,
    weeklySchedule: dbWeeklySchedule ? { ...DEFAULT_WEEKLY_SCHEDULE, ...dbWeeklySchedule } : localSettings.weeklySchedule,
    enabledChannels: {
      ...localSettings.enabledChannels,
      dine_in: dbDineInEnabled !== undefined && dbDineInEnabled !== null ? Boolean(dbDineInEnabled) : localSettings.enabledChannels.dine_in,
    },
  };
}

export interface OpeningHoursSpecification {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string | string[];
  opens: string;
  closes: string;
}

/**
 * Formats a 24-hour time string ("08:00", "22:00") into 12-hour format ("08:00 AM", "10:00 PM").
 */
export function formatTime12h(timeStr: string): string {
  if (!timeStr || typeof timeStr !== "string") return "08:00 AM";
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const m = mStr || "00";
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const formattedH = String(h).padStart(2, "0");
  return `${formattedH}:${m} ${period}`;
}

/**
 * Formats weeklySchedule JSON into a human-readable summary string (e.g. "Mon-Fri: 07:00 AM - 06:00 PM, Sat-Sun: 08:00 AM - 08:00 PM").
 */
export function formatWeeklySchedule(weeklySchedule?: Record<number, DaySchedule> | null): string {
  const sched: Record<number, DaySchedule> = {
    ...DEFAULT_WEEKLY_SCHEDULE,
    ...(weeklySchedule || {}),
  };

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  interface Group {
    start: number;
    end: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  }

  const groups: Group[] = [];
  for (let d = 0; d < 7; d++) {
    const daySched = sched[d] || DEFAULT_WEEKLY_SCHEDULE[d];
    const isOpen = Boolean(daySched?.isOpen);
    const openTime = daySched?.openTime || "08:00";
    const closeTime = daySched?.closeTime || "22:00";

    if (groups.length === 0) {
      groups.push({ start: d, end: d, isOpen, openTime, closeTime });
    } else {
      const last = groups[groups.length - 1];
      const isSame =
        last.isOpen === isOpen &&
        (!isOpen || (last.openTime === openTime && last.closeTime === closeTime));

      if (isSame) {
        last.end = d;
      } else {
        groups.push({ start: d, end: d, isOpen, openTime, closeTime });
      }
    }
  }

  if (groups.length === 1) {
    if (!groups[0].isOpen) {
      return "Closed";
    }
    return `Open Daily: ${formatTime12h(groups[0].openTime)} - ${formatTime12h(groups[0].closeTime)}`;
  }

  return groups
    .map((g) => {
      const rangeStr = g.start === g.end ? DAY_NAMES[g.start] : `${DAY_NAMES[g.start]}-${DAY_NAMES[g.end]}`;
      if (!g.isOpen) {
        return `${rangeStr}: Closed`;
      }
      return `${rangeStr}: ${formatTime12h(g.openTime)} - ${formatTime12h(g.closeTime)}`;
    })
    .join(", ");
}

/**
 * Maps weeklySchedule directly into Schema.org OpeningHoursSpecification array for SEO.
 */
export function getOpeningHoursSpecification(
  weeklySchedule?: Record<number, DaySchedule> | null
): OpeningHoursSpecification[] {
  const sched: Record<number, DaySchedule> = {
    ...DEFAULT_WEEKLY_SCHEDULE,
    ...(weeklySchedule || {}),
  };

  const FULL_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const timeMap = new Map<string, string[]>();

  for (let d = 0; d < 7; d++) {
    const daySched = sched[d] || DEFAULT_WEEKLY_SCHEDULE[d];
    if (daySched && daySched.isOpen) {
      const openTime = daySched.openTime || "08:00";
      const closeTime = daySched.closeTime || "22:00";
      const key = `${openTime}|${closeTime}`;

      if (!timeMap.has(key)) {
        timeMap.set(key, []);
      }
      timeMap.get(key)!.push(FULL_DAY_NAMES[d]);
    }
  }

  const specs: OpeningHoursSpecification[] = [];
  for (const [key, days] of timeMap.entries()) {
    const [opens, closes] = key.split("|");
    specs.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days.length === 1 ? days[0] : days,
      opens,
      closes,
    });
  }

  return specs;
}

export async function saveOperationsSettings(settings: OperationsSettings, cafeId?: string): Promise<{ success: boolean; error?: any }> {
  // Always update localStorage cache as a local fallback
  const key = `orderrail_operations_settings_${cafeId || "default"}`;
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {}

  if (!cafeId) {
    return { success: true };
  }

  const formattedHours = formatWeeklySchedule(settings.weeklySchedule);

  try {
    const { error } = await supabase
      .from("cafes")
      .update({
        operating_status: settings.status,
        weekly_schedule: settings.weeklySchedule as any,
        operating_hours: formattedHours,
        dine_in_enabled: settings.enabledChannels.dine_in,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cafeId);

    if (error) {
      console.error("[saveOperationsSettings] Database update error:", error.message);
      return { success: false, error };
    }
  } catch (err: any) {
    console.error("[saveOperationsSettings] Notice:", err?.message || err);
    return { success: false, error: err };
  }

  return { success: true };
}

