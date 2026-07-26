/**
 * Counter Notification Data Types, Helper Utilities & Settings Manager.
 * Defensively hardened to guarantee zero runtime exceptions.
 */

export interface CounterNotification {
  id: string;
  type: 'new_order' | 'order_served' | 'order_updated' | 'need_water' | 'need_bill' | 'call_waiter' | 'need_help';
  title: string;
  description: string;
  timestamp: string; // ISO 8601 string
  read: boolean;
  tableLabel?: string;
  orderNumber?: number;
}

export interface CounterNotificationSettings {
  general: {
    enableNotifications: boolean;
    enableSound: boolean;
    enableBrowserNotifications: boolean;
  };
  eventTypes: {
    newOrder: boolean;
    orderServed: boolean;
    needWater: boolean;
    needBill: boolean;
    callWaiter: boolean;
    needHelp: boolean;
  };
}

export const DEFAULT_NOTIFICATION_SETTINGS: CounterNotificationSettings = {
  general: {
    enableNotifications: true,
    enableSound: true,
    enableBrowserNotifications: false,
  },
  eventTypes: {
    newOrder: true,
    orderServed: true,
    needWater: true,
    needBill: true,
    callWaiter: true,
    needHelp: true,
  },
};

const STORAGE_KEY = "orderrail.counter.notifications";
const SETTINGS_STORAGE_KEY = "orderrail.counter.notification_settings";

export function loadCounterNotifications(cafeId?: string): CounterNotification[] {
  if (typeof window === "undefined" || !cafeId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}.${cafeId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortNotificationsNewestFirst(parsed);
  } catch (e) {
    console.warn("[loadCounterNotifications] Error loading notifications:", e);
    return [];
  }
}

export function saveCounterNotifications(cafeId: string | undefined, notifications?: CounterNotification[]): void {
  if (typeof window === "undefined" || !cafeId) return;
  try {
    const safeNotifs = Array.isArray(notifications) ? notifications : [];
    const trimmed = sortNotificationsNewestFirst(safeNotifs).slice(0, 50);
    localStorage.setItem(`${STORAGE_KEY}.${cafeId}`, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("[saveCounterNotifications] Error saving notifications:", e);
  }
}

export function loadNotificationSettings(cafeId?: string): CounterNotificationSettings {
  if (typeof window === "undefined" || !cafeId) return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const raw = localStorage.getItem(`${SETTINGS_STORAGE_KEY}.${cafeId}`);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      general: { ...DEFAULT_NOTIFICATION_SETTINGS.general, ...(parsed?.general ?? {}) },
      eventTypes: { ...DEFAULT_NOTIFICATION_SETTINGS.eventTypes, ...(parsed?.eventTypes ?? {}) },
    };
  } catch (e) {
    console.warn("[loadNotificationSettings] Error:", e);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(cafeId: string | undefined, settings?: CounterNotificationSettings): void {
  if (typeof window === "undefined" || !cafeId) return;
  try {
    const safeSettings = settings ?? DEFAULT_NOTIFICATION_SETTINGS;
    localStorage.setItem(`${SETTINGS_STORAGE_KEY}.${cafeId}`, JSON.stringify(safeSettings));
  } catch (e) {
    console.warn("[saveNotificationSettings] Error:", e);
  }
}

export function isEventNotificationEnabled(
  type: CounterNotification['type'],
  settings?: CounterNotificationSettings
): boolean {
  if (!settings || !settings.general || !settings.general.enableNotifications) return false;
  const eventTypes = settings.eventTypes ?? DEFAULT_NOTIFICATION_SETTINGS.eventTypes;

  switch (type) {
    case 'new_order':
      return eventTypes.newOrder ?? true;
    case 'order_served':
      return eventTypes.orderServed ?? true;
    case 'need_water':
      return eventTypes.needWater ?? true;
    case 'need_bill':
      return eventTypes.needBill ?? true;
    case 'call_waiter':
      return eventTypes.callWaiter ?? true;
    case 'need_help':
      return eventTypes.needHelp ?? true;
    default:
      return true;
  }
}

export function sortNotificationsNewestFirst(notifications?: CounterNotification[]): CounterNotification[] {
  if (!Array.isArray(notifications)) return [];
  return [...notifications].sort((a, b) => {
    const timeA = new Date(a?.timestamp || 0).getTime();
    const timeB = new Date(b?.timestamp || 0).getTime();
    if (isNaN(timeA) || isNaN(timeB)) return 0;
    return timeB - timeA;
  });
}

export function formatRelativeTime(dateString: string, nowMs: number = Date.now()): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const startMs = date.getTime();
  if (isNaN(startMs)) return "Just now";

  const diffMs = Math.max(0, nowMs - startMs);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function playNotificationSound(): void {
  try {
    if (typeof window === "undefined") return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Audio Context fallback
  }
}

export async function triggerBrowserNotification(title: string, body: string): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  try {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification(title, { body });
      }
    }
  } catch (e) {
    console.warn("[triggerBrowserNotification] Error:", e);
  }
}
