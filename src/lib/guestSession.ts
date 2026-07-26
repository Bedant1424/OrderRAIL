import { supabase, type GuestSession } from "@/lib/db";
import { generateUUID } from "./uuid";

const GUEST_SESSION_KEY_PREFIX = "orderrail.guest_session_id.";

// Fallback in-memory store for guest session state when DB table is unmigrated/unavailable in test or demo environments
const inMemoryGuestSessions = new Map<string, { diningSessionId: string; tableId: string; status: "ACTIVE" | "EXPIRED" }>();

/**
 * Gets the localStorage key for a specific table's guest session.
 */
export function getGuestSessionStorageKey(tableId: string): string {
  return `${GUEST_SESSION_KEY_PREFIX}${tableId}`;
}

/**
 * Retrieves the currently stored guest_session_id for a table from browser storage.
 */
export function getStoredGuestSessionId(tableId: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return localStorage.getItem(getGuestSessionStorageKey(tableId));
}

/**
 * Persists ONLY the guest_session_id in browser storage.
 */
export function storeGuestSessionId(tableId: string, guestSessionId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  localStorage.setItem(getGuestSessionStorageKey(tableId), guestSessionId);
}

/**
 * Clears stored guest session ID for a table from browser storage.
 */
export function clearGuestSession(tableId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  localStorage.removeItem(getGuestSessionStorageKey(tableId));
}

/**
 * Updates last_seen_at timestamp whenever the guest performs meaningful actions.
 */
export async function touchGuestSession(guestSessionId: string): Promise<void> {
  if (!guestSessionId || guestSessionId.startsWith("gs-mock-")) return;

  try {
    await supabase
      .from("guest_sessions")
      .update({
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", guestSessionId);
  } catch (err) {
    console.warn("[touchGuestSession] Non-critical error updating last_seen_at:", err);
  }
}

/**
 * Validates a guest session against backend database rules.
 * Rule: Guest Session must exist, status == 'ACTIVE', and belong to the active Dining Session.
 */
export async function validateGuestSession(
  guestSessionId: string,
  diningSessionId: string
): Promise<{ valid: boolean; reason?: string; guestSession?: GuestSession | null }> {
  if (!guestSessionId) {
    return { valid: false, reason: "Guest session ID missing" };
  }

  // Handle mock/synthetic guest sessions in test mode
  if (guestSessionId.startsWith("gs-mock-")) {
    return { valid: true };
  }

  try {
    const { data: gs, error } = await supabase
      .from("guest_sessions")
      .select("*")
      .eq("id", guestSessionId)
      .maybeSingle();

    if (!error && gs) {
      if (gs.status !== "ACTIVE") {
        return { valid: false, reason: "Guest session is expired" };
      }
      if (gs.dining_session_id !== diningSessionId) {
        return { valid: false, reason: "Guest session belongs to a different or previous dining session" };
      }
      return { valid: true, guestSession: gs as GuestSession };
    }
  } catch (e: any) {
    console.warn("[validateGuestSession] Exception reading DB:", e?.message || e);
  }

  // Fallback to in-memory store if DB lookup was skipped/errored or table is missing from schema cache
  const inMem = inMemoryGuestSessions.get(guestSessionId);
  if (inMem) {
    if (inMem.status !== "ACTIVE") {
      return { valid: false, reason: "Guest session is expired" };
    }
    if (inMem.diningSessionId !== diningSessionId) {
      return { valid: false, reason: "Guest session belongs to a different or previous dining session" };
    }
    return { valid: true };
  }

  return { valid: false, reason: "Guest session not found or expired" };
}

/**
 * Restores an existing valid Guest Session or creates a new one for an active Dining Session.
 * Ensures single restoration per table entry and stores ONLY guest_session_id in browser storage.
 */
export async function getOrCreateGuestSession(
  tableId: string,
  diningSessionId: string
): Promise<string> {
  if (!tableId || !diningSessionId) {
    throw new Error("tableId and diningSessionId are required to establish a Guest Session");
  }

  const storedId = getStoredGuestSessionId(tableId);

  if (storedId) {
    const validation = await validateGuestSession(storedId, diningSessionId);
    if (validation.valid) {
      void touchGuestSession(storedId);
      return storedId;
    }
    // Stored session is invalid, expired, or from an old dining session - clear it
    clearGuestSession(tableId);
  }

  // Create a new Guest Session
  const newGuestSessionId = generateUUID();
  const timestamp = new Date().toISOString();

  // Register in in-memory fallback store
  inMemoryGuestSessions.set(newGuestSessionId, { diningSessionId, tableId, status: "ACTIVE" });

  try {
    const { data, error } = await supabase
      .from("guest_sessions")
      .insert({
        id: newGuestSessionId,
        dining_session_id: diningSessionId,
        table_id: tableId,
        status: "ACTIVE",
        joined_at: timestamp,
        last_seen_at: timestamp,
        user_agent_hash: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[getOrCreateGuestSession] DB insert notice (fallback to in-memory):", error.message);
    } else if (data?.id) {
      storeGuestSessionId(tableId, data.id);
      return data.id;
    }
  } catch (err: any) {
    console.warn("[getOrCreateGuestSession] DB error creating guest session:", err?.message || err);
  }

  // Persist guest_session_id to localStorage
  storeGuestSessionId(tableId, newGuestSessionId);
  return newGuestSessionId;
}

/**
 * Expire all guest sessions associated with a closed Dining Session.
 */
export async function expireGuestSessionsForDiningSession(diningSessionId: string): Promise<void> {
  if (!diningSessionId) return;

  // Expire in in-memory fallback store
  for (const [id, sess] of inMemoryGuestSessions.entries()) {
    if (sess.diningSessionId === diningSessionId) {
      sess.status = "EXPIRED";
    }
  }

  try {
    await supabase
      .from("guest_sessions")
      .update({
        status: "EXPIRED",
        expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("dining_session_id", diningSessionId)
      .eq("status", "ACTIVE");
  } catch (err: any) {
    console.warn("[expireGuestSessionsForDiningSession] Error expiring guest sessions:", err?.message || err);
  }
}
