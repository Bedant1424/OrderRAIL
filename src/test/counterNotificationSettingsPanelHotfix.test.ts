import { describe, it, expect, beforeEach } from "vitest";
import {
  loadNotificationSettings,
  saveNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  type CounterNotificationSettings,
} from "@/lib/counter/counterNotifications";

describe("Hotfix — Counter Notification Settings Panel", () => {
  const cafeId = "test-cafe-panel-hotfix";

  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  it("Scenario 1: Opening drawer settings when no preferences exist returns default settings", () => {
    const settings = loadNotificationSettings(cafeId);
    expect(settings).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    expect(settings.general.enableNotifications).toBe(true);
    expect(settings.general.enableSound).toBe(true);
    expect(settings.general.enableBrowserNotifications).toBe(false);
  });

  it("Scenario 2: Toggling settings saves modifications to localStorage", () => {
    const updatedSettings: CounterNotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      general: {
        ...DEFAULT_NOTIFICATION_SETTINGS.general,
        enableSound: false,
      },
      eventTypes: {
        ...DEFAULT_NOTIFICATION_SETTINGS.eventTypes,
        needWater: false,
      },
    };

    saveNotificationSettings(cafeId, updatedSettings);

    const raw = localStorage.getItem(`orderrail.counter.notification_settings.${cafeId}`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.general.enableSound).toBe(false);
    expect(parsed.eventTypes.needWater).toBe(false);
  });

  it("Scenario 3: Reloading/refreshing page loads persisted preferences correctly", () => {
    const saved: CounterNotificationSettings = {
      general: { enableNotifications: true, enableSound: false, enableBrowserNotifications: true },
      eventTypes: { newOrder: true, orderServed: false, needWater: true, needBill: false, callWaiter: true, needHelp: false },
    };

    saveNotificationSettings(cafeId, saved);

    // Simulate page reload
    const reloaded = loadNotificationSettings(cafeId);
    expect(reloaded.general.enableSound).toBe(false);
    expect(reloaded.general.enableBrowserNotifications).toBe(true);
    expect(reloaded.eventTypes.orderServed).toBe(false);
    expect(reloaded.eventTypes.needBill).toBe(false);
  });

  it("Scenario 4: Corrupt JSON or legacy flat format in localStorage falls back to safe booleans", () => {
    if (typeof localStorage !== "undefined") {
      // Legacy flat format
      localStorage.setItem(
        `orderrail.counter.notification_settings.${cafeId}`,
        JSON.stringify({ sound: false, orderNotifications: false })
      );
    }

    const migrated = loadNotificationSettings(cafeId);
    expect(migrated.general.enableSound).toBe(false); // Migrated flat 'sound'
    expect(migrated.eventTypes.newOrder).toBe(false); // Migrated flat 'orderNotifications'
    expect(migrated.general.enableNotifications).toBe(true); // Default fallback
  });

  it("Scenario 5: Object with null properties resolves booleans safely without crashing", () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        `orderrail.counter.notification_settings.${cafeId}`,
        JSON.stringify({ general: null, eventTypes: { newOrder: null } })
      );
    }

    const sanitized = loadNotificationSettings(cafeId);
    expect(sanitized.general.enableNotifications).toBe(true);
    expect(sanitized.general.enableSound).toBe(true);
    expect(sanitized.eventTypes.newOrder).toBe(true);
  });
});
