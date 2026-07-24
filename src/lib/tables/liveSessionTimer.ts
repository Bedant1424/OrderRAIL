/**
 * Shared Live Dining Session Timer Utility.
 * Computes live elapsed time using the active dining session start timestamp as the single source of truth.
 * Format:
 *  - Under 60 mins: "Xm" (e.g. "0m", "15m", "45m")
 *  - 60+ mins: "Xh Ym" (e.g. "1h 12m", "2h 5m")
 * Returns null if no valid session or timestamp is provided.
 */

export function formatSessionElapsed(
  startedAtTimestamp: string | number | Date | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (!startedAtTimestamp) return null;

  const startMs = typeof startedAtTimestamp === "number"
    ? startedAtTimestamp
    : new Date(startedAtTimestamp).getTime();

  if (isNaN(startMs) || startMs <= 0) return null;

  const diffMs = Math.max(0, nowMs - startMs);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}
