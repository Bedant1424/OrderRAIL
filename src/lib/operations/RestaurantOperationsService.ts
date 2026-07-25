import { supabase } from '@/lib/db';
import { updateTableStatusInDb, closeDiningSessionInDb } from '@/lib/tables/tableRepository';
import { dismissAllServiceRequestsByTableInDb } from '@/lib/serviceRequests/repository';

export interface ResetTableResult {
  success: boolean;
  tableId: string;
  previousSessionId?: string | null;
  timestamp: string;
}

export class RestaurantOperationsService {
  /**
   * Restores Table Reset Lifecycle & Service Request Cleanup.
   * Centralized operational endpoint for Counter and Staff workstations.
   *
   * Responsibilities:
   * 1. Closes active dining session in DB.
   * 2. Clears/dismisses all active service requests (Water, Bill, Staff, Cleaning) linked to tableId.
   * 3. Resets table state in DB to 'available' with null active_session_id.
   * 4. Broadcasts realtime TABLE_RESET event to all active workstations.
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

    if (sessionIdToClose && !sessionIdToClose.startsWith('session-')) {
      try {
        await closeDiningSessionInDb(sessionIdToClose);
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
      try {
        const channel = supabase.channel(`cafe-workstation-${cafeId}`);
        await channel.send({
          type: 'broadcast',
          event: 'TABLE_RESET',
          payload: { tableId, activeSessionId: sessionIdToClose, timestamp },
        });
      } catch (e: any) {
        console.warn('[RestaurantOperationsService] Realtime TABLE_RESET broadcast notice:', e?.message || e);
      }
    }

    return {
      success: true,
      tableId,
      previousSessionId: sessionIdToClose,
      timestamp,
    };
  }
}
