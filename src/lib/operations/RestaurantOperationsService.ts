import { supabase } from '@/lib/db';
import { updateTableStatusInDb, closeDiningSessionInDb, getOrCreateDiningSession } from '@/lib/tables/tableRepository';
import { dismissAllServiceRequestsByTableInDb } from '@/lib/serviceRequests/repository';
import { updateOrderStatusInDb } from '@/lib/orders/repository';
import { expireGuestSessionsForDiningSession } from '@/lib/guestSession';
import { REALTIME_EVENTS } from './realtimeEvents';

export interface ResetTableResult {
  success: boolean;
  tableId: string;
  previousSessionId?: string | null;
  timestamp: string;
}

export interface OpenSessionResult {
  sessionId: string;
  tableId: string;
  timestamp: string;
}

export interface CollectPaymentInput {
  cafeId: string;
  tableId?: string | null;
  sessionId: string;
  orderIds: string[];
  paymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'MIXED';
}

export class RestaurantOperationsService {
  /**
   * Opens or retrieves an active dining session for a table.
   */
  public static async openSession(tableId: string, cafeId: string, tableLabel: string = '1'): Promise<OpenSessionResult> {
    const timestamp = new Date().toISOString();
    const tableRow = {
      id: tableId,
      cafe_id: cafeId,
      active_session_id: null,
      label: tableLabel,
      seats: 4,
      status: 'free',
    };

    const sessionId = await getOrCreateDiningSession(tableRow as any);

    try {
      await updateTableStatusInDb(tableId, 'occupied', sessionId);
    } catch (e: any) {
      console.warn('[RestaurantOperationsService] Table occupy warning:', e?.message || e);
    }

    this.broadcastEvent(cafeId, REALTIME_EVENTS.SESSION_OPENED, { tableId, sessionId, timestamp });

    return { sessionId, tableId, timestamp };
  }

  /**
   * Marks table state as OCCUPIED linked to a session ID.
   */
  public static async occupyTable(tableId: string, sessionId: string, cafeId?: string): Promise<void> {
    await updateTableStatusInDb(tableId, 'occupied', sessionId);
    if (cafeId) {
      this.broadcastEvent(cafeId, REALTIME_EVENTS.ORDER_UPDATED, { tableId, sessionId, timestamp: new Date().toISOString() });
    }
  }

  /**
   * Begins payment process for a dining session.
   */
  public static async beginPayment(sessionId: string, cafeId?: string): Promise<void> {
    if (cafeId) {
      this.broadcastEvent(cafeId, REALTIME_EVENTS.ORDER_UPDATED, { sessionId, timestamp: new Date().toISOString() });
    }
  }

  /**
   * Closes an active dining session in DB.
   */
  public static async closeSession(sessionId: string, tableId?: string, cafeId?: string): Promise<void> {
    if (sessionId && !sessionId.startsWith('session-')) {
      await closeDiningSessionInDb(sessionId);
    }
    if (cafeId) {
      this.broadcastEvent(cafeId, REALTIME_EVENTS.SESSION_CLOSED, { sessionId, tableId, timestamp: new Date().toISOString() });
    }
  }

  /**
   * Releases table, closing active session and restoring to AVAILABLE.
   */
  public static async releaseTable(tableId: string, cafeId?: string, activeSessionId?: string | null): Promise<ResetTableResult> {
    return this.resetTable(tableId, cafeId, activeSessionId);
  }

  /**
   * Restores Table Reset Lifecycle & Service Request Cleanup.
   * Centralized operational endpoint for Counter and Staff workstations.
   */
  public static async resetTable(
    tableId: string,
    cafeId?: string,
    activeSessionId?: string | null
  ): Promise<ResetTableResult> {
    const timestamp = new Date().toISOString();

    // 1. Close Active Dining Session if provided or fetch table active_session_id
    let sessionIdToClose = activeSessionId;
    if (!sessionIdToClose) {
      try {
        const { data: tableRow } = await supabase
          .from('tables')
          .select('active_session_id')
          .eq('id', tableId)
          .maybeSingle();
        sessionIdToClose = tableRow?.active_session_id;
      } catch (e: any) {
        console.warn('[RestaurantOperationsService] Warning reading table active session:', e?.message || e);
      }
    }

    if (sessionIdToClose) {
      try {
        await closeDiningSessionInDb(sessionIdToClose);
        await expireGuestSessionsForDiningSession(sessionIdToClose);
      } catch (e: any) {
        console.warn('[RestaurantOperationsService] DB session closure notice:', e?.message || e);
      }
    }

    // 2. Dismiss all active service requests for this table
    try {
      await dismissAllServiceRequestsByTableInDb(tableId);
    } catch (e: any) {
      console.warn('[RestaurantOperationsService] Service request cleanup notice:', e?.message || e);
    }

    // 3. Reset table status to AVAILABLE with null active_session_id
    try {
      await updateTableStatusInDb(tableId, 'available', null);
    } catch (e: any) {
      console.warn('[RestaurantOperationsService] Table reset status update notice:', e?.message || e);
    }

    // 4. Broadcast realtime TABLE_RESET event
    if (cafeId) {
      this.broadcastEvent(cafeId, REALTIME_EVENTS.TABLE_RESET, { tableId, activeSessionId: sessionIdToClose, timestamp });
    }

    return {
      success: true,
      tableId,
      previousSessionId: sessionIdToClose,
      timestamp,
    };
  }

  /**
   * Helper to broadcast workstation realtime events safely.
   */
  private static broadcastEvent(cafeId: string, event: string, payload: Record<string, any>): void {
    try {
      const channel = supabase.channel(`cafe-workstation-${cafeId}`);
      void channel.send({
        type: 'broadcast',
        event,
        payload: { ...payload, cafeId },
      });
    } catch (e: any) {
      console.warn(`[RestaurantOperationsService] Realtime broadcast warning for ${event}:`, e?.message || e);
    }
  }
}
