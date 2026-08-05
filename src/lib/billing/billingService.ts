/**
 * Sprint 9.2.3.3 — Offline Billing & Receipt Printing Service
 * 
 * Manages bill generation, tax calculations, receipt printing, and offline bill lifecycle.
 * Routes all billing actions through the Operations Engine (OperationExecutor).
 */

import { generateUUID } from "@/lib/uuid";
import {
  OperationExecutor,
  SyncManager,
  NetworkManager,
  getAllOperations,
  type Operation,
} from "@/lib/offline";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";
import { renderReceiptText } from "@/lib/printing/receiptRenderer";
import { getReceiptSettings } from "./receiptSettings";

export type BillStatus = 'Draft' | 'Finalized' | 'Printed' | 'Paid' | 'Voided';

export interface BillItemPayload {
  id?: string;
  name: string;
  price: number; // in main currency unit (e.g. INR)
  qty: number;
}

export interface CreateBillPayload {
  billId?: string;
  billNumber?: string;
  orderId: string;
  orderNumber?: number | string;
  diningSessionId?: string | null;
  tableId?: string | null;
  tableLabel: string;
  items: BillItemPayload[];
  discountPct?: number;
  taxRatePct?: number; // Defaults to 5 (5% GST)
  cashierName?: string;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO";
  externalOrderRef?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  cafeName?: string;
  address?: string;
  phone?: string;
  cafeId?: string;
}

export interface BillRecord {
  billId: string;
  billNumber: string;
  orderId: string;
  orderNumber?: number | string;
  diningSessionId?: string | null;
  tableId?: string | null;
  tableLabel: string;
  subtotal: number;
  tax: number;
  discountPct: number;
  discountAmt: number;
  netTotal: number;
  status: BillStatus;
  paymentStatus: 'unpaid' | 'paid' | 'voided';
  items: BillItemPayload[];
  cashierName?: string;
  timestamp: string;
  createdAt: string;
  syncState: 'Pending Sync' | 'Syncing' | 'Synced' | 'Sync Failed';
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO";
  externalOrderRef?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  cafeName?: string;
  address?: string;
  phone?: string;
  cafeId?: string;
}

export const billsMap = new Map<string, BillRecord>();

const BILL_COUNTER_KEY = "ORDERRAIL_BILL_COUNTER";

function loadPersistedBillCounter(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(BILL_COUNTER_KEY);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 1000) return val;
      }
    }
  } catch (e) {
    console.warn("[BillingService] Failed to load persisted bill counter:", e);
  }
  return 1000;
}

function savePersistedBillCounter(counter: number): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(BILL_COUNTER_KEY, counter.toString());
    }
  } catch (e) {
    console.warn("[BillingService] Failed to save persisted bill counter:", e);
  }
}

let billCounter = loadPersistedBillCounter();

export class BillingServiceClass {
  private handlersRegistered = false;

  constructor() {
    this.initHandlers();
  }

  public initHandlers(): void {
    if (this.handlersRegistered) return;
    this.handlersRegistered = true;

    // Operation 1: CREATE_BILL
    OperationExecutor.registerHandler("CREATE_BILL", async (payload: BillRecord) => {
      billsMap.set(payload.billId, {
        ...payload,
        syncState: "Synced",
      });
      return { billId: payload.billId, status: payload.status };
    });

    // Operation 2: PRINT_BILL
    OperationExecutor.registerHandler("PRINT_BILL", async (payload: BillRecord) => {
      const existing = billsMap.get(payload.billId) || payload;
      const settings = getReceiptSettings(existing.cafeId);

      let fullAddr = existing.address;
      if (settings.showPhone && existing.phone) {
        fullAddr = fullAddr ? `${fullAddr} | Ph: ${existing.phone}` : `Ph: ${existing.phone}`;
      }

      const printRes = await PrinterAdapter.printReceipt({
        billId: existing.billId,
        billNumber: existing.billNumber,
        orderId: existing.orderId,
        orderNumber: existing.orderNumber,
        tableLabel: existing.tableLabel,
        cashierName: existing.cashierName,
        timestamp: existing.timestamp,
        items: existing.items,
        subtotal: existing.subtotal,
        tax: existing.tax,
        discountPct: existing.discountPct,
        discountAmt: existing.discountAmt,
        netTotal: existing.netTotal,
        paymentStatus: existing.paymentStatus,
        isReprint: false,
        customerName: existing.customerName,
        customerPhone: existing.customerPhone,
        orderSource: existing.orderSource,
        externalOrderRef: existing.externalOrderRef,
        cafeName: existing.cafeName,
        address: settings.showAddress ? fullAddr : undefined,
        gstin: settings.showGst ? (settings.gstNumber || undefined) : undefined,
        cafeId: existing.cafeId,
      } as any);
      return { billId: existing.billId, status: "Printed", result: printRes };
    });

    // Operation 3: REPRINT_BILL
    OperationExecutor.registerHandler("REPRINT_BILL", async (payload: { billId: string }) => {
      const existing = billsMap.get(payload.billId);
      if (!existing) {
        throw new Error(`Bill ${payload.billId} not found for reprint`);
      }
      const settings = getReceiptSettings(existing.cafeId);

      let fullAddr = existing.address;
      if (settings.showPhone && existing.phone) {
        fullAddr = fullAddr ? `${fullAddr} | Ph: ${existing.phone}` : `Ph: ${existing.phone}`;
      }

      const printRes = await PrinterAdapter.printReceipt({
        ...existing,
        cafeName: existing.cafeName,
        address: settings.showAddress ? fullAddr : undefined,
        gstin: settings.showGst ? (settings.gstNumber || undefined) : undefined,
        isReprint: true,
        cafeId: existing.cafeId,
      } as any);
      return { billId: existing.billId, status: "Reprinted", result: printRes };
    });

    // Operation 4: VOID_BILL
    OperationExecutor.registerHandler("VOID_BILL", async (payload: { billId: string; reason?: string }) => {
      const existing = billsMap.get(payload.billId);
      if (existing) {
        existing.status = "Voided";
        existing.paymentStatus = "voided";
        existing.syncState = "Synced";
        billsMap.set(payload.billId, existing);
      }
      return { success: true, billId: payload.billId };
    });
  }

  /**
   * Calculate totals (subtotal, GST tax, discount, netTotal)
   */
  public calculateBillTotals(
    items: BillItemPayload[],
    discountPct: number = 0,
    taxRatePct: number = 5
  ) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discountAmt = Math.round((subtotal * discountPct) / 100 * 100) / 100;
    const taxableAmount = Math.max(0, subtotal - discountAmt);
    const tax = Math.round((taxableAmount * taxRatePct) / 100 * 100) / 100;
    const netTotal = Math.round((taxableAmount + tax) * 100) / 100;

    return { subtotal, discountAmt, tax, netTotal };
  }

  /**
   * Create & finalize a new bill via Operations Engine (or reuse existing bill for same order)
   */
  public async createBill(
    payload: CreateBillPayload,
    options?: { forceQueue?: boolean }
  ): Promise<{ bill: BillRecord; queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const targetBillId = payload.billId || `bill-${payload.orderId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const existingBill = billsMap.get(targetBillId) || Array.from(billsMap.values()).find((b) => b.orderId === payload.orderId);

    if (existingBill) {
      return {
        bill: existingBill,
        queued: false,
        status: "Completed",
      };
    }

    billCounter++;
    savePersistedBillCounter(billCounter);

    const billId = targetBillId;
    const billNumber = payload.billNumber || `B-${billCounter}`;
    const timestamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const { subtotal, discountAmt, tax, netTotal } = this.calculateBillTotals(
      payload.items,
      payload.discountPct || 0,
      payload.taxRatePct ?? 5
    );

    const billRecord: BillRecord = {
      billId,
      billNumber,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      diningSessionId: payload.diningSessionId,
      tableId: payload.tableId,
      tableLabel: payload.tableLabel,
      items: payload.items,
      subtotal,
      tax,
      discountPct: payload.discountPct || 0,
      discountAmt,
      netTotal,
      status: "Finalized",
      paymentStatus: "unpaid",
      cashierName: "Counter",
      timestamp,
      createdAt: new Date().toISOString(),
      syncState: "Pending Sync",
      orderSource: payload.orderSource || "DINE_IN",
      externalOrderRef: payload.externalOrderRef || null,
      customerName: payload.customerName || null,
      customerPhone: payload.customerPhone || null,
      cafeName: payload.cafeName,
      address: payload.address,
      phone: payload.phone,
      cafeId: payload.cafeId,
    };

    // Store in local memory map immediately for UI reactivity
    billsMap.set(billId, billRecord);

    const res = await OperationExecutor.dispatch("CREATE_BILL", billRecord, {
      idempotencyKey: `create_bill_${billId}`,
      forceQueue: options?.forceQueue,
    });

    billRecord.syncState = res.queued ? "Pending Sync" : "Synced";

    return {
      bill: billRecord,
      queued: res.queued,
      status: res.status,
    };
  }

  /**
   * Print bill receipt via Operations Engine
   */
  public async printBill(
    billId: string,
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const bill = billsMap.get(billId);
    if (!bill) {
      throw new Error(`Bill ID "${billId}" not found.`);
    }

    const res = await OperationExecutor.dispatch("PRINT_BILL", bill, {
      idempotencyKey: `print_bill_${billId}`,
      forceQueue: options?.forceQueue,
    });

    if (!res.queued) {
      bill.status = "Printed";
      bill.syncState = "Synced";
    } else {
      bill.syncState = "Pending Sync";
    }

    return { queued: res.queued, status: res.status };
  }

  /**
   * Reprint bill receipt via Operations Engine
   */
  public async reprintBill(
    billId: string,
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const bill = billsMap.get(billId);
    if (!bill) {
      throw new Error(`Bill ID "${billId}" not found.`);
    }

    const res = await OperationExecutor.dispatch("REPRINT_BILL", bill, {
      idempotencyKey: `reprint_bill_${billId}_${Date.now()}`,
      forceQueue: options?.forceQueue,
    });

    return { queued: res.queued, status: res.status };
  }

  /**
   * Void a bill via Operations Engine
   */
  public async voidBill(
    billId: string,
    reason?: string,
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const bill = billsMap.get(billId);
    if (bill) {
      bill.status = "Voided";
      bill.paymentStatus = "voided";
    }

    const res = await OperationExecutor.dispatch(
      "VOID_BILL",
      { billId, reason },
      {
        idempotencyKey: `void_bill_${billId}_${Date.now()}`,
        forceQueue: options?.forceQueue,
      }
    );

    return { queued: res.queued, status: res.status };
  }

  /**
   * Get bill by ID
   */
  public getBill(billId: string): BillRecord | undefined {
    return billsMap.get(billId);
  }

  /**
   * Get bill by Order ID
   */
  public getBillByOrderId(orderId: string): BillRecord | undefined {
    return Array.from(billsMap.values()).find((b) => b.orderId === orderId);
  }

  /**
   * Fetch all queued/pending bills merged from IndexedDB
   */
  public async getQueuedBills(): Promise<BillRecord[]> {
    const allOps = await getAllOperations();
    const queuedBillsMap = new Map<string, BillRecord>();

    for (const op of allOps) {
      if (op.operationType === "CREATE_BILL") {
        const payload = op.payload as BillRecord;
        const syncState: BillRecord["syncState"] =
          op.status === "Queued"
            ? "Pending Sync"
            : op.status === "Running"
            ? "Syncing"
            : op.status === "Completed"
            ? "Synced"
            : "Sync Failed";

        queuedBillsMap.set(payload.billId, {
          ...payload,
          syncState,
        });
      }
    }

    return Array.from(queuedBillsMap.values());
  }
}

export const BillingService = new BillingServiceClass();
