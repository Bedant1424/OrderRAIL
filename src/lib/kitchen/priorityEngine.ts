import { KitchenStatus, KotPriority } from './types';

export class PriorityEngine {
  /**
   * Computes KOT Priority level based on elapsed preparation time in minutes.
   * - < 5 mins: NORMAL
   * - 5 - 10 mins: HIGH
   * - 10 - 15 mins: URGENT
   * - > 15 mins: CRITICAL
   */
  public static getPriority(createdAtMs: number, nowMs: number = Date.now()): KotPriority {
    const elapsedMins = (nowMs - createdAtMs) / (1000 * 60);

    if (elapsedMins >= 15) {
      return 'CRITICAL';
    }
    if (elapsedMins >= 10) {
      return 'URGENT';
    }
    if (elapsedMins >= 5) {
      return 'HIGH';
    }
    return 'NORMAL';
  }

  /**
   * Calculates elapsed preparation time in minutes.
   */
  public static getElapsedMins(createdAtMs: number, nowMs: number = Date.now()): number {
    return Math.max(0, Math.floor((nowMs - createdAtMs) / (1000 * 60)));
  }

  /**
   * Formats elapsed time as MM:SS or Xm.
   */
  public static formatElapsedTime(createdAtMs: number, nowMs: number = Date.now()): string {
    const totalSecs = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }

  /**
   * Validates kitchen status state machine transitions:
   * - NEW -> PREPARING
   * - PREPARING -> READY
   * - READY -> SERVED
   */
  public static isValidTransition(currentStatus: KitchenStatus, nextStatus: KitchenStatus): boolean {
    if (currentStatus === nextStatus) return true;

    const validTransitions: Record<KitchenStatus, KitchenStatus[]> = {
      NEW: ['PREPARING', 'READY', 'SERVED'],
      PREPARING: ['READY', 'SERVED', 'NEW'],
      READY: ['SERVED', 'PREPARING'],
      SERVED: [],
    };

    return validTransitions[currentStatus]?.includes(nextStatus) ?? false;
  }
}
