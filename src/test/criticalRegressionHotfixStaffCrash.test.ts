import { describe, it, expect } from "vitest";
import {
  computeDailyOrderNumbers,
  formatOrderDisplayNumber,
  formatOrderLabelUnified,
  sortOrdersByLane
} from "@/lib/orders/orderUtils";

describe("Critical Regression Hotfix — Defensive Null Safety & Initialization Order", () => {
  it("Scenario 1: computeDailyOrderNumbers handles undefined, null, empty array, and missing fields safely", () => {
    expect(() => computeDailyOrderNumbers(undefined)).not.toThrow();
    expect(() => computeDailyOrderNumbers(null)).not.toThrow();
    expect(() => computeDailyOrderNumbers([])).not.toThrow();

    const malformedOrders: any[] = [
      null,
      undefined,
      {},
      { id: "o1" }, // missing created_at
      { id: "o2", created_at: "invalid-date" },
      { id: "o3", created_at: "2026-07-26T10:00:00.000Z", order_number: 105 }
    ];

    let map: Map<string, number> = new Map();
    expect(() => {
      map = computeDailyOrderNumbers(malformedOrders);
    }).not.toThrow();

    expect(map.get("o1")).toBe(1);
    expect(map.get("o2")).toBe(1);
    expect(map.get("o3")).toBe(1);
  });

  it("Scenario 2: formatOrderDisplayNumber & formatOrderLabelUnified handle null / undefined gracefully", () => {
    expect(formatOrderDisplayNumber(undefined)).toBe("#1");
    expect(formatOrderDisplayNumber(null)).toBe("#1");
    expect(formatOrderDisplayNumber(NaN)).toBe("#1");
    expect(formatOrderDisplayNumber(5)).toBe("#5");

    expect(formatOrderLabelUnified(null, null)).toBe("#1");
    expect(formatOrderLabelUnified(undefined, undefined)).toBe("#1");
    expect(formatOrderLabelUnified({ id: "o1" }, null)).toBe("#1");
  });

  it("Scenario 3: sortOrdersByLane handles empty, null, and missing created_at or id fields without throwing", () => {
    expect(() => sortOrdersByLane(null, "incoming")).not.toThrow();
    expect(() => sortOrdersByLane(undefined, "history")).not.toThrow();

    const messyOrders: any[] = [
      null,
      { id: "a" },
      { id: "b", created_at: "2026-07-26T10:00:00.000Z" },
      { created_at: "2026-07-26T12:00:00.000Z" } // missing id
    ];

    let sortedIncoming: any[] = [];
    expect(() => {
      sortedIncoming = sortOrdersByLane(messyOrders, "incoming");
    }).not.toThrow();
    expect(sortedIncoming.length).toBe(3);

    let sortedHistory: any[] = [];
    expect(() => {
      sortedHistory = sortOrdersByLane(messyOrders, "history");
    }).not.toThrow();
    expect(sortedHistory.length).toBe(3);
  });
});
