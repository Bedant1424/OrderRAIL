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
import { getTaxSettings, calculateTaxAndTotals, DEFAULT_TAX_SETTINGS, type TaxSettings } from "./taxSettings";

export type BillStatus = 'Draft' | 'Finalized' | 'Printed' | 'Paid' | 'Voided';

export interface BillItemPayload {
  id?: string;
  name: string;
  price: number; // in main currency unit (e.g. INR)
  qty: number;
  notes?: string;
  note?: string;
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
  taxRatePct?: number;
  taxSettings?: TaxSettings;
  cashierName?: string;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO";
  externalOrderRef?: string | null;
  customerId?: string | null;
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
  cgst?: number;
  sgst?: number;
  serviceCharge?: number;
  roundOff?: number;
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
  customerId?: string | null;
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
      const settings = getReceiptSettings(existing.cafeId, (existing as any).cafeRecord);

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
        cgst: existing.cgst,
        sgst: existing.sgst,
        serviceCharge: existing.serviceCharge,
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
        address: settings.showAddress ? existing.address : undefined,
        phone: settings.showPhone ? existing.phone : undefined,
        showAddress: settings.showAddress,
        showPhone: settings.showPhone,
        showGst: settings.showGst,
        showInvoiceNum: settings.showInvoiceNum,
        receiptHeader: settings.receiptHeader,
        thankYouMessage: settings.thankYouMessage,
        footerInfo: settings.footerInfo,
        gstin: settings.showGst ? (settings.gstNumber || undefined) : undefined,
        cafeId: existing.cafeId,
        cafeRecord: (existing as any).cafeRecord,
      } as any);
      return { billId: existing.billId, status: "Printed", result: printRes };
    });

    // Operation 3: REPRINT_BILL
    OperationExecutor.registerHandler("REPRINT_BILL", async (payload: { billId: string }) => {
      const existing = billsMap.get(payload.billId);
      if (!existing) {
        throw new Error(`Bill ${payload.billId} not found for reprint`);
      }
      const settings = getReceiptSettings(existing.cafeId, (existing as any).cafeRecord);

      const printRes = await PrinterAdapter.printReceipt({
        ...existing,
        cafeName: existing.cafeName,
        address: settings.showAddress ? existing.address : undefined,
        phone: settings.showPhone ? existing.phone : undefined,
        showAddress: settings.showAddress,
        showPhone: settings.showPhone,
        showGst: settings.showGst,
        showInvoiceNum: settings.showInvoiceNum,
        receiptHeader: settings.receiptHeader,
        thankYouMessage: settings.thankYouMessage,
        footerInfo: settings.footerInfo,
        gstin: settings.showGst ? (settings.gstNumber || undefined) : undefined,
        isReprint: true,
        cafeId: existing.cafeId,
        cafeRecord: (existing as any).cafeRecord,
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
   * Calculate totals (subtotal, GST tax, service charge, discount, netTotal) using canonical TaxSettings
   */
  public calculateBillTotals(
    items: BillItemPayload[],
    discountPct: number = 0,
    taxRateOrSettings?: number | TaxSettings,
    cafeId?: string
  ) {
    const rawSubtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const subtotalCents = Math.round(rawSubtotal * 100);
    const discountAmt = Math.round((rawSubtotal * discountPct) / 100 * 100) / 100;
    const discountCents = Math.round(discountAmt * 100);
    const taxableBaseCents = Math.max(0, subtotalCents - discountCents);

    let settings: TaxSettings;
    if (taxRateOrSettings && typeof taxRateOrSettings === "object") {
      settings = taxRateOrSettings;
    } else if (typeof taxRateOrSettings === "number") {
      settings = {
        ...DEFAULT_TAX_SETTINGS,
        gstEnabled: taxRateOrSettings > 0,
        gstPercentage: taxRateOrSettings,
      };
    } else {
      settings = getTaxSettings(cafeId);
    }

    const calc = calculateTaxAndTotals(taxableBaseCents, settings);

    return {
      subtotal: rawSubtotal,
      discountAmt,
      tax: calc.totalGstCents / 100,
      cgst: calc.cgstCents / 100,
      sgst: calc.sgstCents / 100,
      serviceCharge: calc.serviceChargeCents / 100,
      roundOff: calc.roundingAdjustmentCents / 100,
      netTotal: calc.grandTotalCents / 100,
    };
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

    const effectiveSettings = payload.taxSettings || (typeof payload.taxRatePct === 'number'
      ? { ...DEFAULT_TAX_SETTINGS, gstEnabled: payload.taxRatePct > 0, gstPercentage: payload.taxRatePct }
      : getTaxSettings(payload.cafeId));

    const { subtotal, discountAmt, tax, cgst, sgst, serviceCharge, roundOff, netTotal } =
      this.calculateBillTotals(
        payload.items,
        payload.discountPct || 0,
        effectiveSettings,
        payload.cafeId
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
      cgst,
      sgst,
      serviceCharge,
      roundOff,
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
      cafeRecord: (payload as any).cafeRecord,
    } as any;

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
   * Register a historical persisted BillWithItems into local billsMap for thermal printing/reprinting.
   * Does NOT write to database, create orders, or modify payment/customer state.
   */
  public registerHistoricalBill(
    bill: {
      id: string;
      bill_number: number;
      cafe_id: string;
      session_id?: string;
      table_id?: string | null;
      cashier_id?: string | null;
      customer_name?: string | null;
      customer_phone?: string | null;
      order_type?: string;
      payment_status?: string;
      payment_method?: string;
      subtotal?: number;
      discount?: number;
      service_charge?: number;
      cgst?: number;
      sgst?: number;
      round_off?: number;
      grand_total?: number;
      total_items?: number;
      created_at?: string;
      items?: any[];
    },
    cafeRecord?: any
  ): BillRecord {
    this.initHandlers();

    const billId = bill.id;
    const billNumber = `B-${bill.bill_number}`;
    const statusUpper = (bill.payment_status || "").toUpperCase();
    const isPaid = statusUpper === "PAID";
    const isCancelled = statusUpper === "CANCELLED";

    const items: BillItemPayload[] = (bill.items || []).map((it: any) => ({
      id: it.id || it.menu_item_id || undefined,
      name: it.item_name || it.name || "Item",
      price: typeof it.unit_price === "number" ? it.unit_price : (it.priceCents || 0) / 100,
      qty: it.quantity || it.qty || 1,
      notes: it.special_instructions || it.note || undefined,
    }));

    const subtotal = typeof bill.subtotal === "number" ? bill.subtotal : (bill as any).subtotalCents ? (bill as any).subtotalCents / 100 : 0;
    const cgst = typeof bill.cgst === "number" ? bill.cgst : (bill as any).cgstCents ? (bill as any).cgstCents / 100 : 0;
    const sgst = typeof bill.sgst === "number" ? bill.sgst : (bill as any).sgstCents ? (bill as any).sgstCents / 100 : 0;
    const serviceCharge = typeof bill.service_charge === "number" ? bill.service_charge : (bill as any).serviceChargeCents ? (bill as any).serviceChargeCents / 100 : 0;
    const roundOff = typeof bill.round_off === "number" ? bill.round_off : (bill as any).roundingCents ? (bill as any).roundingCents / 100 : 0;
    const discountAmt = typeof bill.discount === "number" ? bill.discount : (bill as any).discountCents ? (bill as any).discountCents / 100 : 0;
    const netTotal = typeof bill.grand_total === "number" ? bill.grand_total : (bill as any).grandTotalCents ? (bill as any).grandTotalCents / 100 : 0;

    const billRecord: BillRecord = {
      billId,
      billNumber,
      orderId: bill.session_id || bill.id,
      orderNumber: bill.bill_number,
      diningSessionId: bill.session_id || null,
      tableId: bill.table_id || null,
      tableLabel: bill.table_id || (bill.order_type === "TAKEAWAY" ? "Takeaway" : "Dine-In Table"),
      items,
      subtotal,
      tax: cgst + sgst,
      cgst,
      sgst,
      serviceCharge,
      roundOff,
      discountPct: 0,
      discountAmt,
      netTotal,
      status: isCancelled ? "Voided" : isPaid ? "Paid" : "Finalized",
      paymentStatus: isCancelled ? "voided" : isPaid ? "paid" : "unpaid",
      cashierName: bill.cashier_id || "Owner Console",
      timestamp: new Date(bill.created_at || Date.now()).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      createdAt: bill.created_at || new Date().toISOString(),
      syncState: "Synced",
      orderSource: (bill.order_type === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN") as any,
      customerName: bill.customer_name?.trim() || null,
      customerPhone: bill.customer_phone?.trim() || null,
      cafeId: bill.cafe_id,
      cafeRecord: cafeRecord || null,
    };

    billsMap.set(billId, billRecord);
    return billRecord;
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
