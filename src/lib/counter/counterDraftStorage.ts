/**
 * Counter POS Draft KOT Client-Side Persistence Storage Engine
 * 
 * Scopes unsubmitted draft carts strictly by cafeId, tableId, and diningSessionId.
 * Persists in localStorage to survive accidental page reloads and tab navigation,
 * while preventing cross-table or cross-session leakage.
 */

export interface PersistedDraftCartItem {
  id: string;
  menuItemId?: string;
  name: string;
  price: number;
  basePrice?: number;
  qty: number;
  selectedAddonIds?: string[];
  notes?: string;
}

export interface PersistedTableDraft {
  tableId: string;
  sessionId?: string;
  draftCart: PersistedDraftCartItem[];
  updatedAt: number;
}

const STORAGE_KEY_PREFIX = "orderrail_counter_drafts_";

export function getCounterDraftsStorageKey(cafeId: string): string {
  return `${STORAGE_KEY_PREFIX}${cafeId || "default"}`;
}

export function loadCounterDrafts(cafeId: string): Record<string, PersistedTableDraft> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(getCounterDraftsStorageKey(cafeId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed;
  } catch (e) {
    console.warn("[counterDraftStorage] Error reading drafts from localStorage:", e);
    return {};
  }
}

export function saveCounterDraft(
  cafeId: string,
  tableId: string,
  sessionId: string | undefined,
  draftCart: PersistedDraftCartItem[]
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const drafts = loadCounterDrafts(cafeId);
    if (!draftCart || draftCart.length === 0) {
      delete drafts[tableId];
    } else {
      drafts[tableId] = {
        tableId,
        sessionId,
        draftCart,
        updatedAt: Date.now(),
      };
    }
    window.localStorage.setItem(getCounterDraftsStorageKey(cafeId), JSON.stringify(drafts));
  } catch (e) {
    console.warn("[counterDraftStorage] Error saving draft to localStorage:", e);
  }
}

export function clearCounterDraft(cafeId: string, tableId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const drafts = loadCounterDrafts(cafeId);
    if (drafts[tableId]) {
      delete drafts[tableId];
      window.localStorage.setItem(getCounterDraftsStorageKey(cafeId), JSON.stringify(drafts));
    }
  } catch (e) {
    console.warn("[counterDraftStorage] Error clearing draft from localStorage:", e);
  }
}

export function clearAllCounterDrafts(cafeId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(getCounterDraftsStorageKey(cafeId));
  } catch (e) {
    console.warn("[counterDraftStorage] Error clearing all drafts from localStorage:", e);
  }
}
