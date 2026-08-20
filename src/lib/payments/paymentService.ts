/**
 * Sprint 9.2.3.4 — Payment Recording, Settlement & Bill Finalization
 * 
 * Manages payment recording, bill locking, settlement tracking, and table completion.
 * Integrates with the Offline Operations Engine (OperationExecutor).
 */

import { generateUUID } from "@/lib/uuid";
import {
  OperationExecutor,
  SyncManager,
  NetworkManager,
  getAllOperations,
  type Operation,
} from "@/lib/offline";
import { BillingService, billsMap, type BillRecord } from "@/lib/billing/billingService";
import { BillRepository } from "@/lib/billing/BillRepository";
import type { PaymentMethod as DbPaymentMethod } from "@/lib/billing/types";
import { updateTableStatusInDb, closeDiningSessionInDb } from "@/lib/tables/tableRepository";

export type PaymentMethod = "cash" | "upi" | "card" | "split";

export interface RecordPaymentPayload {
  paymentId?: string;
  billId: string;
  orderId: string;
  diningSessionId?: string | null;
  tableId?: string | null;
  tableLabel: string;
  paymentMethod: PaymentMethod;
  amount: number; // in currency units
  operatorId?: string;
  timestamp?: string;
  createdAt?: string;
}

export interface SettlementRecord {
  settlementId: string;
  paymentId: string;
  billId: string;
  billNumber: string;
  orderId: string;
  diningSessionId?: string | null;
  tableId?: string | null;
  tableLabel: string;
  paymentMethod: PaymentMethod;
  amount: number;
  operatorId: string;
  timestamp: string;
  createdAt: string;
  status: "settled" | "voided" | "refunded";
  syncState: "Pending Sync" | "Syncing" | "Synced" | "Sync Failed";
}

export const settlementsMap = new Map<string, SettlementRecord>();

export class PaymentServiceClass {
  private handlersRegistered = false;

  constructor() {
    this.initHandlers();
  }

  public initHandlers(): void {
    if (this.handlersRegistered) return;
    this.handlersRegistered = true;

    // Operation 1: RECORD_PAYMENT
    OperationExecutor.registerHandler("RECORD_PAYMENT", async (payload: SettlementRecord) => {
      // 1. Lock bill in local memory
      const bill = billsMap.get(payload.billId);
      if (bill) {
        bill.status = "Paid";
        bill.paymentStatus = "paid";
        bill.syncState = "Synced";
        billsMap.set(bill.billId, bill);
      }

      // 2. Register settlement record
      payload.syncState = "Synced";
      settlementsMap.set(payload.settlementId, payload);

      // 3. Database Updates (if online)
      if (NetworkManager.isOnline()) {
        try {
          // Persist payment status to PostgreSQL via canonical BillRepository
          const pmUpper = (payload.paymentMethod || "CASH").toUpperCase();
          const validPm: DbPaymentMethod = (
            pmUpper.includes("UPI") ? "UPI" :
            pmUpper.includes("CARD") ? "CARD" :
            pmUpper.includes("MIXED") ? "MIXED" : "CASH"
          );
          const paidAt = payload.createdAt || new Date().toISOString();

          let updatedBill = await BillRepository.updatePaymentStatus(payload.billId, 'PAID', validPm, paidAt);

          if (!updatedBill && payload.diningSessionId) {
            const existingBills = await BillRepository.getBillsBySession(payload.diningSessionId);
            if (existingBills.length > 0) {
              updatedBill = await BillRepository.updatePaymentStatus(existingBills[0].id, 'PAID', validPm, paidAt);
            }
          }

          if (payload.diningSessionId) {
            await closeDiningSessionInDb(payload.diningSessionId);
          }
          if (payload.tableId) {
            await updateTableStatusInDb(payload.tableId, "free", null);
          }
        } catch (errDb) {
          console.warn("[PaymentService] Database table/bill payment update warning:", errDb);
        }
      }

      return { settlementId: payload.settlementId, status: "Paid" };
    });

    // Operation 2: VOID_PAYMENT
    OperationExecutor.registerHandler(
      "VOID_PAYMENT",
      async (payload: { paymentId: string; reason?: string }) => {
        const settlement = Array.from(settlementsMap.values()).find(
          (s) => s.paymentId === payload.paymentId
        );
        if (settlement) {
          settlement.status = "voided";
          settlement.syncState = "Synced";

          const bill = billsMap.get(settlement.billId);
          if (bill) {
            bill.status = "Voided";
            bill.paymentStatus = "voided";
          }
        }
        return { success: true, paymentId: payload.paymentId };
      }
    );

    // Operation 3: REFUND_PAYMENT (Architecture Placeholder)
    OperationExecutor.registerHandler(
      "REFUND_PAYMENT",
      async (payload: { paymentId: string; refundAmount: number; reason?: string }) => {
        const settlement = Array.from(settlementsMap.values()).find(
          (s) => s.paymentId === payload.paymentId
        );
        if (settlement) {
          settlement.status = "refunded";
          settlement.syncState = "Synced";
        }
        return { success: true, paymentId: payload.paymentId };
      }
    );
  }

  /**
   * Record a payment and complete the bill lifecycle
   */
  public async recordPayment(
    payload: RecordPaymentPayload,
    options?: { forceQueue?: boolean }
  ): Promise<{ settlement: SettlementRecord; queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    // 1. Validate Bill Exists & Immutability (Idempotency Check across refreshes & PostgreSQL)
    let bill = billsMap.get(payload.billId);
    let existingSettlement = this.getSettlementByBillId(payload.billId);

    if (!bill || bill.paymentStatus !== "paid") {
      try {
        const dbBill = await BillRepository.getBillById(payload.billId);
        if (dbBill && (dbBill.payment_status === 'PAID' || dbBill.payment_status === 'paid')) {
          bill = {
            billId: dbBill.id,
            billNumber: dbBill.bill_number?.toString() || payload.billId,
            orderId: payload.orderId,
            tableLabel: payload.tableLabel,
            subtotal: dbBill.subtotal || payload.amount,
            tax: 0,
            discountPct: 0,
            discountAmt: 0,
            netTotal: dbBill.grand_total || payload.amount,
            status: 'Paid',
            paymentStatus: 'paid',
            items: [],
            timestamp: dbBill.created_at || new Date().toLocaleTimeString(),
            createdAt: dbBill.created_at || new Date().toISOString(),
            syncState: 'Synced',
          };
          billsMap.set(payload.billId, bill);
        }
      } catch (errDb) {
        console.warn("[PaymentService] BillRepository lookup notice:", errDb);
      }
    }

    if (bill && bill.paymentStatus === "paid") {
      console.log(`[PaymentService] Bill ${payload.billId} is already paid. Returning settlement.`);
      const settlement = existingSettlement || {
        settlementId: `set_${payload.billId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
        paymentId: payload.paymentId || `pay_${payload.billId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
        billId: payload.billId,
        billNumber: bill.billNumber,
        orderId: payload.orderId,
        diningSessionId: payload.diningSessionId,
        tableId: payload.tableId,
        tableLabel: payload.tableLabel,
        paymentMethod: payload.paymentMethod,
        amount: payload.amount,
        operatorId: payload.operatorId || "Counter Staff",
        timestamp: payload.timestamp || new Date().toLocaleTimeString("en-IN"),
        createdAt: new Date().toISOString(),
        status: "settled",
        syncState: "Synced",
      };
      settlementsMap.set(settlement.settlementId, settlement);
      return {
        settlement,
        queued: false,
        status: "Completed",
      };
    }

    // 2. Validate Amount
    const expectedAmount = bill ? bill.netTotal : payload.amount;
    if (Math.abs(payload.amount - expectedAmount) > 0.01) {
      console.warn(`[PaymentService] Amount mismatch warning: received ₹${payload.amount}, expected ₹${expectedAmount}`);
    }

    const paymentId = payload.paymentId || `pay_${generateUUID()}`;
    const settlementId = `set_${generateUUID()}`;
    const timestamp =
      payload.timestamp ||
      new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

    const settlement: SettlementRecord = {
      settlementId,
      paymentId,
      billId: payload.billId,
      billNumber: bill ? bill.billNumber : `#B-${payload.billId.substring(0, 5)}`,
      orderId: payload.orderId,
      diningSessionId: payload.diningSessionId,
      tableId: payload.tableId,
      tableLabel: payload.tableLabel,
      paymentMethod: payload.paymentMethod,
      amount: payload.amount,
      operatorId: payload.operatorId || "Counter Staff",
      timestamp,
      createdAt: new Date().toISOString(),
      status: "settled",
      syncState: "Pending Sync",
    };

    // 3. Update local state immediately for UI responsiveness
    if (bill) {
      bill.status = "Paid";
      bill.paymentStatus = "paid";
      bill.syncState = "Pending Sync";
    }
    settlementsMap.set(settlementId, settlement);

    // 4. Dispatch via Operations Engine with idempotency key
    const res = await OperationExecutor.dispatch("RECORD_PAYMENT", settlement, {
      idempotencyKey: `record_payment_${payload.billId}_${payload.paymentMethod}`,
      forceQueue: options?.forceQueue,
    });

    settlement.syncState = res.queued ? "Pending Sync" : "Synced";

    return {
      settlement,
      queued: res.queued,
      status: res.status,
    };
  }

  /**
   * Void an existing payment
   */
  public async voidPayment(
    paymentId: string,
    reason?: string,
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const res = await OperationExecutor.dispatch(
      "VOID_PAYMENT",
      { paymentId, reason },
      {
        idempotencyKey: `void_payment_${paymentId}_${Date.now()}`,
        forceQueue: options?.forceQueue,
      }
    );
    return { queued: res.queued, status: res.status };
  }

  /**
   * Refund an existing payment (Architecture Placeholder)
   */
  public async refundPayment(
    paymentId: string,
    refundAmount: number,
    reason?: string,
    options?: { forceQueue?: boolean }
  ): Promise<{ queued: boolean; status: Operation["status"] }> {
    this.initHandlers();

    const res = await OperationExecutor.dispatch(
      "REFUND_PAYMENT",
      { paymentId, refundAmount, reason },
      {
        idempotencyKey: `refund_payment_${paymentId}_${Date.now()}`,
        forceQueue: options?.forceQueue,
      }
    );
    return { queued: res.queued, status: res.status };
  }

  /**
   * Fetch all completed settlement records
   */
  public getAllSettlements(): SettlementRecord[] {
    return Array.from(settlementsMap.values());
  }

  /**
   * Fetch settlement for a specific bill
   */
  public getSettlementByBillId(billId: string): SettlementRecord | undefined {
    return Array.from(settlementsMap.values()).find((s) => s.billId === billId);
  }

  /**
   * Fetch all queued settlement operations from IndexedDB
   */
  public async getQueuedSettlements(): Promise<SettlementRecord[]> {
    const allOps = await getAllOperations();
    const list: SettlementRecord[] = [];

    for (const op of allOps) {
      if (op.operationType === "RECORD_PAYMENT") {
        const payload = op.payload as SettlementRecord;
        list.push({
          ...payload,
          syncState:
            op.status === "Queued"
              ? "Pending Sync"
              : op.status === "Running"
              ? "Syncing"
              : op.status === "Completed"
              ? "Synced"
              : "Sync Failed",
        });
      }
    }
    return list;
  }
}

export const PaymentService = new PaymentServiceClass();
