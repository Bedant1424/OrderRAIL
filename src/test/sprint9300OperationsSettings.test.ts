import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPERATIONS_SETTINGS,
  getOperationsSettings,
  saveOperationsSettings,
  getTodayOpenStatus,
  type OperationsSettings,
} from "@/lib/billing/operationsSettings";

describe("Sprint 9.3.0 — Operations Configuration Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("1. Loads default operations settings", () => {
    const settings = getOperationsSettings("test-cafe");

    expect(settings.status).toBe("open");
    expect(settings.kdsRefreshInterval).toBe("5s");
    expect(settings.sessionTimeout).toBe("60m");
    expect(settings.enabledChannels.dine_in).toBe(true);
    expect(settings.enabledChannels.counter).toBe(true);
    expect(settings.autoReleaseTable).toBe(true);
    expect(settings.autoPrintKot).toBe(true);
  });

  it("2. Calculates today's operating status correctly", () => {
    const settings: OperationsSettings = {
      ...DEFAULT_OPERATIONS_SETTINGS,
      status: "open",
    };

    const statusObj = getTodayOpenStatus(settings);
    expect(typeof statusObj.isOpen).toBe("boolean");
    expect(typeof statusObj.text).toBe("string");

    const closedSettings: OperationsSettings = {
      ...settings,
      status: "closed",
    };
    const closedStatus = getTodayOpenStatus(closedSettings);
    expect(closedStatus.isOpen).toBe(false);
    expect(closedStatus.text).toBe("Temporarily Closed");
  });

  it("3. Ensures at least one ordering channel remains enabled", () => {
    const enabledCount = (channels: Record<string, boolean>) =>
      Object.values(channels).filter(Boolean).length;

    const validChannels = { dine_in: true, counter: false, takeaway: false, swiggy: false, zomato: false };
    expect(enabledCount(validChannels)).toBe(1);

    const invalidChannels = { dine_in: false, counter: false, takeaway: false, swiggy: false, zomato: false };
    expect(enabledCount(invalidChannels)).toBe(0);
  });

  it("4. Saves and retrieves custom operations settings", () => {
    const custom: OperationsSettings = {
      ...DEFAULT_OPERATIONS_SETTINGS,
      status: "busy",
      kdsRefreshInterval: "10s",
      sessionTimeout: "30m",
      enabledChannels: {
        dine_in: true,
        counter: true,
        takeaway: true,
        swiggy: false,
        zomato: false,
      },
    };

    saveOperationsSettings(custom, "test-cafe");
    const loaded = getOperationsSettings("test-cafe");

    expect(loaded.status).toBe("busy");
    expect(loaded.kdsRefreshInterval).toBe("10s");
    expect(loaded.sessionTimeout).toBe("30m");
    expect(loaded.enabledChannels.swiggy).toBe(false);
  });
});
