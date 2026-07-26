/**
 * Centralized Realtime Workstation Event Registry
 * Enforces strict typing and naming for Supabase broadcast and postgres_changes channels.
 */

export const REALTIME_EVENTS = {
  TABLE_RESET: 'TABLE_RESET',
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_UPDATED: 'ORDER_UPDATED',
  SERVICE_REQUEST_UPDATED: 'SERVICE_REQUEST_UPDATED',
  SESSION_CLOSED: 'SESSION_CLOSED',
  SESSION_OPENED: 'SESSION_OPENED',
} as const;

export type RealtimeEventName = keyof typeof REALTIME_EVENTS;

export interface RealtimePayload<T = any> {
  event: RealtimeEventName;
  cafeId: string;
  tableId?: string;
  sessionId?: string;
  orderId?: string;
  timestamp: string;
  data?: T;
}
