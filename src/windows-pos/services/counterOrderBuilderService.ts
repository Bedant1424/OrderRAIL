import { createOrderInDb, type CreateOrderPayload } from "@/lib/orders/repository";
import { NetworkManager } from "@/lib/offline/networkManager";
import { OperationExecutor } from "@/lib/offline/operationExecutor";
import { generateCounterKot, type GeneratedCounterKot } from "./counterKotService";
import { type CounterPrinter, type PrintResult, defaultCounterPrinter, getActiveCounterPrinter } from "./printer/counterPrinter";
import type { OrderSource, CounterOrder, OrderSyncStatus } from "../types/counterTypes";

export interface CounterCartItem {
  id: string;
  menuItemId?: string | null;
  name: string;
  priceCents: number;
  qty: number;
  note?: string | null;
}

export interface BuildCounterOrderParams {
  cafeId: string;
  orderSource: OrderSource;
  items: CounterCartItem[];
  // DINE_IN specific
  tableId?: string | null;
  diningSessionId?: string | null;
  tableLabel?: string | null;
  // Common / Aggregator / Takeaway details
  customerName?: string | null;
  customerPhone?: string | null;
  externalOrderRef?: string | null;
  orderNote?: string | null;
  status?: "pending" | "preparing";
  printer?: CounterPrinter;
}

export interface CreatedCounterOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: number;
  orderSource: OrderSource;
  tableId: string | null;
  diningSessionId: string | null;
  externalOrderRef: string | null;
  totalCents: number;
  isOffline?: boolean;
  syncStatus?: OrderSyncStatus;
  kot?: GeneratedCounterKot;
  printResult?: PrintResult;
  error?: string;
}

/**
 * Service enforcing channel-aware constraints and orchestrating order creation across all 4 channels:
 * DINE_IN, TAKEAWAY, SWIGGY, ZOMATO
 */
export class CounterOrderBuilderService {
  /**
   * Validates and builds the channel-specific CreateOrderPayload
   */
  public static buildPayload(params: BuildCounterOrderParams): CreateOrderPayload {
    const { orderSource, items, cafeId } = params;

    if (!items || items.length === 0) {
      throw new Error("Cannot submit an empty order. Please add at least one item to the cart.");
    }

    const totalCents = items.reduce((sum, it) => sum + it.priceCents * it.qty, 0);
    const orderItems = items.map((it) => ({
      menu_item_id: it.menuItemId || null,
      name: it.name,
      price_cents: it.priceCents,
      qty: it.qty,
      note: it.note || null,
    }));

    // Channel 1: DINE_IN
    if (orderSource === "DINE_IN") {
      if (!params.tableId || params.tableId === "express" || params.tableId.trim() === "") {
        throw new Error("Dine-In orders require a valid table selection.");
      }

      return {
        id: crypto.randomUUID(),
        cafe_id: cafeId,
        table_id: params.tableId,
        dining_session_id: params.diningSessionId || null,
        order_source: "DINE_IN",
        external_order_ref: null,
        total_cents: totalCents,
        status: params.status || "preparing",
        customer_name: params.customerName || null,
        customer_phone: params.customerPhone || null,
        note: params.orderNote || null,
        items: orderItems,
      };
    }

    // Channels 2, 3, 4: Non-Dine-In channels MUST NOT have table_id or dining_session_id
    let externalRef = params.externalOrderRef?.trim() || null;
    let orderNote = params.orderNote?.trim() || null;

    if (orderSource === "SWIGGY") {
      if (!externalRef) {
        externalRef = params.externalOrderRef || null;
      }
      if (externalRef && !orderNote?.includes(externalRef)) {
        orderNote = orderNote ? `Swiggy Ref: ${externalRef} | ${orderNote}` : `Swiggy Ref: ${externalRef}`;
      }
    } else if (orderSource === "ZOMATO") {
      if (!externalRef) {
        externalRef = params.externalOrderRef || null;
      }
      if (externalRef && !orderNote?.includes(externalRef)) {
        orderNote = orderNote ? `Zomato Ref: ${externalRef} | ${orderNote}` : `Zomato Ref: ${externalRef}`;
      }
    }

    return {
      id: crypto.randomUUID(),
      cafe_id: cafeId,
      table_id: null,
      dining_session_id: null,
      order_source: orderSource,
      external_order_ref: externalRef,
      total_cents: totalCents,
      status: params.status || "preparing",
      customer_name: params.customerName || null,
      customer_phone: params.customerPhone || null,
      note: orderNote,
      items: orderItems,
    };
  }

  /**
   * Submits a channel order, records in PostgreSQL, generates KOT, and dispatches to printer
   */
  public static async submitOrder(
    params: BuildCounterOrderParams,
    cafeName: string = "Cheese Corner"
  ): Promise<CreatedCounterOrderResult> {
    const printer = params.printer || getActiveCounterPrinter();

    let payload: CreateOrderPayload;
    try {
      payload = this.buildPayload(params);
    } catch (validationErr: any) {
      return {
        success: false,
        orderSource: params.orderSource,
        tableId: params.tableId || null,
        diningSessionId: params.diningSessionId || null,
        externalOrderRef: params.externalOrderRef || null,
        totalCents: 0,
        error: validationErr?.message || "Order validation failed",
      };
    }

    // Check if terminal is operating offline
    const isOnline = NetworkManager.isOnline();
    if (!isOnline) {
      return await this.handleOfflineOrderSubmission(payload, params, cafeName, printer);
    }

    try {
      const createdOrder = await createOrderInDb(payload);
      const orderNumber = createdOrder.daily_order_number ?? createdOrder.order_number ?? 1;

      // Determine label for KOT
      let kotLabel = "Takeaway";
      if (payload.order_source === "DINE_IN") {
        kotLabel = params.tableLabel || "Table";
      } else if (payload.order_source === "SWIGGY") {
        kotLabel = payload.external_order_ref ? `Swiggy #${payload.external_order_ref}` : "Swiggy";
      } else if (payload.order_source === "ZOMATO") {
        kotLabel = payload.external_order_ref ? `Zomato #${payload.external_order_ref}` : "Zomato";
      }

      // Generate KOT
      const counterOrderForKot: CounterOrder = {
        id: createdOrder.id,
        orderNumber,
        tableId: createdOrder.table_id || null,
        diningSessionId: createdOrder.dining_session_id || null,
        status: createdOrder.status,
        orderSource: payload.order_source as OrderSource,
        createdAt: createdOrder.created_at,
        totalCents: createdOrder.total_cents,
        customerName: createdOrder.customer_name || null,
        customerPhone: createdOrder.customer_phone || null,
        externalOrderRef: payload.external_order_ref || null,
        note: createdOrder.note || null,
        syncStatus: "SYNCED",
        isOfflineCreated: false,
        items: (createdOrder.order_items || []).map((i) => ({
          id: i.id,
          menuItemId: i.menu_item_id,
          name: i.name,
          priceCents: i.price_cents,
          qty: i.qty,
          note: i.note,
        })),
      };

      const kot = generateCounterKot(counterOrderForKot, kotLabel, cafeName);

      // Print via printer abstraction
      let printResult: PrintResult;
      try {
        printResult = await printer.printRaw(kot.rawBytes, {
          title: "Kitchen Order Ticket",
          orderNumber,
          tableLabel: kotLabel,
        });
      } catch (printErr: any) {
        printResult = {
          status: "FAILED",
          message: printErr?.message || "Printer communication exception",
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        orderId: createdOrder.id,
        orderNumber,
        orderSource: payload.order_source as OrderSource,
        tableId: createdOrder.table_id || null,
        diningSessionId: createdOrder.dining_session_id || null,
        externalOrderRef: payload.external_order_ref || null,
        totalCents: createdOrder.total_cents,
        syncStatus: "SYNCED",
        isOffline: false,
        kot,
        printResult,
      };
    } catch (dbErr: any) {
      const isNetworkError =
        !NetworkManager.isOnline() ||
        dbErr?.message?.toLowerCase().includes("fetch") ||
        dbErr?.message?.toLowerCase().includes("network") ||
        dbErr?.message?.toLowerCase().includes("offline");

      if (isNetworkError) {
        console.warn("[CounterOrderBuilderService] Network error during online submission. Enqueuing for offline sync:", dbErr);
        return await this.handleOfflineOrderSubmission(payload, params, cafeName, printer);
      }

      console.error("[CounterOrderBuilderService] Failed to create order in DB:", dbErr);
      return {
        success: false,
        orderSource: payload.order_source as OrderSource,
        tableId: payload.table_id || null,
        diningSessionId: payload.dining_session_id || null,
        externalOrderRef: payload.external_order_ref || null,
        totalCents: payload.total_cents,
        error: dbErr?.message || "Failed to persist order to database.",
      };
    }
  }

  /**
   * Handles offline order entry: assigns local ID, enqueues to operation queue,
   * generates offline KOT, and marks order as PENDING_SYNC.
   */
  private static async handleOfflineOrderSubmission(
    payload: CreateOrderPayload,
    params: BuildCounterOrderParams,
    cafeName: string,
    printer: CounterPrinter
  ): Promise<CreatedCounterOrderResult> {
    const tempId = payload.id || `temp_counter_ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const orderNumber = Math.floor(1000 + Math.random() * 9000);

    const offlinePayload: CreateOrderPayload = {
      ...payload,
      id: tempId,
    };

    // Dispatch into OperationExecutor / IndexedDB Queue for background sync on reconnect
    await OperationExecutor.dispatch("CREATE_ORDER", offlinePayload, {
      idempotencyKey: `create_order_${tempId}`,
      forceQueue: true,
    });

    // Determine label for KOT
    let kotLabel = "Takeaway";
    if (payload.order_source === "DINE_IN") {
      kotLabel = params.tableLabel || "Table";
    } else if (payload.order_source === "SWIGGY") {
      kotLabel = payload.external_order_ref ? `Swiggy #${payload.external_order_ref}` : "Swiggy";
    } else if (payload.order_source === "ZOMATO") {
      kotLabel = payload.external_order_ref ? `Zomato #${payload.external_order_ref}` : "Zomato";
    }

    const counterOrderForKot: CounterOrder = {
      id: tempId,
      orderNumber,
      tableId: payload.table_id || null,
      diningSessionId: payload.dining_session_id || null,
      status: "preparing",
      orderSource: payload.order_source as OrderSource,
      createdAt: new Date().toISOString(),
      totalCents: payload.total_cents,
      customerName: payload.customer_name || null,
      customerPhone: payload.customer_phone || null,
      externalOrderRef: payload.external_order_ref || null,
      note: payload.note || null,
      syncStatus: "PENDING_SYNC",
      isOfflineCreated: true,
      items: (payload.items || []).map((i) => ({
        id: i.id || crypto.randomUUID(),
        menuItemId: i.menu_item_id,
        name: i.name,
        priceCents: i.price_cents,
        qty: i.qty,
        note: i.note,
      })),
    };

    const kot = generateCounterKot(counterOrderForKot, `${kotLabel} [OFFLINE]`, cafeName);

    let printResult: PrintResult;
    try {
      printResult = await printer.printRaw(kot.rawBytes, {
        title: "Kitchen Order Ticket (Offline)",
        orderNumber,
        tableLabel: `${kotLabel} [OFFLINE]`,
      });
    } catch (printErr: any) {
      printResult = {
        status: "FAILED",
        message: printErr?.message || "Printer communication exception",
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      orderId: tempId,
      orderNumber,
      orderSource: payload.order_source as OrderSource,
      tableId: payload.table_id || null,
      diningSessionId: payload.dining_session_id || null,
      externalOrderRef: payload.external_order_ref || null,
      totalCents: payload.total_cents,
      isOffline: true,
      syncStatus: "PENDING_SYNC",
      kot,
      printResult,
    };
  }
}
