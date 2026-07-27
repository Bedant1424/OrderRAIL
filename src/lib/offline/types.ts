/**
 * Sprint 9.2.3.0a — Offline Operations Engine Types
 */

export type OperationStatus = 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Retrying';

export interface Operation<T = any> {
  operationId: string;
  operationType: string;
  payload: T;
  createdAt: string;
  retryCount: number;
  status: OperationStatus;
  idempotencyKey: string;
  error?: string;
  lastAttemptAt?: string;
}

export type ConnectionState = 'online' | 'offline' | 'degraded';

/**
 * NetworkState owns strictly network connectivity properties.
 */
export interface NetworkState {
  isOnline: boolean;
  isForcedOffline: boolean;
  connectionState: ConnectionState;
}

/**
 * SyncProgress owns synchronization state, progress metrics, and pending operation counts.
 */
export interface SyncProgress {
  isSyncing: boolean;
  total: number;
  processed: number;
  currentOperationId: string | null;
  error: string | null;
  lastSuccessfulSync: string | null;
  pendingOperationCount: number;
}

export interface OperationConflict {
  operationId: string;
  operationType: string;
  idempotencyKey: string;
  reason: string;
  localPayload: any;
  serverState?: any;
  detectedAt: string;
}

export type OperationHandler<T = any> = (payload: T, operation: Operation<T>) => Promise<any>;
