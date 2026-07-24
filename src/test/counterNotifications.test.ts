import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCounterNotifications,
  saveCounterNotifications,
  sortNotificationsNewestFirst,
  formatRelativeTime,
  loadNotificationSettings,
  saveNotificationSettings,
  isEventNotificationEnabled,
  DEFAULT_NOTIFICATION_SETTINGS,
  type CounterNotification,
  type CounterNotificationSettings
} from "@/lib/counter/counterNotifications";

describe("Counter Notifications & Settings Utility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sorts notifications in chronological order (newest first)", () => {
    const list: CounterNotification[] = [
      { id: "1", type: "new_order", title: "Old", description: "d1", timestamp: "2026-07-24T10:00:00.000Z", read: false },
      { id: "3", type: "new_order", title: "Newest", description: "d3", timestamp: "2026-07-24T12:00:00.000Z", read: false },
      { id: "2", type: "new_order", title: "Middle", description: "d2", timestamp: "2026-07-24T11:00:00.000Z", read: false },
    ];

    const sorted = sortNotificationsNewestFirst(list);
    expect(sorted.map((n) => n.id)).toEqual(["3", "2", "1"]);
  });

  it("persists and loads notifications from localStorage by cafeId", () => {
    const cafeId = "cafe-123";
    const list: CounterNotification[] = [
      { id: "notif-1", type: "new_order", title: "New Order", description: "Table 5 placed Order #101", timestamp: "2026-07-24T12:00:00.000Z", read: false }
    ];

    saveCounterNotifications(cafeId, list);
    const loaded = loadCounterNotifications(cafeId);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("notif-1");
    expect(loaded[0].title).toBe("New Order");
  });

  it("formats relative timestamps correctly", () => {
    const now = new Date("2026-07-24T12:30:00.000Z").getTime();
    
    expect(formatRelativeTime("2026-07-24T12:29:55.000Z", now)).toBe("Just now");
    expect(formatRelativeTime("2026-07-24T12:29:00.000Z", now)).toBe("1m ago");
    expect(formatRelativeTime("2026-07-24T12:15:00.000Z", now)).toBe("15m ago");
    expect(formatRelativeTime("2026-07-24T10:30:00.000Z", now)).toBe("2h ago");
  });

  it("loads default notification settings when none stored", () => {
    const settings = loadNotificationSettings("cafe-456");
    expect(settings).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it("persists and loads custom notification settings by cafeId", () => {
    const cafeId = "cafe-789";
    const customSettings: CounterNotificationSettings = {
      general: {
        enableNotifications: true,
        enableSound: false,
        enableBrowserNotifications: true,
      },
      eventTypes: {
        newOrder: true,
        orderServed: false,
        needWater: true,
        needBill: true,
        callWaiter: false,
        needHelp: true,
      },
    };

    saveNotificationSettings(cafeId, customSettings);
    const loaded = loadNotificationSettings(cafeId);

    expect(loaded.general.enableSound).toBe(false);
    expect(loaded.general.enableBrowserNotifications).toBe(true);
    expect(loaded.eventTypes.orderServed).toBe(false);
    expect(loaded.eventTypes.callWaiter).toBe(false);
  });

  it("respects master toggle and event type toggles when checking enabled events", () => {
    const settings: CounterNotificationSettings = {
      general: { enableNotifications: true, enableSound: true, enableBrowserNotifications: false },
      eventTypes: { newOrder: true, orderServed: false, needWater: true, needBill: true, callWaiter: true, needHelp: true }
    };

    expect(isEventNotificationEnabled("new_order", settings)).toBe(true);
    expect(isEventNotificationEnabled("order_served", settings)).toBe(false);

    // When master enableNotifications is false
    const disabledMaster: CounterNotificationSettings = {
      ...settings,
      general: { ...settings.general, enableNotifications: false }
    };
    expect(isEventNotificationEnabled("new_order", disabledMaster)).toBe(false);
  });
});
