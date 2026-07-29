/**
 * Sprint 9.2.3.1 & 9.2.3.2 — Offline Order Management & KOT Printing Integration
 * 
 * Provides a single unified execution path for all order & print operations in OrderRail.
 * Routes every operation through the Offline Operations Engine (OperationExecutor).
 */

import { generateUUID } from "@/lib/uuid";
import {
  OperationExecutor,
  SyncManager,
  NetworkManager,
  getAllOperations,
  removeOperation,
  type Operation,
} from "@/lib/offline";
import { supabase } from "@/lib/db";
import {
  createOrderInDb,
  editOrderInDb,
  cancelOrderInDb,
  updateOrderStatusInDb,
  type CreateOrderPayload,
  type EditOrderItemPayload,
} from "./repository";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";
import { billsMap } from "@/lib/billing/billingService";

// In-Memory Temporary ID Mapping (temp_ord_... -> server_order_id)
export const orderIdMapping = new Map<string, string>();

export interface PrintKotOperationPayload {
  operationId?: string;
  orderId: string;
  diningSessionId?: string | null;
  tableId?: string | null;
  tableLabel: string;
  orderNumber: number | string;
  kotNumber: number | string;
  timestamp: string;
  printerTarget?: string;
  items: {
    id?: string;
    name: string;
    price: number;
    qty: number;
    notes?: string;
  }[];
  notes?: string;
  isReprint?: boolean;
}

export interface OfflineOrderView {
  id: string;
  tempId?: string;
  cafe_id: string;
  table_id: string;
  dining_session_id?: string | null;
  guest_session_id?: string | null;
  session_id?: string | null;
  total_cents: number;
  note?: string | null;
  status: string;
  syncState: 'Pending Sync' | 'Syncing' | 'Synced' | 'Sync Failed';
  operationId?: string;
  items: {
    id?: string;
    menu_item_id?: string | null;
    name: string;
    price_cents: number;
    qty: number;
    note?: string | null;
  }[];
  created_at: string;
}

export class OrderServiceClass {
  private handlersRegistered: boolean = false;

  constructor() {
    this.initHandlers();
  }

  public initHandlers(): void {
    if (this.handlersRegistered) return;
    this.handlersRegistered = true;

    // Handler 1: CREATE_ORDER
    OperationExecutor.registerHandler("CREATE_ORDER", async (payload: CreateOrderPayload) => {
      const realOrderId = orderIdMapping.get(payload.id!) || payload.id;
      const finalPayload = { ...payload, id: realOrderId };
      const createdOrder = await createOrderInDb(finalPayload);
      if (payload.id && payload.id !== createdOrder.id) {
        orderIdMapping.set(payload.id, createdOrder.id);
      }
      return { orderId: createdOrder.id, dbOrder: createdOrder };
    });

    // Handler 2: EDIT_ORDER
    OperationExecutor.registerHandler(
      "EDIT_ORDER",
      async (params: {
        orderId: string;
        items: EditOrderItemPayload[];
        notes?: string | null;
        updatedBy?: "customer" | "staff" | "owner";
        guestSessionId?: string | null;
      }) => {
        const realOrderId = orderIdMapping.get(params.orderId) || params.orderId;
        await editOrderInDb({ ...params, orderId: realOrderId });
        return { success: true };
      }
    );

    // Handler 3: CANCEL_ORDER
    OperationExecutor.registerHandler(
      "CANCEL_ORDER",
      async (params: {
        orderId: string;
        updatedBy?: "customer" | "staff" | "owner";
        guestSessionId?: string | null;
      }) => {
        const realOrderId = orderIdMapping.get(params.orderId) || params.orderId;
        await cancelOrderInDb(realOrderId, params.updatedBy, params.guestSessionId);
        return { success: true };
      }
    );

    // Handler 4: UPDATE_ORDER_STATUS
    OperationExecutor.registerHandler(
      "UPDATE_ORDER_STATUS",
      async (params: {
        orderId: string;
        nextStatus: any;
        updatedBy?: "customer" | "staff" | "owner" | "counter";
        actorRole?: any;
      }) => {
        const realOrderId = orderIdMapping.get(params.orderId) || params.orderId;
        await updateOrderStatusInDb(realOrderId, params.nextStatus, params.updatedBy, params.actorRole);
        return { success: true };
      }
    );

    // Handler 5: PRINT_KOT
    OperationExecutor.registerHandler("PRINT_KOT", async (payload: PrintKotOperationPayload) => {
      const realOrderId = orderIdMapping.get(payload.orderId) || payload.orderId;
      const finalPayload = { ...payload, orderId: realOrderId };
      const res = await PrinterAdapter.printKot(finalPayload as any);
      return res;
    });
  }

  /**
   * Dispatch Order Creation through Operations Engine
   */
  public async createOrder(
    payload: CreateOrderPayload,
    options?: { forceQueue?: boolean }
  ): Promise<{ orderId: string; queued: boolean; status: Operation["status"]; dbOrder?: any }> {
    this.initHandlers();

    const tempId = payload.id || `temp_ord_${generateUUID()}`;
    const opPayload: CreateOrderPayload = {
      ...payload,
      id: tempId,
    };

    const res = await OperationExecutor.dispatch("CREATE_ORDER", opPayload, {
      idempotencyKey: `create_order_${tempId}`,
      forceQueue: options?.forceQueue,
    });

    const realId = orderIdMapping.get(tempId) || tempId;
    return {
      orderId: realId,
      queued: res.queued,
      status: res.status,
      dbOrder: res.result?.dbOrder,
    };
  }

  /**
   * Dispatch Order Edit through Operations Engine
   */
  public async editOrder(
    params: {
      orderId: string;
      items: EditOrderItemPayload[];
      notes?: string | null;
      updatedBy?: "customer" | "staff" | "owner";
      guestSessionId?: string | null;
    },
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const realOrderId = orderIdMapping.get(params.orderId) || params.orderId;
    const paidBill = Array.from(billsMap.values()).find((b) => b.orderId === realOrderId && b.paymentStatus === "paid");
    if (paidBill) {
      throw new Error(`Order ${realOrderId} is linked to a paid bill (${paidBill.billNumber}) and is immutable.`);
    }

    const res = await OperationExecutor.dispatch(
      "EDIT_ORDER",
      { ...params, orderId: realOrderId },
      {
        idempotencyKey: `edit_order_${realOrderId}_${Date.now()}`,
        forceQueue: options?.forceQueue,
      }
    );
    return { queued: res.queued, status: res.status };
  }

  /**
   * Dispatch Order Cancellation through Operations Engine
   */
  public async cancelOrder(
    orderId: string,
    updatedBy: "customer" | "staff" | "owner" = "staff",
    guestSessionId?: string | null,
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const realOrderId = orderIdMapping.get(orderId) || orderId;
    const paidBill = Array.from(billsMap.values()).find((b) => b.orderId === realOrderId && b.paymentStatus === "paid");
    if (paidBill) {
      throw new Error(`Order ${realOrderId} is linked to a paid bill (${paidBill.billNumber}) and is immutable.`);
    }

    const res = await OperationExecutor.dispatch(
      "CANCEL_ORDER",
      { orderId: realOrderId, updatedBy, guestSessionId },
      {
        idempotencyKey: `cancel_order_${realOrderId}`,
        forceQueue: options?.forceQueue,
      }
    );
    return { queued: res.queued, status: res.status };
  }

  /**
   * Dispatch Order Status Update through Operations Engine
   */
  public async updateOrderStatus(
    orderId: string,
    nextStatus: any,
    updatedBy: "customer" | "staff" | "owner" | "counter" = "staff",
    actorRole?: any,
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const realOrderId = orderIdMapping.get(orderId) || orderId;
    const res = await OperationExecutor.dispatch(
      "UPDATE_ORDER_STATUS",
      { orderId: realOrderId, nextStatus, updatedBy, actorRole },
      {
        idempotencyKey: `status_order_${realOrderId}_${nextStatus}_${Date.now()}`,
        forceQueue: options?.forceQueue,
      }
    );
    return { queued: res.queued, status: res.status };
  }

  /**
   * Dispatch KOT Print operation through Operations Engine
   */
  public async printKot(
    payload: PrintKotOperationPayload,
    options?: { forceQueue?: boolean }
  ): Promise<{ operationId: string; queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const realOrderId = orderIdMapping.get(payload.orderId) || payload.orderId;
    const kotNumber = payload.kotNumber || payload.orderNumber || 101;
    const idempotencyKey = payload.isReprint
      ? `reprint_kot_${realOrderId}_${Date.now()}`
      : `print_kot_${realOrderId}_${kotNumber}`;

    const res = await OperationExecutor.dispatch(
      "PRINT_KOT",
      { ...payload, orderId: realOrderId, kotNumber },
      {
        idempotencyKey,
        forceQueue: options?.forceQueue,
      }
    );

    return {
      operationId: res.operationId,
      queued: res.queued,
      status: res.status,
    };
  }

  /**
   * Dispatch KOT Reprint operation through Operations Engine
   */
  public async reprintKot(
    orderId: string,
    payload: Omit<PrintKotOperationPayload, "orderId" | "isReprint">,
    options?: { forceQueue?: boolean }
  ): Promise<{ operationId: string; queued: boolean; status: Operation["status"] }> {
    return this.printKot(
      { ...payload, orderId, isReprint: true },
      options
    );
  }

  /**
   * Fetch all queued PRINT_KOT operations from IndexedDB
   */
  public async getQueuedPrintJobs(): Promise<Operation<PrintKotOperationPayload>[]> {
    const allOps = await getAllOperations();
    return allOps.filter((op) => op.operationType === "PRINT_KOT") as any;
  }

  /**
   * Fetch all pending/queued offline orders formatted for UI display
   */
  public async getQueuedOfflineOrders(): Promise<OfflineOrderView[]> {
    const allOps = await getAllOperations();
    const queuedOrdersMap = new Map<string, OfflineOrderView>();

    // Process operations in creation order
    for (const op of allOps) {
      if (op.status === "Completed") continue;

      const syncState: OfflineOrderView["syncState"] =
        op.status === "Queued"
          ? "Pending Sync"
          : op.status === "Running"
          ? "Syncing"
          : "Sync Failed";

      if (op.operationType === "CREATE_ORDER") {
        const payload = op.payload as CreateOrderPayload;
        const realId = orderIdMapping.get(payload.id!) || payload.id!;

        queuedOrdersMap.set(realId, {
          id: realId,
          tempId: payload.id !== realId ? payload.id : undefined,
          cafe_id: payload.cafe_id,
          table_id: payload.table_id,
          dining_session_id: payload.dining_session_id,
          guest_session_id: payload.guest_session_id,
          session_id: payload.session_id,
          total_cents: payload.total_cents,
          note: payload.note,
          status: payload.status || "pending",
          syncState,
          operationId: op.operationId,
          items: (payload.items || []).map((i) => ({
            id: i.menu_item_id || undefined,
            menu_item_id: i.menu_item_id,
            name: i.name,
            price_cents: i.price_cents,
            qty: i.qty,
          })),
          created_at: op.createdAt,
        });
      } else if (op.operationType === "EDIT_ORDER") {
        const payload = op.payload as {
          orderId: string;
          items: EditOrderItemPayload[];
          notes?: string | null;
        };
        const realId = orderIdMapping.get(payload.orderId) || payload.orderId;
        const existing = queuedOrdersMap.get(realId);
        if (existing) {
          existing.items = payload.items.map((i) => ({
            id: i.id || i.menu_item_id || undefined,
            menu_item_id: i.menu_item_id,
            name: i.name,
            price_cents: i.price_cents,
            qty: i.qty,
            note: i.note,
          }));
          existing.total_cents = payload.items.reduce(
            (sum, it) => sum + it.price_cents * it.qty,
            0
          );
          if (payload.notes !== undefined) existing.note = payload.notes;
          existing.syncState = syncState;
        }
      } else if (op.operationType === "CANCEL_ORDER") {
        const payload = op.payload as { orderId: string };
        const realId = orderIdMapping.get(payload.orderId) || payload.orderId;
        const existing = queuedOrdersMap.get(realId);
        if (existing) {
          existing.status = "cancelled";
          existing.syncState = syncState;
        }
      } else if (op.operationType === "UPDATE_ORDER_STATUS") {
        const payload = op.payload as { orderId: string; nextStatus: string };
        const realId = orderIdMapping.get(payload.orderId) || payload.orderId;
        const existing = queuedOrdersMap.get(realId);
        if (existing) {
          existing.status = payload.nextStatus;
          existing.syncState = syncState;
        }
      }
    }

    // Reconcile with Supabase PostgreSQL: remove operations whose order already exists in PostgreSQL orders table
    const queuedOpsList = Array.from(queuedOrdersMap.values());
    if (allOps.length > 0) {
      try {
        const payloadIds = allOps.map((op) => (op.payload as any)?.id || (op.payload as any)?.orderId).filter(Boolean);
        const diningSessionIds = allOps.map((op) => (op.payload as any)?.dining_session_id).filter(Boolean);
        const tableIds = allOps.map((op) => (op.payload as any)?.table_id).filter(Boolean);

        const { data: dbOrders } = await supabase
          .from("orders")
          .select("id, dining_session_id, table_id, total_cents")
          .or(
            [
              payloadIds.length > 0 ? `id.in.(${payloadIds.join(",")})` : "",
              diningSessionIds.length > 0 ? `dining_session_id.in.(${diningSessionIds.join(",")})` : "",
              tableIds.length > 0 ? `table_id.in.(${tableIds.join(",")})` : "",
            ]
              .filter(Boolean)
              .join(",")
          );

        const dbIdSet = new Set((dbOrders || []).map((o) => o.id));
        const dbSessionSet = new Set((dbOrders || []).map((o) => o.dining_session_id).filter(Boolean));

        for (const op of allOps) {
          const payloadId = (op.payload as any)?.id || (op.payload as any)?.orderId;
          const realId = orderIdMapping.get(payloadId) || payloadId;
          const diningSessId = (op.payload as any)?.dining_session_id;

          const existsById = realId && dbIdSet.has(realId);
          const existsBySession = diningSessId && dbSessionSet.has(diningSessId);
          const isFailedStale = op.status === "Failed" && (existsById || existsBySession);

          if (existsById || existsBySession || isFailedStale) {
            if (realId) queuedOrdersMap.delete(realId);
            await removeOperation(op.operationId);
            console.log(`[getQueuedOfflineOrders] Reconciled & removed stale IndexedDB operation ${op.operationId} (realId: ${realId})`);
          }
        }
      } catch (errDb) {
        console.warn("[getQueuedOfflineOrders] DB reconciliation warning:", errDb);
      }
    }

    return Array.from(queuedOrdersMap.values());
  }
}

export const OrderService = new OrderServiceClass();
