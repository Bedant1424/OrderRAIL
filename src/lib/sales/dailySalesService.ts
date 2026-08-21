/**
 * Daily Sales Service
 * 
 * High-level domain service for consuming authoritative Daily Sales Reports and Transaction drilldowns.
 * Implements in-memory caching, in-flight promise de-duplication, debounced realtime invalidation,
 * business-date rollover freshness validation, and multi-terminal synchronization without client-side total manipulation.
 */

import { supabase } from "@/lib/db";
import { DailySalesRepository } from "./dailySalesRepository";
import type {
  DailySalesReport,
  DailySalesTransactionsResponse,
  DailySalesServiceOptions,
} from "./types";

type DailySalesListener = (report: DailySalesReport) => void;

interface CacheEntry {
  report: DailySalesReport;
  fetchedAt: number;
}

interface TxCacheEntry {
  response: DailySalesTransactionsResponse;
  fetchedAt: number;
}

export class DailySalesServiceClass {
  private cache = new Map<string, CacheEntry>();
  private txCache = new Map<string, TxCacheEntry>();
  private inFlightRequests = new Map<string, Promise<DailySalesReport>>();
  private inFlightTxRequests = new Map<string, Promise<DailySalesTransactionsResponse>>();
  private activeSubscriptions = new Map<string, { channel: any; refCount: number; listeners: Set<DailySalesListener> }>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  private getCacheKey(cafeId: string, businessDate?: string | null): string {
    return `${cafeId}:${businessDate || "CURRENT"}`;
  }

  /**
   * Check if a cached "CURRENT" report has crossed a local date boundary or exceeded freshness TTL.
   * This serves ONLY as a signal to fetch a fresh authoritative report from PostgreSQL.
   */
  private isCurrentCacheStale(entry: { fetchedAt: number }): boolean {
    const fetchedDate = new Date(entry.fetchedAt);
    const now = new Date();
    
    // 1. Rollover boundary check: local calendar date has progressed
    if (
      fetchedDate.getFullYear() !== now.getFullYear() ||
      fetchedDate.getMonth() !== now.getMonth() ||
      fetchedDate.getDate() !== now.getDate()
    ) {
      return true;
    }

    // 2. Maximum freshness TTL check (5 minutes) for background date drift protection
    if (now.getTime() - entry.fetchedAt > 5 * 60 * 1000) {
      return true;
    }

    return false;
  }

  /**
   * Fetch authoritative Daily Sales Report for a cafe.
   * 
   * @param cafeId Cafe UUID
   * @param businessDate Optional target date YYYY-MM-DD. When omitted, PostgreSQL determines current business date.
   * @param options Options including forceRefresh
   */
  public async getDailySalesReport(
    cafeId: string,
    businessDate?: string | null,
    options?: DailySalesServiceOptions
  ): Promise<DailySalesReport> {
    if (!cafeId) {
      throw new Error("[DailySalesService] cafeId is required.");
    }

    const key = this.getCacheKey(cafeId, businessDate);
    const isCurrent = !businessDate;

    // 1. Return cached copy if available, forceRefresh is false, and CURRENT entry is not stale
    if (!options?.forceRefresh && this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      if (isCurrent && this.isCurrentCacheStale(entry)) {
        this.cache.delete(key);
      } else {
        return entry.report;
      }
    }

    // 2. Share in-flight promise to avoid duplicate concurrent RPC calls
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    const fetchPromise = DailySalesRepository.fetchDailySalesReport(cafeId, businessDate)
      .then((report) => {
        const now = Date.now();
        this.cache.set(key, { report, fetchedAt: now });
        // Also index under the resolved business date if fetched as CURRENT
        if (isCurrent && report.business_date) {
          const resolvedKey = this.getCacheKey(cafeId, report.business_date);
          this.cache.set(resolvedKey, { report, fetchedAt: now });
        }
        return report;
      })
      .finally(() => {
        this.inFlightRequests.delete(key);
      });

    this.inFlightRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Fetch authoritative transaction-level daily sales for a cafe.
   * 
   * @param cafeId Cafe UUID
   * @param businessDate Optional target date YYYY-MM-DD. When omitted, PostgreSQL determines current business date.
   * @param options Options including forceRefresh
   */
  public async getDailySalesTransactions(
    cafeId: string,
    businessDate?: string | null,
    options?: DailySalesServiceOptions
  ): Promise<DailySalesTransactionsResponse> {
    if (!cafeId) {
      throw new Error("[DailySalesService] cafeId is required.");
    }

    const key = this.getCacheKey(cafeId, businessDate);
    const isCurrent = !businessDate;

    // 1. Check in-memory transaction cache
    if (!options?.forceRefresh && this.txCache.has(key)) {
      const entry = this.txCache.get(key)!;
      if (isCurrent && this.isCurrentCacheStale(entry)) {
        this.txCache.delete(key);
      } else {
        return entry.response;
      }
    }

    // 2. Share in-flight promise
    if (this.inFlightTxRequests.has(key)) {
      return this.inFlightTxRequests.get(key)!;
    }

    const fetchPromise = DailySalesRepository.fetchDailySalesTransactions(cafeId, businessDate)
      .then((res) => {
        const now = Date.now();
        this.txCache.set(key, { response: res, fetchedAt: now });
        if (isCurrent && res.business_date) {
          const resolvedKey = this.getCacheKey(cafeId, res.business_date);
          this.txCache.set(resolvedKey, { response: res, fetchedAt: now });
        }
        return res;
      })
      .finally(() => {
        this.inFlightTxRequests.delete(key);
      });

    this.inFlightTxRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Invalidate cached report(s) and transaction list(s) for a cafe.
   */
  public invalidate(cafeId: string, businessDate?: string | null): void {
    if (businessDate) {
      const key = this.getCacheKey(cafeId, businessDate);
      this.cache.delete(key);
      this.txCache.delete(key);
    } else {
      // Invalidate all cached dates for this cafe
      for (const k of Array.from(this.cache.keys())) {
        if (k.startsWith(`${cafeId}:`)) {
          this.cache.delete(k);
        }
      }
      for (const k of Array.from(this.txCache.keys())) {
        if (k.startsWith(`${cafeId}:`)) {
          this.txCache.delete(k);
        }
      }
    }
  }

  /**
   * Clear all in-memory cache (primarily for test isolation).
   */
  public clearCache(): void {
    this.cache.clear();
    this.txCache.clear();
    this.inFlightRequests.clear();
    this.inFlightTxRequests.clear();
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Subscribe to live Realtime changes affecting Daily Sales for a cafe.
   * Debounces multiple rapid database events into a single authoritative fetch.
   * 
   * @param cafeId Cafe UUID
   * @param onUpdate Callback invoked with fresh authoritative report
   * @param debounceMs Debounce window in milliseconds (default 250ms)
   * @returns Unsubscribe function
   */
  public subscribeToDailySales(
    cafeId: string,
    onUpdate: DailySalesListener,
    debounceMs = 250
  ): () => void {
    if (!cafeId) return () => {};

    let sub = this.activeSubscriptions.get(cafeId);

    if (!sub) {
      const listeners = new Set<DailySalesListener>();

      const triggerDebouncedRefresh = () => {
        const existingTimer = this.debounceTimers.get(cafeId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
          this.debounceTimers.delete(cafeId);
          this.invalidate(cafeId);

          try {
            const freshReport = await this.getDailySalesReport(cafeId, null, { forceRefresh: true });
            for (const listener of listeners) {
              try {
                listener(freshReport);
              } catch (err) {
                console.error("[DailySalesService] Listener error:", err);
              }
            }
          } catch (fetchErr) {
            console.error("[DailySalesService] Failed to refetch report on realtime event:", fetchErr);
          }
        }, debounceMs);

        this.debounceTimers.set(cafeId, timer);
      };

      const channel = supabase
        .channel(`daily-sales-${cafeId}-${Math.random().toString(36).slice(2, 7)}`)
        // 1. Listen to public.bills changes for this cafe
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bills", filter: `cafe_id=eq.${cafeId}` },
          (payload: any) => {
            // Selective filtering: Invalidate on insert, delete, or relevant updates
            if (payload.eventType === "INSERT" || payload.eventType === "DELETE") {
              triggerDebouncedRefresh();
            } else if (payload.eventType === "UPDATE") {
              const oldRow = payload.old || {};
              const newRow = payload.new || {};
              if (
                newRow.payment_status !== oldRow.payment_status ||
                newRow.grand_total !== oldRow.grand_total ||
                newRow.paid_at !== oldRow.paid_at ||
                newRow.payment_method !== oldRow.payment_method ||
                newRow.subtotal !== oldRow.subtotal ||
                newRow.discount !== oldRow.discount ||
                newRow.total_items !== oldRow.total_items
              ) {
                triggerDebouncedRefresh();
              }
            }
          }
        )
        // 2. Listen to public.orders changes affecting pipeline/cancellations
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` },
          (payload: any) => {
            if (payload.eventType === "INSERT" || payload.eventType === "DELETE") {
              triggerDebouncedRefresh();
            } else if (payload.eventType === "UPDATE") {
              const oldRow = payload.old || {};
              const newRow = payload.new || {};
              // Only invalidate if status or total_cents changed
              if (newRow.status !== oldRow.status || newRow.total_cents !== oldRow.total_cents) {
                triggerDebouncedRefresh();
              }
            }
          }
        )
        .subscribe();

      sub = { channel, refCount: 0, listeners };
      this.activeSubscriptions.set(cafeId, sub);
    }

    sub.listeners.add(onUpdate);
    sub.refCount++;

    return () => {
      const currentSub = this.activeSubscriptions.get(cafeId);
      if (!currentSub) return;

      currentSub.listeners.delete(onUpdate);
      currentSub.refCount--;

      if (currentSub.refCount <= 0) {
        if (currentSub.channel) {
          try {
            void supabase.removeChannel(currentSub.channel);
          } catch (e) {}
        }
        this.activeSubscriptions.delete(cafeId);
        const timer = this.debounceTimers.get(cafeId);
        if (timer) {
          clearTimeout(timer);
          this.debounceTimers.delete(cafeId);
        }
      }
    };
  }
}

export const DailySalesService = new DailySalesServiceClass();
