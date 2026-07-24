import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCounterNotifications,
  saveCounterNotifications,
  sortNotificationsNewestFirst,
  formatRelativeTime,
  type CounterNotification
} from "@/lib/counter/counterNotifications";

describe("Counter Notifications Utility", () => {
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
});
