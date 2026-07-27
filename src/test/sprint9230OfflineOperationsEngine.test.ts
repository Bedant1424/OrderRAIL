import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NetworkManager,
  OperationExecutor,
  SyncManager,
  ConflictDetector,
  OfflineEventBus,
  enqueueOperation,
  getOperation,
  getPendingOperations,
  clearAllOperations,
  type Operation,
} from "@/lib/offline";

describe("Sprint 9.2.3.0a — Offline Operations Engine Stabilization Tests", () => {
  beforeEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    ConflictDetector.clearConflicts();
    OfflineEventBus.removeAllListeners();
  });

  afterEach(async () => {
    NetworkManager.resetForceOverride();
    await clearAllOperations();
    await SyncManager.refreshPendingCount();
    OfflineEventBus.removeAllListeners();
  });

  it("1. NetworkManager: Correctly manages network state and developer overrides", () => {
    expect(NetworkManager.isOnline()).toBe(true);
    expect(NetworkManager.getConnectionState()).toBe("online");

    NetworkManager.forceOffline();
    expect(NetworkManager.isOnline()).toBe(false);
    expect(NetworkManager.isForcedOffline()).toBe(true);
    expect(NetworkManager.getConnectionState()).toBe("offline");

    NetworkManager.forceOnline();
    expect(NetworkManager.isOnline()).toBe(true);
    expect(NetworkManager.isForcedOffline()).toBe(false);
  });

  it("2. IndexedDbQueue: Enqueues, retrieves FIFO pending ops, and clears operations", async () => {
    const op1: Operation = {
      operationId: "op-1",
      operationType: "CREATE_ORDER",
      payload: { totalCents: 1500 },
      createdAt: new Date("2026-07-27T09:00:00Z").toISOString(),
      retryCount: 0,
      status: "Queued",
      idempotencyKey: "idem-1",
    };

    const op2: Operation = {
      operationId: "op-2",
      operationType: "UPDATE_STATUS",
      payload: { status: "preparing" },
      createdAt: new Date("2026-07-27T09:01:00Z").toISOString(),
      retryCount: 0,
      status: "Queued",
      idempotencyKey: "idem-2",
    };

    await enqueueOperation(op1);
    await enqueueOperation(op2);

    const fetched = await getOperation("op-1");
    expect(fetched).toBeDefined();
    expect(fetched?.idempotencyKey).toBe("idem-1");

    const pending = await getPendingOperations();
    expect(pending.length).toBe(2);
    expect(pending[0].operationId).toBe("op-1"); // FIFO order (oldest first)
    expect(pending[1].operationId).toBe("op-2");
  });

  it("3. OperationExecutor: Executes online immediately and queues offline automatically", async () => {
    const mockHandler = vi.fn().mockResolvedValue({ success: true, dbId: "order-999" });
    OperationExecutor.registerHandler("TEST_ORDER_CREATE", mockHandler);

    // Online execution
    const resOnline = await OperationExecutor.dispatch("TEST_ORDER_CREATE", { item: "Coffee" }, { idempotencyKey: "key-online-1" });
    expect(resOnline.status).toBe("Completed");
    expect(resOnline.queued).toBe(false);
    expect(mockHandler).toHaveBeenCalledTimes(1);

    // Offline execution (simulated via forceOffline)
    NetworkManager.forceOffline();
    const resOffline = await OperationExecutor.dispatch("TEST_ORDER_CREATE", { item: "Tea" }, { idempotencyKey: "key-offline-1" });
    expect(resOffline.status).toBe("Queued");
    expect(resOffline.queued).toBe(true);

    const pendingAfterOffline = await getPendingOperations();
    expect(pendingAfterOffline.length).toBe(1);
    expect(pendingAfterOffline[0].payload).toEqual({ item: "Tea" });
  });

  it("4. ConflictDetector: Prevents duplicate operation execution via Idempotency Keys", async () => {
    const mockHandler = vi.fn().mockResolvedValue({ ok: true });
    OperationExecutor.registerHandler("TEST_DUPLICATE", mockHandler);

    NetworkManager.forceOffline();
    const res1 = await OperationExecutor.dispatch("TEST_DUPLICATE", { id: 1 }, { idempotencyKey: "DUPLICATE_KEY_100" });
    expect(res1.status).toBe("Queued");

    // Second dispatch with SAME idempotency key
    const res2 = await OperationExecutor.dispatch("TEST_DUPLICATE", { id: 1 }, { idempotencyKey: "DUPLICATE_KEY_100" });
    expect(res2.operationId).toBe(res1.operationId);

    const conflicts = ConflictDetector.getConflicts();
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].idempotencyKey).toBe("DUPLICATE_KEY_100");
  });

  it("5. SynchronizationManager: Automatically flushes FIFO queue when network is online", async () => {
    const executedPayloads: any[] = [];
    OperationExecutor.registerHandler("SYNC_ITEM", async (payload) => {
      executedPayloads.push(payload);
      return { sync: true };
    });

    // Queue 3 operations while offline
    NetworkManager.forceOffline();
    await OperationExecutor.dispatch("SYNC_ITEM", { item: "First" }, { idempotencyKey: "sync-1" });
    await OperationExecutor.dispatch("SYNC_ITEM", { item: "Second" }, { idempotencyKey: "sync-2" });
    await OperationExecutor.dispatch("SYNC_ITEM", { item: "Third" }, { idempotencyKey: "sync-3" });

    const pendingBefore = await getPendingOperations();
    expect(pendingBefore.length).toBe(3);

    // Turn connection online and sync
    NetworkManager.forceOnline();
    const syncRes = await SyncManager.startSync();

    expect(syncRes.success).toBe(true);
    expect(syncRes.processed).toBe(3);
    expect(executedPayloads).toEqual([
      { item: "First" },
      { item: "Second" },
      { item: "Third" },
    ]);

    const pendingAfter = await getPendingOperations();
    expect(pendingAfter.length).toBe(0);
  });

  it("6. Architecture & Event Model: Emits typed events strictly on specific state changes", async () => {
    const eventsLogged: string[] = [];
    OfflineEventBus.on("NetworkConnected", () => eventsLogged.push("NetworkConnected"));
    OfflineEventBus.on("NetworkDisconnected", () => eventsLogged.push("NetworkDisconnected"));
    OfflineEventBus.on("SyncStarted", () => eventsLogged.push("SyncStarted"));
    OfflineEventBus.on("SyncCompleted", () => eventsLogged.push("SyncCompleted"));

    NetworkManager.forceOffline();
    expect(eventsLogged).toContain("NetworkDisconnected");

    NetworkManager.forceOnline();
    expect(eventsLogged).toContain("NetworkConnected");

    const syncRes = await SyncManager.startSync();
    expect(syncRes.success).toBe(true);
    expect(eventsLogged).toContain("SyncCompleted");
  });

  it("7. Re-entrancy Protection & Coalescing: Multiple startSync calls coalesce and do not loop", async () => {
    OperationExecutor.registerHandler("SLOW_OP", async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ok: true };
    });

    NetworkManager.forceOffline();
    await OperationExecutor.dispatch("SLOW_OP", { id: 1 }, { idempotencyKey: "slow-1" });
    NetworkManager.forceOnline();

    // Call startSync twice concurrently
    const p1 = SyncManager.startSync();
    const p2 = SyncManager.startSync();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(r1.success).toBe(true);
    expect(r1.processed).toBe(1);
  });

  it("8. Responsibilities Separation: NetworkManager only manages connectivity", () => {
    const netState = NetworkManager.getState();
    expect(netState).toHaveProperty("isOnline");
    expect(netState).toHaveProperty("connectionState");
    expect(netState).toHaveProperty("isForcedOffline");
    expect(netState).not.toHaveProperty("lastSuccessfulSync");
    expect(netState).not.toHaveProperty("pendingOperationCount");

    const progress = SyncManager.getProgress();
    expect(progress).toHaveProperty("lastSuccessfulSync");
    expect(progress).toHaveProperty("pendingOperationCount");
    expect(progress).toHaveProperty("isSyncing");
  });
});
