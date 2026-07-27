import { useState, useEffect } from "react";
import type { SyncProgress } from "./types";
import { getPendingOperations, getPendingCount } from "./indexedDbQueue";
import { NetworkManager } from "./networkManager";
import { OperationExecutor } from "./operationExecutor";
import { OfflineEventBus } from "./events";

class SynchronizationManagerClass {
  private isSyncing: boolean = false;
  private activeSyncPromise: Promise<{ success: boolean; processed: number; total: number }> | null = null;
  private lastSyncTime: string | null = null;
  private pendingCount: number = 0;
  private currentProgress: SyncProgress = {
    isSyncing: false,
    total: 0,
    processed: 0,
    currentOperationId: null,
    error: null,
    lastSuccessfulSync: null,
    pendingOperationCount: 0,
  };
  private listeners: Set<(progress: SyncProgress) => void> = new Set();

  constructor() {
    OfflineEventBus.on("NetworkConnected", () => {
      if (!this.isSyncing && NetworkManager.isOnline()) {
        void this.startSync();
      }
    });
  }

  public getProgress(): SyncProgress {
    return { ...this.currentProgress };
  }

  public getLastSuccessfulSync(): string | null {
    return this.lastSyncTime;
  }

  public setLastSuccessfulSync(timestamp: string = new Date().toISOString()): void {
    this.lastSyncTime = timestamp;
    this.currentProgress.lastSuccessfulSync = timestamp;
    this.notifyListeners();
  }

  public getPendingCount(): number {
    return this.pendingCount;
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      this.pendingCount = await getPendingCount();
    } catch {
      this.pendingCount = 0;
    }
    this.currentProgress.pendingOperationCount = this.pendingCount;
    OfflineEventBus.emit("QueueChanged", { pendingCount: this.pendingCount });
    this.notifyListeners();
    return this.pendingCount;
  }

  public subscribe(listener: (progress: SyncProgress) => void): () => void {
    this.listeners.add(listener);
    listener(this.getProgress());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async startSync(): Promise<{ success: boolean; processed: number; total: number }> {
    if (!NetworkManager.isOnline()) {
      return { success: false, processed: 0, total: 0 };
    }

    if (this.activeSyncPromise) {
      return this.activeSyncPromise;
    }

    this.activeSyncPromise = this.performSync();
    try {
      return await this.activeSyncPromise;
    } finally {
      this.activeSyncPromise = null;
    }
  }

  private async performSync(): Promise<{ success: boolean; processed: number; total: number }> {
    if (this.isSyncing) {
      return { success: false, processed: this.currentProgress.processed, total: this.currentProgress.total };
    }

    const pendingOps = await getPendingOperations();
    this.pendingCount = pendingOps.length;

    if (pendingOps.length === 0) {
      const timestamp = new Date().toISOString();
      this.setLastSuccessfulSync(timestamp);
      this.updateProgress({
        isSyncing: false,
        total: 0,
        processed: 0,
        currentOperationId: null,
        error: null,
        lastSuccessfulSync: this.lastSyncTime,
        pendingOperationCount: 0,
      });
      OfflineEventBus.emit("SyncCompleted", { processed: 0, total: 0, timestamp });
      return { success: true, processed: 0, total: 0 };
    }

    this.isSyncing = true;
    this.updateProgress({
      isSyncing: true,
      total: pendingOps.length,
      processed: 0,
      currentOperationId: null,
      error: null,
      lastSuccessfulSync: this.lastSyncTime,
      pendingOperationCount: pendingOps.length,
    });

    OfflineEventBus.emit("SyncStarted", { total: pendingOps.length });

    let processedCount = 0;
    let syncError: string | null = null;

    for (const op of pendingOps) {
      if (!NetworkManager.isOnline()) {
        console.warn("[SyncManager] Connection lost during sync. Pausing queue processing.");
        break;
      }

      this.updateProgress({
        ...this.currentProgress,
        currentOperationId: op.operationId,
      });

      try {
        await OperationExecutor.executeSingleOperation(op);
        processedCount++;
        await this.refreshPendingCount();
        this.updateProgress({
          ...this.currentProgress,
          processed: processedCount,
          pendingOperationCount: this.pendingCount,
        });
      } catch (err: any) {
        console.error(`[SyncManager] Error executing operation ${op.operationId}:`, err);
        syncError = `Failed on ${op.operationType}: ${err?.message || "Error"}`;
        this.updateProgress({
          ...this.currentProgress,
          error: syncError,
        });
        // Stop processing downstream dependent operations if an upstream operation fails
        break;
      }
    }

    this.isSyncing = false;

    if (processedCount === pendingOps.length) {
      const timestamp = new Date().toISOString();
      this.setLastSuccessfulSync(timestamp);
      
      this.updateProgress({
        isSyncing: false,
        total: 0,
        processed: 0,
        currentOperationId: null,
        error: null,
        lastSuccessfulSync: timestamp,
        pendingOperationCount: 0,
      });

      OfflineEventBus.emit("SyncCompleted", {
        processed: processedCount,
        total: pendingOps.length,
        timestamp,
      });

      return { success: true, processed: processedCount, total: pendingOps.length };
    }

    this.updateProgress({
      ...this.currentProgress,
      isSyncing: false,
    });

    OfflineEventBus.emit("SyncFailed", {
      error: syncError || "Sync incomplete",
      processed: processedCount,
      total: pendingOps.length,
    });

    return { success: false, processed: processedCount, total: pendingOps.length };
  }

  private updateProgress(progress: SyncProgress): void {
    this.currentProgress = progress;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const progressCopy = { ...this.currentProgress };
    for (const listener of Array.from(this.listeners)) {
      listener(progressCopy);
    }
  }
}

export const SyncManager = new SynchronizationManagerClass();

export function useSyncProgress(): SyncProgress {
  const [progress, setProgress] = useState<SyncProgress>(() => SyncManager.getProgress());

  useEffect(() => {
    return SyncManager.subscribe((newProgress) => {
      setProgress(newProgress);
    });
  }, []);

  return progress;
}

export function usePendingOperationCount(): number {
  const progress = useSyncProgress();
  return progress.pendingOperationCount;
}
