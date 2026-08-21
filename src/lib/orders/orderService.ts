/**
 * Sprint 9.2.3.1 & 9.2.3.2 / Milestone 1B & 1C — Offline Order Management & Canonical KOT Printing Integration
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
  recordInitialKotFiredInDb,
  recordKotReprintInDb,
  type CreateOrderPayload,
  type EditOrderItemPayload,
  type EditOrderAtomicResult,
  type CancelOrderAtomicResult,
} from "./repository";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";
import {
  type KotRenderPayload,
  type KotAmendmentRenderPayload,
  type KotCancelRenderPayload,
} from "@/lib/printing/kotRenderer";
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
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO" | string;
  externalOrderRef?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
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
        updatedBy?: "customer" | "staff" | "owner" | "counter";
        guestSessionId?: string | null;
        sessionId?: string | null;
        expectedVersion?: number | null;
      }) => {
        const realOrderId = orderIdMapping.get(params.orderId) || params.orderId;
        const res = await editOrderInDb({ ...params, orderId: realOrderId });
        return { success: true, result: res };
      }
    );

    // Handler 3: CANCEL_ORDER
    OperationExecutor.registerHandler(
      "CANCEL_ORDER",
      async (params: {
        orderId: string;
        updatedBy?: "customer" | "staff" | "owner" | "counter";
        guestSessionId?: string | null;
        reason?: string;
      }) => {
        const realOrderId = orderIdMapping.get(params.orderId) || params.orderId;
        const res = await cancelOrderInDb(realOrderId, params.updatedBy, params.guestSessionId, params.reason);
        return { success: true, result: res };
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

    // Handler 6: PRINT_AMENDMENT_KOT
    OperationExecutor.registerHandler("PRINT_AMENDMENT_KOT", async (payload: KotAmendmentRenderPayload) => {
      const realOrderId = orderIdMapping.get(payload.orderId) || payload.orderId;
      const finalPayload = { ...payload, orderId: realOrderId };
      const res = await PrinterAdapter.printAmendmentKot(finalPayload as any);
      return res;
    });

    // Handler 7: PRINT_CANCEL_KOT
    OperationExecutor.registerHandler("PRINT_CANCEL_KOT", async (payload: KotCancelRenderPayload) => {
      const realOrderId = orderIdMapping.get(payload.orderId) || payload.orderId;
      const finalPayload = { ...payload, orderId: realOrderId };
      const res = await PrinterAdapter.printCancelKot(finalPayload as any);
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
      updatedBy?: "customer" | "staff" | "owner" | "counter";
      guestSessionId?: string | null;
      sessionId?: string | null;
      expectedVersion?: number | null;
    },
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"]; result?: EditOrderAtomicResult }> {
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
    return { queued: res.queued, status: res.status, result: res.result?.result };
  }

  /**
   * Dispatch Order Cancellation through Operations Engine
   */
  public async cancelOrder(
    orderId: string,
    updatedBy: "customer" | "staff" | "owner" | "counter" = "staff",
    guestSessionId?: string | null,
    reason?: string,
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"]; result?: CancelOrderAtomicResult }> {
    this.initHandlers();

    const realOrderId = orderIdMapping.get(orderId) || orderId;
    const paidBill = Array.from(billsMap.values()).find((b) => b.orderId === realOrderId && b.paymentStatus === "paid");
    if (paidBill) {
      throw new Error(`Order ${realOrderId} is linked to a paid bill (${paidBill.billNumber}) and is immutable.`);
    }

    const res = await OperationExecutor.dispatch(
      "CANCEL_ORDER",
      { orderId: realOrderId, updatedBy, guestSessionId, reason },
      {
        idempotencyKey: `cancel_order_${realOrderId}`,
        forceQueue: options?.forceQueue,
      }
    );
    return { queued: res.queued, status: res.status, result: res.result?.result };
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
   * Dispatch Amendment KOT Print operation through Operations Engine
   */
  public async printAmendmentKot(
    payload: KotAmendmentRenderPayload,
    options?: { forceQueue?: boolean }
  ): Promise<{ operationId: string; queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const realOrderId = orderIdMapping.get(payload.orderId) || payload.orderId;
    const res = await OperationExecutor.dispatch(
      "PRINT_AMENDMENT_KOT",
      { ...payload, orderId: realOrderId },
      {
        idempotencyKey: `print_amendment_kot_${realOrderId}_${payload.revision}_${Date.now()}`,
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
   * Dispatch Cancellation KOT Print operation through Operations Engine
   */
  public async printCancelKot(
    payload: KotCancelRenderPayload,
    options?: { forceQueue?: boolean }
  ): Promise<{ operationId: string; queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const realOrderId = orderIdMapping.get(payload.orderId) || payload.orderId;
    const res = await OperationExecutor.dispatch(
      "PRINT_CANCEL_KOT",
      { ...payload, orderId: realOrderId },
      {
        idempotencyKey: `print_cancel_kot_${realOrderId}_${Date.now()}`,
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
   * Dispatch Initial KOT with authoritative DB record boundary
   */
  public async fireInitialKot(
    orderId: string,
    payload: PrintKotOperationPayload,
    actor: "counter" | "staff" | "owner" = "counter",
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"]; kot_fired: boolean }> {
    this.initHandlers();

    // 1. Dispatch print operation through existing pipeline
    const printRes = await this.printKot(payload, options);

    // 2. Only record initial KOT fired if print dispatch succeeded online
    let kotFired = false;
    if (!printRes.queued && printRes.status?.toLowerCase() === "completed") {
      try {
        await recordInitialKotFiredInDb(orderId, actor);
        kotFired = true;
      } catch (dbErr) {
        console.warn("[fireInitialKot] Warning recording initial KOT fired in DB:", dbErr);
      }
    }

    return {
      queued: printRes.queued,
      status: printRes.status,
      kot_fired: kotFired,
    };
  }

  /**
   * Single Operator-Facing "Reprint KOT" routing logic
   */
  public async reprintKot(
    orderId: string,
    context: {
      tableLabel: string;
      actor?: "counter" | "staff" | "owner";
      orderSnapshot?: any;
    },
    options?: { forceQueue?: boolean }
  ): Promise<{
    type: "INITIAL_KOT" | "CANCEL_KOT" | "AMENDMENT_KOT" | "STANDARD_REPRINT";
    kotNumber: string | number;
    queued: boolean;
    status: Operation["status"];
  }> {
    this.initHandlers();
    const actor = context.actor || "counter";
    const realOrderId = orderIdMapping.get(orderId) || orderId;

    // 1. Fetch live order details if not fully provided
    let order = context.orderSnapshot;
    if (!order || !order.status || order.kot_fired_at === undefined) {
      const { data: dbOrder } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", realOrderId)
        .maybeSingle();
      if (dbOrder) {
        order = dbOrder;
      }
    }

    if (!order) {
      throw new Error(`Order not found: ${realOrderId}`);
    }

    const orderNum = order.order_number || order.orderNumber || 101;
    const items = (order.order_items || order.items || []).map((i: any) => ({
      id: i.id,
      name: i.name,
      price: i.price || (i.price_cents ? i.price_cents / 100 : 0),
      qty: i.qty,
      notes: i.note || i.notes,
    }));

    // Case A: Cancelled order -> Cancel KOT
    if (order.status === "cancelled") {
      const cancelPayload: KotCancelRenderPayload = {
        orderId: realOrderId,
        orderNumber: orderNum,
        kotNumber: orderNum,
        tableLabel: context.tableLabel,
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
        cancellationReason: order.note || "Order cancelled",
        cancelledItems: items,
      };
      const res = await this.printCancelKot(cancelPayload, options);
      return {
        type: "CANCEL_KOT",
        kotNumber: orderNum,
        queued: res.queued,
        status: res.status,
      };
    }

    // Case B: Initial KOT was never fired -> Trigger initial KOT fire
    if (!order.kot_fired_at) {
      const initialPayload: PrintKotOperationPayload = {
        orderId: realOrderId,
        orderNumber: orderNum,
        kotNumber: orderNum,
        tableLabel: context.tableLabel,
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
        items,
      };
      const res = await this.fireInitialKot(realOrderId, initialPayload, actor, options);
      return {
        type: "INITIAL_KOT",
        kotNumber: orderNum,
        queued: res.queued,
        status: res.status,
      };
    }

    // Case C: Active order modified post-KOT (version > initial_kot_version) -> Latest Amendment KOT
    const initialVersion = order.initial_kot_version || 1;
    const currentVersion = order.version || 1;
    if (currentVersion > initialVersion) {
      const revision = currentVersion - initialVersion;
      
      let deltaAdded: any[] = [];
      let deltaRemoved: any[] = [];
      let deltaModified: any[] = [];
      let foundEventDelta = false;

      try {
        const { data: latestEvent } = await supabase
          .from("order_events")
          .select("metadata")
          .eq("order_id", realOrderId)
          .like("event_type", "order_modified_%")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestEvent?.metadata?.delta_items) {
          const rawDelta = latestEvent.metadata.delta_items;
          deltaAdded = rawDelta.added || [];
          deltaRemoved = rawDelta.removed || [];
          deltaModified = rawDelta.modified || [];
          foundEventDelta = true;
        }
      } catch (evtErr) {
        console.warn("[reprintKot] Could not fetch delta from order_events, falling back to previous_items:", evtErr);
      }

      if (!foundEventDelta) {
        // Fallback: compute delta from previous_items vs current order items
        const prevItems: any[] = typeof order.previous_items === "string" 
          ? JSON.parse(order.previous_items) 
          : (order.previous_items || []);

        const prevMap = new Map<string, any>(prevItems.map((p: any) => [p.name || p.id, p]));
        const currMap = new Map<string, any>(items.map((c: any) => [c.name || c.id, c]));

        for (const curr of items) {
          const prev = prevMap.get(curr.name || curr.id);
          if (!prev) {
            deltaAdded.push(curr);
          } else if (prev.qty !== curr.qty || prev.note !== curr.notes) {
            deltaModified.push({
              ...curr,
              oldQty: prev.qty,
              newQty: curr.qty,
              oldNotes: prev.note || prev.notes,
              newNotes: curr.notes,
            });
          }
        }

        for (const prev of prevItems) {
          if (!currMap.has(prev.name || prev.id)) {
            deltaRemoved.push({
              id: prev.id,
              name: prev.name,
              price: prev.price_cents ? prev.price_cents / 100 : (prev.price || 0),
              qty: prev.qty,
              notes: prev.note || prev.notes,
            });
          }
        }
      }

      const amendmentPayload: KotAmendmentRenderPayload = {
        orderId: realOrderId,
        orderNumber: orderNum,
        kotNumber: `${orderNum}-M${revision}`,
        revision,
        tableLabel: context.tableLabel,
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
        delta: {
          added: deltaAdded,
          removed: deltaRemoved,
          modified: deltaModified,
        },
      };

      const res = await this.printAmendmentKot(amendmentPayload, options);
      return {
        type: "AMENDMENT_KOT",
        kotNumber: `${orderNum}-M${revision}`,
        queued: res.queued,
        status: res.status,
      };
    }

    // Case D: Active order not modified after KOT -> Full Standard Reprint (R1, R2, ...)
    let reprintCode = "R1";
    try {
      const allocRes = await recordKotReprintInDb(realOrderId, actor);
      reprintCode = allocRes.reprint_code;
    } catch (allocErr) {
      console.warn("[reprintKot] Could not allocate online reprint number, using offline fallback:", allocErr);
      reprintCode = "R";
    }

    const reprintPayload: PrintKotOperationPayload = {
      orderId: realOrderId,
      orderNumber: orderNum,
      kotNumber: `${orderNum}-${reprintCode}`,
      tableLabel: context.tableLabel,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
      items,
      isReprint: true,
    };

    const res = await this.printKot(reprintPayload, options);
    return {
      type: "STANDARD_REPRINT",
      kotNumber: `${orderNum}-${reprintCode}`,
      queued: res.queued,
      status: res.status,
    };
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
