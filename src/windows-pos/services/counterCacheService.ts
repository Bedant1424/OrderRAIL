import type { LoadedCounterState } from "./counterSyncService";
import type { CounterCartItem } from "./counterOrderBuilderService";
import type { OrderSource } from "../types/counterTypes";

export interface PersistedCounterDraft {
  cafeId: string;
  channel: OrderSource;
  tableId?: string | null;
  externalOrderRef?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  orderNote?: string | null;
  cartItems: CounterCartItem[];
  savedAt: string;
}

export interface PersistedMenuCache {
  cafeId: string;
  categories: any[];
  items: any[];
  cachedAt: string;
}

const STORAGE_KEYS = {
  STATE_PREFIX: "orderrail_counter_state_",
  MENU_PREFIX: "orderrail_counter_menu_",
  DRAFT_PREFIX: "orderrail_counter_cart_draft_",
};

// In-Memory fallback cache for SSR or test environments
const memoryCache = new Map<string, string>();

function getStorageItem(key: string): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryCache.get(key) || null;
    }
  }
  return memoryCache.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // Storage full or quota exceeded, fall back to memory
    }
  }
  memoryCache.set(key, value);
}

function removeStorageItem(key: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
  memoryCache.delete(key);
}

export class CounterCacheService {
  /**
   * Caches the active counter state (tables, non-table channel orders, and sync timestamp)
   */
  public static saveCounterStateCache(cafeId: string, state: LoadedCounterState): void {
    if (!cafeId) return;
    try {
      const serialized = JSON.stringify({
        tables: state.tables,
        channelOrders: state.channelOrders,
        lastSyncedAt: state.lastSyncedAt instanceof Date ? state.lastSyncedAt.toISOString() : state.lastSyncedAt,
      });
      setStorageItem(`${STORAGE_KEYS.STATE_PREFIX}${cafeId}`, serialized);
    } catch (err) {
      console.warn("[CounterCacheService] Failed to cache counter state:", err);
    }
  }

  /**
   * Loads the cached counter state when offline or during initial startup
   */
  public static loadCounterStateCache(cafeId: string): LoadedCounterState | null {
    if (!cafeId) return null;
    const raw = getStorageItem(`${STORAGE_KEYS.STATE_PREFIX}${cafeId}`);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return {
        tables: parsed.tables || [],
        channelOrders: parsed.channelOrders || [],
        lastSyncedAt: parsed.lastSyncedAt ? new Date(parsed.lastSyncedAt) : new Date(),
      };
    } catch (err) {
      console.warn("[CounterCacheService] Failed to parse cached counter state:", err);
      return null;
    }
  }

  /**
   * Caches menu items and categories locally
   */
  public static saveMenuCache(
    cafeId: string,
    menuOrCategories: any,
    maybeItems?: any[]
  ): void {
    if (!cafeId) return;
    try {
      let categories: any[] = [];
      let items: any[] = [];
      if (Array.isArray(menuOrCategories)) {
        categories = menuOrCategories;
        items = maybeItems || [];
      } else if (menuOrCategories && typeof menuOrCategories === "object") {
        categories = menuOrCategories.categories || [];
        items = menuOrCategories.items || [];
      }

      const data: PersistedMenuCache = {
        cafeId,
        categories,
        items,
        cachedAt: new Date().toISOString(),
      };
      setStorageItem(`${STORAGE_KEYS.MENU_PREFIX}${cafeId}`, JSON.stringify(data));
    } catch (err) {
      console.warn("[CounterCacheService] Failed to cache menu:", err);
    }
  }

  /**
   * Loads cached menu when offline
   */
  public static loadMenuCache(cafeId: string): PersistedMenuCache | null {
    if (!cafeId) return null;
    const raw = getStorageItem(`${STORAGE_KEYS.MENU_PREFIX}${cafeId}`);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn("[CounterCacheService] Failed to parse cached menu:", err);
      return null;
    }
  }

  /**
   * Persists in-progress draft cart so ticket builds survive disconnects or page reloads
   */
  public static saveCounterCartDraft(
    param1: string | PersistedCounterDraft,
    param2?: PersistedCounterDraft
  ): void {
    let cafeId: string;
    let draft: PersistedCounterDraft;

    if (typeof param1 === "string") {
      cafeId = param1;
      draft = param2 || ({} as any);
    } else {
      draft = param1;
      cafeId = draft?.cafeId || "";
    }

    if (!cafeId) return;
    try {
      const items = draft.cartItems || draft.items || [];
      if (items.length === 0) {
        this.clearCounterCartDraft(cafeId);
        return;
      }

      const payload: PersistedCounterDraft = {
        ...draft,
        cafeId,
        cartItems: items,
        items,
        savedAt: new Date().toISOString(),
      };
      setStorageItem(`${STORAGE_KEYS.DRAFT_PREFIX}${cafeId}`, JSON.stringify(payload));
    } catch (err) {
      console.warn("[CounterCacheService] Failed to save cart draft:", err);
    }
  }

  /**
   * Retrieves active draft cart
   */
  public static loadCounterCartDraft(cafeId: string): PersistedCounterDraft | null {
    if (!cafeId) return null;
    const raw = getStorageItem(`${STORAGE_KEYS.DRAFT_PREFIX}${cafeId}`);
    if (!raw) return null;

    try {
      const draft = JSON.parse(raw);
      const items = draft?.cartItems || draft?.items || [];
      if (items.length === 0) return null;
      return {
        ...draft,
        cartItems: items,
        items,
      };
    } catch (err) {
      console.warn("[CounterCacheService] Failed to parse cart draft:", err);
      return null;
    }
  }

  /**
   * Clears saved draft cart upon order completion or manual clear
   */
  public static clearCounterCartDraft(cafeId: string): void {
    if (!cafeId) return;
    removeStorageItem(`${STORAGE_KEYS.DRAFT_PREFIX}${cafeId}`);
  }

  /**
   * Utility for testing: clears all counter cache
   */
  public static clearAll(cafeId: string): void {
    removeStorageItem(`${STORAGE_KEYS.STATE_PREFIX}${cafeId}`);
    removeStorageItem(`${STORAGE_KEYS.MENU_PREFIX}${cafeId}`);
    removeStorageItem(`${STORAGE_KEYS.DRAFT_PREFIX}${cafeId}`);
  }
}
