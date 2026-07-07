import { useEffect, useState } from "react";
import { getSessionId } from "@/lib/session";
import type { ServiceRequestType } from "@/lib/db";

/**
 * Per-request-type cooldown + pending-expiry tracking for Call Staff / Request Bill
 * style buttons. State is persisted in localStorage (keyed by session + type) so it
 * survives reloads, and each type is tracked independently — sending one request
 * never disables another type's button.
 */
export function useServiceRequestCooldown(cooldownMs: number, timeoutMs: number) {
  // Ticks once a second purely to force a re-render so countdown labels stay live.
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

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
    return Date.now() - sentAt < timeoutMs;
  };

  const canSend = (type: ServiceRequestType): boolean => remainingCooldownMs(type) <= 0;

  const markSent = (type: ServiceRequestType) => {
    localStorage.setItem(storageKey(type), String(Date.now()));
  };

  return { remainingCooldownMs, isPending, canSend, markSent };
}
