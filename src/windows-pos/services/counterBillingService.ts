import { BillCalculator } from "@/lib/billing/BillCalculator";
import { BillRepository } from "@/lib/billing/BillRepository";
import {
  getTaxSettings,
  fetchTaxSettingsFromDb,
  type TaxSettings,
} from "@/lib/billing/taxSettings";
import type {
  Bill,
  BillItemSnapshot,
  BillWithItems,
  PaymentMethod,
  RawInputItem,
} from "@/lib/billing/types";
import { PaymentService, type SettlementRecord } from "@/lib/payments/paymentService";
import { closeDiningSessionInDb, updateTableStatusInDb } from "@/lib/tables/tableRepository";
import { updateOrderStatusInDb } from "@/lib/orders/repository";
import { ReceiptBuilder, type ReceiptBuilderPayload } from "@/lib/printing/receiptBuilder";
import {
  type CounterPrinter,
  type PrintResult,
  getActiveCounterPrinter,
} from "./printer/counterPrinter";
import { escposStringToBytes } from "./counterKotService";
import type { CounterOrder, OrderSource } from "../types/counterTypes";

export interface BillPreviewOptions {
  discountPct?: number;
  discountAmt?: number;
  taxSettings?: TaxSettings;
  cafeId?: string;
}

export interface BillPreviewResult {
  orders: CounterOrder[];
  items: BillItemSnapshot[];
  rawSubtotal: number;
  subtotal: number;
  discount: number;
  discountPct?: number;
  discountAmt?: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  serviceCharge: number;
  roundOff: number;
  grandTotal: number;
  totalQuantity: number;
  appliedTaxSettings: TaxSettings;
}

export interface GenerateCounterBillParams {
  cafeId: string;
  orders: CounterOrder[];
  options?: BillPreviewOptions;
  tableId?: string | null;
  tableLabel?: string;
  diningSessionId?: string | null;
  cashierId?: string | null;
  cashierName?: string | null;
  notes?: string | null;
}

export interface SettleCounterBillParams {
  billId: string;
  paymentMethod: "CASH" | "UPI";
  amount: number;
  tenderedAmount?: number;
  changeDue?: number;
  transactionRef?: string;
  settledByUserId?: string | null;
  operatorId?: string;
  tableId?: string | null;
  diningSessionId?: string | null;
  tableLabel?: string;
  cafeId?: string;
  orders?: CounterOrder[];
  forceQueue?: boolean;
}

export interface SettleCounterBillResult {
  success: boolean;
  bill: BillWithItems;
  settlementRecord?: SettlementRecord;
  tableFreed?: boolean;
  offlineQueued?: boolean;
  changeDue: number;
  error?: string;
}

export interface PrintCustomerReceiptParams {
  bill: BillWithItems;
  orderSource?: OrderSource;
  tableLabel?: string;
  cafeName?: string;
  cafeId?: string;
  isReprint?: boolean;
  printer?: CounterPrinter;
}

export interface PrintCustomerReceiptResult {
  printResult: PrintResult;
  receiptText: string;
}

/**
 * Windows Counter Billing & Settlement Service
 * Manages financial calculations, bill creation, payment recording,
 * table/session release, and thermal receipt printing for Cheese Corner POS.
 */
export class CounterBillingService {
  /**
   * Builds financial preview for a set of Counter orders.
   * Derives taxes dynamically from canonical TaxSettings without hardcoding.
   */
  public static buildBillPreview(
    orders: CounterOrder[],
    options: BillPreviewOptions = {}
  ): BillPreviewResult {
    if (!orders || orders.length === 0) {
      throw new Error("Cannot calculate bill preview for an empty list of orders.");
    }

    // Resolve canonical TaxSettings
    const effectiveTaxSettings: TaxSettings =
      options.taxSettings || getTaxSettings(options.cafeId);

    // Flatten all line items across orders (supports multi-order table bills)
    const rawItems: RawInputItem[] = [];
    for (const order of orders) {
      for (const item of order.items) {
        if (item.qty <= 0) continue;
        rawItems.push({
          id: item.id,
          menuItemId: item.menuItemId || item.id,
          name: item.name,
          price: item.priceCents / 100,
          qty: item.qty,
          notes: item.note || undefined,
        });
      }
    }

    if (rawItems.length === 0) {
      throw new Error("Selected orders contain no billable line items.");
    }

    // Execute canonical BillCalculator
    const calc = BillCalculator.calculate(rawItems, {
      discountAmt: options.discountAmt,
      discountPct: options.discountPct,
      taxSettings: effectiveTaxSettings,
      cafeId: options.cafeId,
    });

    const rawSubtotal = rawItems.reduce((sum, it) => sum + it.price * it.qty, 0);

    return {
      orders,
      items: calc.itemSnapshots,
      rawSubtotal: Number(rawSubtotal.toFixed(2)),
      subtotal: calc.subtotal,
      discount: calc.discount,
      discountPct: options.discountPct,
      discountAmt: options.discountAmt,
      cgst: calc.cgst,
      sgst: calc.sgst,
      totalTax: Number((calc.cgst + calc.sgst).toFixed(2)),
      serviceCharge: calc.service_charge,
      roundOff: calc.round_off,
      grandTotal: calc.grand_total,
      totalQuantity: calc.total_items,
      appliedTaxSettings: effectiveTaxSettings,
    };
  }

  /**
   * Generates and persists a Bill record into PostgreSQL via canonical BillRepository.
   * Idempotent: returns existing bill if one was already generated for this session/order.
   */
  public static async generateBill(
    params: GenerateCounterBillParams
  ): Promise<BillWithItems> {
    const { cafeId, orders, options = {} } = params;

    if (!orders || orders.length === 0) {
      throw new Error("Cannot generate bill: at least one order is required.");
    }

    const firstOrder = orders[0];
    const orderSource: OrderSource = firstOrder.orderSource || "DINE_IN";

    // Determine canonical sessionId
    // For DINE_IN: use diningSessionId (or fallback to tableId)
    // For non-DINE_IN (TAKEAWAY, SWIGGY, ZOMATO): use order.id (prevents artificial dining sessions)
    let sessionId: string;
    if (orderSource === "DINE_IN") {
      sessionId =
        params.diningSessionId ||
        firstOrder.diningSessionId ||
        (params.tableId ? `session-table-${params.tableId}` : firstOrder.id);
    } else {
      sessionId = `order-${firstOrder.id}`;
    }

    // Check idempotency: Return existing bill if already generated
    const existingBills = await BillRepository.getBillsBySession(sessionId);
    if (existingBills.length > 0) {
      return existingBills[0];
    }

    // Calculate financials
    const preview = this.buildBillPreview(orders, { ...options, cafeId });
    const billNumber = await BillRepository.getNextBillNumber(cafeId);

    const now = new Date().toISOString();
    const billId = crypto.randomUUID();

    // Preserve channel & reference metadata in notes
    const channelTag = `[CHANNEL:${orderSource}]`;
    const refTag = firstOrder.externalOrderRef
      ? ` [REF:#${firstOrder.externalOrderRef}]`
      : "";
    const existingNotes = params.notes || firstOrder.note || "";
    const combinedNotes = `${channelTag}${refTag} ${existingNotes}`.trim();

    const billRecord: Bill = {
      id: billId,
      bill_number: billNumber,
      cafe_id: cafeId,
      session_id: sessionId,
      table_id: orderSource === "DINE_IN" ? params.tableId || firstOrder.tableId || null : null,
      cashier_id: params.cashierId || null,
      customer_name: firstOrder.customerName || null,
      customer_phone: firstOrder.customerPhone || null,
      order_type: orderSource === "DINE_IN" ? "DINE_IN" : "TAKEAWAY",
      payment_status: "PENDING",
      payment_method: "CASH",
      subtotal: preview.subtotal,
      discount: preview.discount,
      service_charge: preview.serviceCharge,
      cgst: preview.cgst,
      sgst: preview.sgst,
      round_off: preview.roundOff,
      grand_total: preview.grandTotal,
      total_items: preview.totalQuantity,
      notes: combinedNotes,
      created_at: now,
    };

    return BillRepository.saveBill(billRecord, preview.items);
  }

  /**
   * Settles a Bill with CASH or UPI payment tender, records payment,
   * releases Dine-In table session, and updates order states.
   */
  public static async settleBill(
    params: SettleCounterBillParams
  ): Promise<SettleCounterBillResult> {
    const { billId, paymentMethod, amount } = params;

    // 1. Retrieve target Bill
    const bill = await BillRepository.getBillById(billId);
    if (!bill) {
      throw new Error(`Bill not found with ID: ${billId}`);
    }

    // 2. Guard against duplicate settlement
    if (bill.payment_status === "PAID") {
      return {
        success: true,
        bill,
        changeDue: 0,
        error: "Bill is already settled and paid.",
      };
    }

    // 3. Payment Validation
    let tenderedAmount = params.tenderedAmount ?? amount;
    let changeDue = 0;

    if (paymentMethod === "CASH") {
      if (tenderedAmount < amount) {
        throw new Error(
          `Tendered amount (₹${tenderedAmount.toFixed(2)}) cannot be less than the payable total (₹${amount.toFixed(2)}).`
        );
      }
      changeDue = Number((tenderedAmount - amount).toFixed(2));
    } else if (paymentMethod === "UPI") {
      // UPI must be exact amount, change is 0
      tenderedAmount = amount;
      changeDue = 0;
    }

    const paidAt = new Date().toISOString();

    // 4. Structure canonical tenders
    const tenders = [
      {
        method: paymentMethod,
        amount: Number(amount.toFixed(2)),
        tenderedAmount: Number(tenderedAmount.toFixed(2)),
        changeDue: Number(changeDue.toFixed(2)),
        transactionRef: params.transactionRef?.trim() || undefined,
      },
    ];

    // 5. Settle bill through canonical BillRepository
    const settledBill = await BillRepository.settleBillWithTenders(
      billId,
      tenders,
      params.settledByUserId || null,
      paidAt
    );

    const finalBill = settledBill || {
      ...bill,
      payment_status: "PAID" as const,
      payment_method: paymentMethod as PaymentMethod,
      paid_at: paidAt,
      closed_at: paidAt,
    };

    // 6. Record payment via PaymentService (handles offline queue + IndexedDB)
    const orderId = params.orders?.[0]?.id || bill.session_id;
    const tableId = bill.table_id || params.tableId || null;
    const diningSessionId =
      bill.order_type === "DINE_IN"
        ? params.diningSessionId || bill.session_id
        : null;

    let settlementRecord: SettlementRecord | undefined;
    let offlineQueued = false;

    try {
      const paymentRes = await PaymentService.recordPayment(
        {
          billId,
          orderId,
          diningSessionId,
          tableId,
          tableLabel: params.tableLabel || (tableId ? `Table ${tableId}` : "Counter"),
          paymentMethod: paymentMethod.toLowerCase() as any,
          amount,
          operatorId: params.operatorId || "Counter Cashier",
          settledByUserId: params.settledByUserId || undefined,
          timestamp: new Date().toLocaleTimeString("en-IN"),
          createdAt: paidAt,
          tenders,
        },
        { forceQueue: params.forceQueue }
      );

      settlementRecord = paymentRes.settlement;
      offlineQueued = paymentRes.queued;
    } catch (payErr) {
      console.warn("[CounterBillingService] PaymentService recording warning:", payErr);
    }

    // 7. Canonical Lifecycle Closeout
    let tableFreed = false;

    if (bill.order_type === "DINE_IN" && diningSessionId && tableId) {
      try {
        // Invoke canonical dining-session close and free table
        await closeDiningSessionInDb(diningSessionId);
        await updateTableStatusInDb(tableId, "free", null);
        tableFreed = true;
      } catch (closeErr) {
        console.warn("[CounterBillingService] Dining session closeout warning:", closeErr);
      }
    }

    // 8. Update associated orders to 'served' / finalized state
    if (params.orders && params.orders.length > 0) {
      for (const ord of params.orders) {
        try {
          if (ord.status !== "cancelled") {
            await updateOrderStatusInDb(ord.id, "served", "counter");
          }
        } catch (ordErr) {
          console.warn(`[CounterBillingService] Order ${ord.id} status update warning:`, ordErr);
        }
      }
    }

    return {
      success: true,
      bill: finalBill,
      settlementRecord,
      tableFreed,
      offlineQueued,
      changeDue,
    };
  }

  /**
   * Generates and prints a customer receipt via the CounterPrinter abstraction.
   * DECOUPLED: Printer failure or absence NEVER fails or rolls back financial settlement.
   */
  public static async printCustomerReceipt(
    params: PrintCustomerReceiptParams
  ): Promise<PrintCustomerReceiptResult> {
    const { bill, printer = getActiveCounterPrinter() } = params;

    // Build canonical receipt payload
    const receiptPayload: ReceiptBuilderPayload = {
      billId: bill.id,
      billNumber: bill.bill_number,
      tableLabel: params.tableLabel || (bill.table_id ? `Table ${bill.table_id}` : "Counter"),
      timestamp: bill.paid_at || bill.created_at,
      cafeName: params.cafeName || "Cheese Corner",
      items: bill.items.map((it) => ({
        name: it.item_name,
        price: it.unit_price,
        qty: it.quantity,
        notes: it.special_instructions || undefined,
      })),
      subtotal: bill.subtotal,
      tax: Number((bill.cgst + bill.sgst).toFixed(2)),
      cgst: bill.cgst,
      sgst: bill.sgst,
      serviceCharge: bill.service_charge,
      discountAmt: bill.discount,
      netTotal: bill.grand_total,
      paymentStatus: (bill.payment_status || "PAID").toLowerCase(),
      paymentMode: bill.payment_method || "CASH",
      tenders: bill.tenders?.map((t) => ({
        method: t.payment_method,
        amount: t.amount,
      })),
      orderSource: params.orderSource || (bill.order_type as any) || "DINE_IN",
      isReprint: params.isReprint || false,
    };

    const receipt = ReceiptBuilder.build(receiptPayload, 58);
    const rawBytes = escposStringToBytes(receipt.escpos);

    let printResult: PrintResult;
    try {
      printResult = await printer.printRaw(rawBytes, {
        title: "Customer Receipt",
        orderNumber: bill.bill_number,
        tableLabel: receiptPayload.tableLabel,
      });
    } catch (printErr: any) {
      console.warn("[CounterBillingService] Receipt printing failed non-fatally:", printErr);
      printResult = {
        status: "FAILED",
        message: printErr?.message || "Printer communication exception",
        timestamp: new Date(),
      };
    }

    return {
      printResult,
      receiptText: receipt.text,
    };
  }
}
