import type { Operation, OperationConflict } from "./types";

class ConflictDetectorClass {
  private conflictLog: OperationConflict[] = [];
  private listeners: Set<(conflicts: OperationConflict[]) => void> = new Set();

  public logConflict(conflict: Omit<OperationConflict, "detectedAt">): OperationConflict {
    const entry: OperationConflict = {
      ...conflict,
      detectedAt: new Date().toISOString(),
    };
    this.conflictLog.unshift(entry);
    if (this.conflictLog.length > 100) {
      this.conflictLog.pop();
    }
    console.warn("[ConflictDetector] Operation conflict detected:", entry);
    this.notify();
    return entry;
  }

  public detectDuplicateIdempotency(existingOp: Operation, newOp: Operation): boolean {
    if (existingOp.idempotencyKey === newOp.idempotencyKey) {
      this.logConflict({
        operationId: newOp.operationId,
        operationType: newOp.operationType,
        idempotencyKey: newOp.idempotencyKey,
        reason: `Duplicate idempotency key detected: ${newOp.idempotencyKey}`,
        localPayload: newOp.payload,
        serverState: existingOp.payload,
      });
      return true;
    }
    return false;
  }

  public getConflicts(): OperationConflict[] {
    return [...this.conflictLog];
  }

  public clearConflicts(): void {
    this.conflictLog = [];
    this.notify();
  }

  public subscribe(listener: (conflicts: OperationConflict[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getConflicts());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const copy = this.getConflicts();
    for (const listener of this.listeners) {
      listener(copy);
    }
  }
}

export const ConflictDetector = new ConflictDetectorClass();
