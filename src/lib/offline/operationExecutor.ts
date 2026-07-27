import { generateUUID } from "@/lib/uuid";
import type { Operation, OperationHandler } from "./types";
import {
  enqueueOperation,
  getOperationByIdempotencyKey,
  updateOperation,
  removeOperation,
} from "./indexedDbQueue";
import { NetworkManager } from "./networkManager";
import { SyncManager } from "./syncManager";
import { ConflictDetector } from "./conflictDetector";

class OperationExecutorClass {
  private handlers: Map<string, OperationHandler> = new Map();

  public registerHandler<T = any>(type: string, handler: OperationHandler<T>): void {
    this.handlers.set(type, handler);
  }

  public unregisterHandler(type: string): void {
    this.handlers.delete(type);
  }

  public getHandler(type: string): OperationHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Dispatch an operation.
   * Online: Executes immediately. If network fails, automatically queues for background sync.
   * Offline: Queues directly into IndexedDB without throwing UI errors.
   */
  public async dispatch<T = any>(
    type: string,
    payload: T,
    options?: { idempotencyKey?: string; forceQueue?: boolean }
  ): Promise<{ operationId: string; status: Operation["status"]; result?: any; queued: boolean }> {
    const idempotencyKey = options?.idempotencyKey || `${type}_${generateUUID()}`;

    // Idempotency check against existing queued operations
    const existing = await getOperationByIdempotencyKey(idempotencyKey);
    if (existing) {
      ConflictDetector.detectDuplicateIdempotency(existing, {
        operationId: generateUUID(),
        operationType: type,
        payload,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        status: "Queued",
        idempotencyKey,
      });

      return {
        operationId: existing.operationId,
        status: existing.status,
        queued: existing.status === "Queued" || existing.status === "Retrying",
      };
    }

    const op: Operation<T> = {
      operationId: generateUUID(),
      operationType: type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: "Queued",
      idempotencyKey,
    };

    const isOnline = NetworkManager.isOnline() && !options?.forceQueue;

    if (!isOnline) {
      await enqueueOperation(op);
      void SyncManager.refreshPendingCount();
      console.log(`[OperationExecutor] Offline: Queued operation ${op.operationType} (${op.operationId})`);
      return { operationId: op.operationId, status: "Queued", queued: true };
    }

    // Try executing online
    try {
      op.status = "Running";
      op.lastAttemptAt = new Date().toISOString();
      const result = await this.executeHandler(op);
      op.status = "Completed";
      console.log(`[OperationExecutor] Online: Executed operation ${op.operationType} (${op.operationId})`);
      return { operationId: op.operationId, status: "Completed", result, queued: false };
    } catch (err: any) {
      const isNetworkOrHardwareError =
        !NetworkManager.isOnline() ||
        err?.message?.toLowerCase().includes("network") ||
        err?.message?.toLowerCase().includes("failed to fetch") ||
        err?.message?.toLowerCase().includes("offline") ||
        err?.message?.toLowerCase().includes("printer") ||
        err?.message?.toLowerCase().includes("paper") ||
        err?.message?.toLowerCase().includes("hardware");

      if (isNetworkOrHardwareError) {
        op.status = "Queued";
        op.error = err?.message || "Hardware/Network error during online dispatch";
        await enqueueOperation(op);
        void SyncManager.refreshPendingCount();
        console.warn(`[OperationExecutor] Online execution failed due to hardware/network error. Queued for sync: ${op.operationId}`);
        return { operationId: op.operationId, status: "Queued", queued: true };
      }

      op.status = "Failed";
      op.error = err?.message || "Operation failed";
      await enqueueOperation(op);
      void SyncManager.refreshPendingCount();
      throw err;
    }
  }

  public async executeSingleOperation(op: Operation): Promise<any> {
    op.status = "Running";
    op.lastAttemptAt = new Date().toISOString();
    await updateOperation(op);

    try {
      const result = await this.executeHandler(op);
      op.status = "Completed";
      await removeOperation(op.operationId);
      void SyncManager.refreshPendingCount();
      return result;
    } catch (err: any) {
      op.retryCount += 1;
      op.error = err?.message || "Execution error";
      if (op.retryCount >= 5) {
        op.status = "Failed";
      } else {
        op.status = "Retrying";
      }
      await updateOperation(op);
      void SyncManager.refreshPendingCount();
      throw err;
    }
  }

  private async executeHandler(op: Operation): Promise<any> {
    const handler = this.handlers.get(op.operationType);
    if (!handler) {
      throw new Error(`No registered operation handler for type: "${op.operationType}"`);
    }
    return await handler(op.payload, op);
  }
}

export const OperationExecutor = new OperationExecutorClass();
