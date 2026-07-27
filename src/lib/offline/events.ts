/**
 * Sprint 9.2.3.0a — Offline Operations Engine Event Bus
 */

export type OfflineEventType =
  | 'NetworkConnected'
  | 'NetworkDisconnected'
  | 'SyncStarted'
  | 'SyncCompleted'
  | 'SyncFailed'
  | 'QueueChanged';

export interface OfflineEventPayloads {
  NetworkConnected: undefined;
  NetworkDisconnected: undefined;
  SyncStarted: { total: number };
  SyncCompleted: { processed: number; total: number; timestamp: string };
  SyncFailed: { error: string; processed: number; total: number };
  QueueChanged: { pendingCount: number };
}

export type OfflineEventListener<K extends OfflineEventType> = (
  payload: OfflineEventPayloads[K]
) => void;

class OfflineEventBusClass {
  private listeners: { [K in OfflineEventType]?: Set<OfflineEventListener<K>> } = {};

  public on<K extends OfflineEventType>(
    event: K,
    listener: OfflineEventListener<K>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    (this.listeners[event] as Set<OfflineEventListener<K>>).add(listener);

    return () => {
      this.off(event, listener);
    };
  }

  public off<K extends OfflineEventType>(
    event: K,
    listener: OfflineEventListener<K>
  ): void {
    if (this.listeners[event]) {
      (this.listeners[event] as Set<OfflineEventListener<K>>).delete(listener);
    }
  }

  public emit<K extends OfflineEventType>(
    event: K,
    payload: OfflineEventPayloads[K]
  ): void {
    if (this.listeners[event]) {
      const copy = Array.from(this.listeners[event] as Set<OfflineEventListener<K>>);
      for (const listener of copy) {
        try {
          listener(payload);
        } catch (err) {
          console.error(`[OfflineEventBus] Error handling event "${event}":`, err);
        }
      }
    }
  }

  public removeAllListeners(): void {
    this.listeners = {};
  }
}

export const OfflineEventBus = new OfflineEventBusClass();
