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
  6: { isOpen: true, openTime: "09:00", closeTime: "22:00" }, // Sunday
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

export function getOperationsSettings(cafeId?: string): OperationsSettings {
  try {
    const key = `orderrail_operations_settings_${cafeId || "default"}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
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
  return DEFAULT_OPERATIONS_SETTINGS;
}

export function saveOperationsSettings(settings: OperationsSettings, cafeId?: string): void {
  const key = `orderrail_operations_settings_${cafeId || "default"}`;
  localStorage.setItem(key, JSON.stringify(settings));
}
