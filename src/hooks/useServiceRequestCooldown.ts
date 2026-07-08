import { useEffect, useState } from "react";
import { getSessionId } from "@/lib/session";
import type { ServiceRequestType } from "@/lib/db";

const ALL_TYPES: ServiceRequestType[] = ["water", "waiter", "bill", "help"];

/**
 * Per-request-type cooldown + pending-expiry tracking for Call Staff / Request Bill
 * style buttons. State is persisted in localStorage (keyed by session + type) so it
 * survives reloads, and each type is tracked independently — sending one request
 * never disables another type's button.
 *
 * The 1-second ticker also clears expired localStorage entries so that once the
 * timeout window passes the icon/label correctly reverts to its original state.
 */
export function useServiceRequestCooldown(cooldownMs: number, timeoutMs: number) {
  // Ticks once a second to force a re-render and to purge expired entries.
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // Purge any entries whose cooldown has fully elapsed so isPending() returns
      // false and the button icon/label resets to its original idle state.
      const sessionId = getSessionId();
      for (const type of ALL_TYPES) {
        const key = `orderrail.service-request.${sessionId}.${type}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const sentAt = Number(raw);
          if (Date.now() - sentAt >= cooldownMs) {
            localStorage.removeItem(key);
          }
        }
      }
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownMs]);

  const storageKey = (type: ServiceRequestType) => `orderrail.service-request.${getSessionId()}.${type}`;

  const getSentAt = (type: ServiceRequestType): number | null => {
    const raw = localStorage.getItem(storageKey(type));
    return raw ? Number(raw) : null;
  };

  const remainingCooldownMs = (type: ServiceRequestType): number => {
    const sentAt = getSentAt(type);
    if (!sentAt) return 0;
    return Math.max(0, cooldownMs - (Date.now() - sentAt));
  };

  const isPending = (type: ServiceRequestType): boolean => {
    const sentAt = getSentAt(type);
    if (!sentAt) return false;
    return Date.now() - sentAt < cooldownMs;
  };

  const canSend = (type: ServiceRequestType): boolean => remainingCooldownMs(type) <= 0;

  const markSent = (type: ServiceRequestType) => {
    localStorage.setItem(storageKey(type), String(Date.now()));
  };

  return { remainingCooldownMs, isPending, canSend, markSent };
}
