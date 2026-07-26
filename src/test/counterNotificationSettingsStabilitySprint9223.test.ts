import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCounterNotifications,
  saveCounterNotifications,
  loadNotificationSettings,
  saveNotificationSettings,
  isEventNotificationEnabled,
  sortNotificationsNewestFirst,
  DEFAULT_NOTIFICATION_SETTINGS,
  type CounterNotification,
  type CounterNotificationSettings,
} from "@/lib/counter/counterNotifications";

describe("Sprint 9.2.2.3 — Counter Notification & Settings Runtime Stability", () => {
  const cafeId = "test-cafe-stability-9223";

  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  it("Scenario 1: Opening Notifications with undefined cafeId returns empty array without throwing", () => {
    const notifs = loadCounterNotifications(undefined);
    expect(Array.isArray(notifs)).toBe(true);
    expect(notifs.length).toBe(0);
  });

  it("Scenario 2: Opening Settings with undefined cafeId returns DEFAULT_NOTIFICATION_SETTINGS without throwing", () => {
    const settings = loadNotificationSettings(undefined);
    expect(settings).toBeDefined();
    expect(settings.general.enableNotifications).toBe(true);
    expect(settings.eventTypes.newOrder).toBe(true);
  });

  it("Scenario 3: Corrupt JSON in localStorage loads default settings without crashing", () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`orderrail.counter.notification_settings.${cafeId}`, "INVALID_JSON_CORRUPT{");
    }

    const settings = loadNotificationSettings(cafeId);
    expect(settings).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    expect(settings.general.enableSound).toBe(true);
  });

  it("Scenario 4: Null or non-array notification list sorts safely to [] without exception", () => {
    const sortedNull = sortNotificationsNewestFirst(undefined as any);
    expect(Array.isArray(sortedNull)).toBe(true);
    expect(sortedNull.length).toBe(0);

    const sortedNonArray = sortNotificationsNewestFirst("not-an-array" as any);
    expect(Array.isArray(sortedNonArray)).toBe(true);
    expect(sortedNonArray.length).toBe(0);
  });

  it("Scenario 5: Realtime notification arrives -> sorts newest first and evaluates event type safety", () => {
    const notif1: CounterNotification = {
      id: "n-1",
      type: "new_order",
      title: "New Order #101",
      description: "Table 4 ordered 2 items",
      timestamp: new Date(Date.now() - 60000).toISOString(),
      read: false,
    };

    const notif2: CounterNotification = {
      id: "n-2",
      type: "need_water",
      title: "Water Requested",
      description: "Table 2 needs water",
      timestamp: new Date().toISOString(),
      read: false,
    };

    const sorted = sortNotificationsNewestFirst([notif1, notif2]);
    expect(sorted[0].id).toBe("n-2"); // Newest first

    // Evaluate event notification enabled safely
    const isEnabled = isEventNotificationEnabled("need_water", DEFAULT_NOTIFICATION_SETTINGS);
    expect(isEnabled).toBe(true);

    // Evaluate disabled settings
    const disabledSettings: CounterNotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      general: { ...DEFAULT_NOTIFICATION_SETTINGS.general, enableNotifications: false },
    };
    expect(isEventNotificationEnabled("need_water", disabledSettings)).toBe(false);
  });

  it("Scenario 6: Partial settings object merges seamlessly with defaults without missing keys", () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        `orderrail.counter.notification_settings.${cafeId}`,
        JSON.stringify({ general: { enableSound: false } })
      );
    }

    const settings = loadNotificationSettings(cafeId);
    expect(settings.general.enableSound).toBe(false);
    expect(settings.general.enableNotifications).toBe(true); // Default preserved
    expect(settings.eventTypes.newOrder).toBe(true); // Default preserved
  });
});
