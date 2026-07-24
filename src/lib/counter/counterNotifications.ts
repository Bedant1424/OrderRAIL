/**
 * Counter Notification Data Types & Helper Utilities.
 */

export interface CounterNotification {
  id: string;
  type: 'new_order' | 'order_served' | 'order_updated';
  title: string;
  description: string;
  timestamp: string; // ISO 8601 string
  read: boolean;
  tableLabel?: string;
  orderNumber?: number;
}

const STORAGE_KEY = "orderrail.counter.notifications";

export function loadCounterNotifications(cafeId?: string): CounterNotification[] {
  if (typeof window === "undefined" || !cafeId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}.${cafeId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CounterNotification[];
    return sortNotificationsNewestFirst(parsed);
  } catch (e) {
    console.warn("[loadCounterNotifications] Error loading notifications:", e);
    return [];
  }
}

export function saveCounterNotifications(cafeId: string | undefined, notifications: CounterNotification[]): void {
  if (typeof window === "undefined" || !cafeId) return;
  try {
    // Keep max 50 recent notifications
    const trimmed = sortNotificationsNewestFirst(notifications).slice(0, 50);
    localStorage.setItem(`${STORAGE_KEY}.${cafeId}`, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("[saveCounterNotifications] Error saving notifications:", e);
  }
}

export function sortNotificationsNewestFirst(notifications: CounterNotification[]): CounterNotification[] {
  return [...notifications].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (isNaN(timeA) || isNaN(timeB)) return 0;
    return timeB - timeA; // Descending: Newest first
  });
}

export function formatRelativeTime(dateString: string, nowMs: number = Date.now()): string {
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
