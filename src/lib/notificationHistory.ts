import { NotificationItem } from "@/components/staff/NotificationCenter";

const STORAGE_KEY = "orderrail.staff.notifications";
const STORAGE_DATE_KEY = "orderrail.staff.notifications_date";

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loadNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  const today = getTodayString();
  const savedDate = localStorage.getItem(STORAGE_DATE_KEY);
  if (savedDate !== today) {
    // New day! Clear history
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_DATE_KEY, today);
    return [];
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveNotifications(items: NotificationItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(STORAGE_DATE_KEY, getTodayString());
}

export function addNotification(
  type: NotificationItem["type"],
  title: string,
  description: string,
  relatedId: string,
  relatedType: NotificationItem["relatedType"]
): NotificationItem[] {
  const items = loadNotifications();
  
  // To avoid duplicates (e.g. from multiple subscription channels or double events),
  // check if a notification with the same type and relatedId was created in the last 2 seconds
  const isDuplicate = items.some(
    (item) =>
      item.type === type &&
      item.relatedId === relatedId &&
      Math.abs(Date.now() - new Date(item.timestamp).getTime()) < 2000
  );
  if (isDuplicate) return items;

  const newItem: NotificationItem = {
    id: `${type}-${relatedId}-${Date.now()}`,
    type,
    title,
    description,
    timestamp: new Date().toISOString(),
    relatedId,
    relatedType,
    read: false,
  };

  const updated = [newItem, ...items];
  saveNotifications(updated);
  return updated;
}

export function dismissNotification(id: string): NotificationItem[] {
  const items = loadNotifications();
  const updated = items.filter((item) => item.id !== id);
  saveNotifications(updated);
  return updated;
}

export function clearAllNotifications(): NotificationItem[] {
  saveNotifications([]);
  return [];
}

export function markAllAsRead(): NotificationItem[] {
  const items = loadNotifications();
  const updated = items.map((item) => ({ ...item, read: true }));
  saveNotifications(updated);
  return updated;
}

export function getUnreadCount(items: NotificationItem[]): number {
  return items.filter((item) => !item.read).length;
}
