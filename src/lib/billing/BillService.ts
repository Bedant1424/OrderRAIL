import { BillCalculator } from './BillCalculator';
import { BillRepository } from './BillRepository';
import {
  Bill,
  BillCalculationOptions,
  BillWithItems,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  RawInputItem,
} from './types';

export interface GenerateBillInput {
  cafeId: string;
  sessionId: string;
  tableId?: string | null;
  cashierId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  orderType?: OrderType;
  orders: Array<{
    items: RawInputItem[];
  }>;
  calculationOptions?: BillCalculationOptions;
  notes?: string | null;
}

export class BillService {
  /**
   * Generates a permanent, immutable Bill from a dining session's orders.
   */
  public static async generateBill(input: GenerateBillInput): Promise<BillWithItems> {
    const allItems: RawInputItem[] = input.orders.flatMap((o) => o.items);
    if (allItems.length === 0) {
      throw new Error('Cannot generate bill for empty dining session.');
    }

    const calcResult = BillCalculator.calculate(allItems, input.calculationOptions);
    const billNumber = await BillRepository.getNextBillNumber(input.cafeId);

    const now = new Date().toISOString();
    const billId = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const billRecord: Bill = {
      id: billId,
      bill_number: billNumber,
      cafe_id: input.cafeId,
      session_id: input.sessionId,
      table_id: input.tableId || null,
      cashier_id: input.cashierId || null,
      customer_name: input.customerName || null,
      customer_phone: input.customerPhone || null,
      order_type: input.orderType || 'DINE_IN',
      payment_status: 'PENDING',
      payment_method: 'CASH',
      subtotal: calcResult.subtotal,
      discount: calcResult.discount,
      service_charge: calcResult.service_charge,
      cgst: calcResult.cgst,
      sgst: calcResult.sgst,
      round_off: calcResult.round_off,
      grand_total: calcResult.grand_total,
      total_items: calcResult.total_items,
      notes: input.notes || null,
      created_at: now,
    };

    return BillRepository.saveBill(billRecord, calcResult.itemSnapshots);
  }

  /**
   * Transition bill payment status to PAID.
   */
  public static async markBillPaid(
    billId: string,
    method: PaymentMethod = 'CASH',
    paidAt?: string
  ): Promise<BillWithItems | null> {
    const now = paidAt || new Date().toISOString();
    return BillRepository.updatePaymentStatus(billId, 'PAID', method, now);
  }

  /**
   * Transition bill payment status to CANCELLED.
   */
  public static async cancelBill(billId: string): Promise<BillWithItems | null> {
    return BillRepository.updatePaymentStatus(billId, 'CANCELLED');
  }

  /**
   * Transition bill payment status to REFUNDED.
   */
  public static async refundBill(billId: string): Promise<BillWithItems | null> {
    return BillRepository.updatePaymentStatus(billId, 'REFUNDED');
  }

  // Repository Delegation Queries
  public static async getBillById(id: string): Promise<BillWithItems | null> {
    return BillRepository.getBillById(id);
  }

  public static async getBillsByDateRange(
    cafeId: string,
    startDate: string,
    endDate: string
  ): Promise<BillWithItems[]> {
    return BillRepository.getBillsByDateRange(cafeId, startDate, endDate);
  }

  public static async getBillsByTable(tableId: string): Promise<BillWithItems[]> {
    return BillRepository.getBillsByTable(tableId);
  }

  public static async getBillsBySession(sessionId: string): Promise<BillWithItems[]> {
    return BillRepository.getBillsBySession(sessionId);
  }

  public static async getBillsByPaymentStatus(
    cafeId: string,
    status: PaymentStatus
  ): Promise<BillWithItems[]> {
    return BillRepository.getBillsByPaymentStatus(cafeId, status);
  }
}
