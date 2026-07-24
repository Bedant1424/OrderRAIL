import { describe, it, expect } from "vitest";
import { formatSessionElapsed } from "@/lib/tables/liveSessionTimer";

describe("Live Dining Session Timer Utility", () => {
  it("returns null for empty or invalid timestamps", () => {
    expect(formatSessionElapsed(null)).toBeNull();
    expect(formatSessionElapsed(undefined)).toBeNull();
    expect(formatSessionElapsed("invalid-date")).toBeNull();
  });

  it("formats under 60 minutes as Xm", () => {
    const now = 1700000000000;
    const start34m = now - 34 * 60 * 1000;
    expect(formatSessionElapsed(start34m, now)).toBe("34m");

    const start0m = now;
    expect(formatSessionElapsed(start0m, now)).toBe("0m");

    const start59m = now - 59 * 60 * 1000;
    expect(formatSessionElapsed(start59m, now)).toBe("59m");
  });

  it("formats 60+ minutes as Xh Ym", () => {
    const now = 1700000000000;
    const start75m = now - 75 * 60 * 1000;
    expect(formatSessionElapsed(start75m, now)).toBe("1h 15m");

    const start120m = now - 120 * 60 * 1000;
    expect(formatSessionElapsed(start120m, now)).toBe("2h 0m");
  });

  it("parses ISO 8601 string timestamps correctly", () => {
    const now = new Date("2026-07-24T20:30:00.000Z").getTime();
    const isoStart = "2026-07-24T20:15:00.000Z";
    expect(formatSessionElapsed(isoStart, now)).toBe("15m");
  });
});
