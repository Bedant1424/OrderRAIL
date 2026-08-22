import { supabase } from '@/lib/db';
import { Bill, BillItemSnapshot, BillWithItems, PaymentMethod, PaymentStatus } from './types';
import { BillNumberGenerator } from './BillNumberGenerator';

export class BillRepository {
  private static inMemoryStore: Map<string, BillWithItems> = new Map();
  private static sessionToBillIdMap: Map<string, string> = new Map();

  /**
   * Fetch next sequential bill number for cafe from DB or memory fallback.
   */
  public static async getNextBillNumber(cafeId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_next_bill_number', { p_cafe_id: cafeId });
      if (!error && typeof data === 'number') {
        return BillNumberGenerator.getNextBillNumber(cafeId, data - 1);
      }

      const { data: maxRow } = await supabase
        .from('bills')
        .select('bill_number')
        .eq('cafe_id', cafeId)
        .order('bill_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentMax = maxRow?.bill_number ?? 0;
      return BillNumberGenerator.getNextBillNumber(cafeId, currentMax);
    } catch {
      return BillNumberGenerator.getNextBillNumber(cafeId);
    }
  }

  /**
   * Save a generated bill and its immutable item snapshots atomically.
   */
  public static async saveBill(bill: Bill, items: BillItemSnapshot[]): Promise<BillWithItems> {
    // Check in-memory session index for idempotency
    const existingBillId = this.sessionToBillIdMap.get(bill.session_id);
    if (existingBillId && this.inMemoryStore.has(existingBillId)) {
      return this.inMemoryStore.get(existingBillId)!;
    }

    const fullBill: BillWithItems = { ...bill, items };
    this.inMemoryStore.set(bill.id, fullBill);
    this.sessionToBillIdMap.set(bill.session_id, bill.id);

    try {
      // Try atomic RPC function first if available in database
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('generate_bill_atomic', {
        p_bill: bill,
        p_items: items,
      });

      if (!rpcErr && rpcRes?.status === 'EXISTS' && rpcRes.bill_id) {
        const existingFromDb = await this.getBillById(rpcRes.bill_id);
        if (existingFromDb) return existingFromDb;
      }

      if (rpcErr) {
        // Fallback to standard insert
        const { error: billErr } = await supabase.from('bills').insert({
          id: bill.id,
          bill_number: bill.bill_number,
          cafe_id: bill.cafe_id,
          session_id: bill.session_id,
          table_id: bill.table_id || null,
          cashier_id: bill.cashier_id || null,
          customer_id: bill.customer_id || null,
          customer_name: bill.customer_name || null,
          customer_phone: bill.customer_phone || null,
          order_type: bill.order_type,
          payment_status: bill.payment_status,
          payment_method: bill.payment_method,
          subtotal: bill.subtotal,
          discount: bill.discount,
          service_charge: bill.service_charge,
          cgst: bill.cgst,
          sgst: bill.sgst,
          round_off: bill.round_off,
          grand_total: bill.grand_total,
          total_items: bill.total_items,
          notes: bill.notes || null,
          created_at: bill.created_at,
          paid_at: bill.paid_at || null,
          closed_at: bill.closed_at || null,
        });

        if (billErr) {
          console.warn('[BillRepository] DB insert bill notice:', billErr.message);
        }

        if (items.length > 0) {
          const itemRows = items.map((item) => ({
            bill_id: bill.id,
            menu_item_id: item.menu_item_id || null,
            item_name: item.item_name,
            category_name: item.category_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            tax: item.tax,
            line_total: item.line_total,
            special_instructions: item.special_instructions || null,
          }));

          const { error: itemErr } = await supabase.from('bill_items').insert(itemRows);
          if (itemErr) {
            console.warn('[BillRepository] DB insert bill_items notice:', itemErr.message);
          }
        }
      }
    } catch (e: any) {
      console.warn('[BillRepository] saveBill database warning:', e?.message || e);
    }

    return fullBill;
  }

  /**
   * Get Bill by UUID.
   */
  public static async getBillById(id: string): Promise<BillWithItems | null> {
    if (this.inMemoryStore.has(id)) {
      return this.inMemoryStore.get(id)!;
    }

    try {
      const { data: billRow, error: billErr } = await supabase
        .from('bills')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (billErr || !billRow) return null;

      const { data: itemRows } = await supabase
        .from('bill_items')
        .select('*')
        .eq('bill_id', id);

      const { data: paymentRows } = await supabase
        .from('bill_payments')
        .select('*')
        .eq('bill_id', id)
        .order('created_at', { ascending: true });

      const billWithItems: BillWithItems = {
        ...(billRow as Bill),
        items: (itemRows || []) as BillItemSnapshot[],
        tenders: (paymentRows || []) as BillPaymentTender[],
      };

      this.inMemoryStore.set(id, billWithItems);
      this.sessionToBillIdMap.set(billWithItems.session_id, id);
      return billWithItems;
    } catch {
      return null;
    }
  }

  /**
   * Get Bills by Date Range for a specific cafe.
   */
  public static async getBillsByDateRange(
    cafeId: string,
    startDate?: string | null,
    endDate?: string | null
  ): Promise<BillWithItems[]> {
    const memoryResults = Array.from(this.inMemoryStore.values()).filter(
      (b) =>
        b.cafe_id === cafeId &&
        (!startDate || b.created_at >= startDate) &&
        (!endDate || b.created_at <= endDate)
    );

    try {
      let query = supabase
        .from('bills')
        .select('*, bill_items(*)')
        .eq('cafe_id', cafeId)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: billRows } = await query;

      if (billRows && billRows.length > 0) {
        return billRows.map((r: any) => ({
          ...r,
          items: r.bill_items || [],
        }));
      }
    } catch (e: any) {
      console.warn('[BillRepository] getBillsByDateRange notice:', e?.message || e);
    }

    return memoryResults;
  }

  /**
   * Get Bills by Table ID.
   */
  public static async getBillsByTable(tableId: string): Promise<BillWithItems[]> {
    const memoryResults = Array.from(this.inMemoryStore.values()).filter(
      (b) => b.table_id === tableId
    );

    try {
      const { data: billRows } = await supabase
        .from('bills')
        .select('*, bill_items(*)')
        .eq('table_id', tableId)
        .order('created_at', { ascending: false });

      if (billRows && billRows.length > 0) {
        return billRows.map((r: any) => ({
          ...r,
          items: r.bill_items || [],
        }));
      }
    } catch {}

    return memoryResults;
  }

  /**
   * Get Bills by Session ID.
   */
  public static async getBillsBySession(sessionId: string): Promise<BillWithItems[]> {
    const memoryResults = Array.from(this.inMemoryStore.values()).filter(
      (b) => b.session_id === sessionId
    );

    if (memoryResults.length > 0) {
      return memoryResults;
    }

    try {
      const { data: billRows } = await supabase
        .from('bills')
        .select('*, bill_items(*)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (billRows && billRows.length > 0) {
        return billRows.map((r: any) => ({
          ...r,
          items: r.bill_items || [],
        }));
      }
    } catch {}

    return memoryResults;
  }

  /**
   * Get Bills by Payment Status for a cafe.
   */
  public static async getBillsByPaymentStatus(
    cafeId: string,
    status: PaymentStatus
  ): Promise<BillWithItems[]> {
    const memoryResults = Array.from(this.inMemoryStore.values()).filter(
      (b) => b.cafe_id === cafeId && b.payment_status === status
    );

    try {
      const { data: billRows } = await supabase
        .from('bills')
        .select('*, bill_items(*)')
        .eq('cafe_id', cafeId)
        .eq('payment_status', status)
        .order('created_at', { ascending: false });

      if (billRows && billRows.length > 0) {
        return billRows.map((r: any) => ({
          ...r,
          items: r.bill_items || [],
        }));
      }
    } catch {}

    return memoryResults;
  }

  /**
   * Update Payment Status for a Bill.
   */
  public static async updatePaymentStatus(
    billId: string,
    status: PaymentStatus,
    method?: PaymentMethod,
    paidAt?: string
  ): Promise<BillWithItems | null> {
    const cached = this.inMemoryStore.get(billId);
    if (cached) {
      // Idempotency: Ignore repeated mark PAID if already paid
      if (cached.payment_status === 'PAID' && status === 'PAID') {
        return cached;
      }

      cached.payment_status = status;
      if (method) cached.payment_method = method;
      if (paidAt && !cached.paid_at) cached.paid_at = paidAt;
      if ((status === 'PAID' || status === 'CANCELLED' || status === 'REFUNDED') && !cached.closed_at) {
        cached.closed_at = new Date().toISOString();
      }
    }

    try {
      const updateData: any = { payment_status: status };
      if (method) updateData.payment_method = method;
      if (paidAt) updateData.paid_at = paidAt;
      if (status === 'PAID' || status === 'CANCELLED' || status === 'REFUNDED') {
        updateData.closed_at = new Date().toISOString();
      }

      await supabase.from('bills').update(updateData).eq('id', billId);
    } catch (e: any) {
      console.warn('[BillRepository] updatePaymentStatus notice:', e?.message || e);
    }

    return this.getBillById(billId);
  }

  /**
   * Settle Bill with Structured Tenders atomically.
   */
  public static async settleBillWithTenders(
    billId: string,
    tenders: {
      method: string;
      amount: number;
      tenderedAmount?: number;
      changeDue?: number;
      transactionRef?: string;
    }[],
    settledByUserId?: string | null,
    paidAt?: string
  ): Promise<BillWithItems | null> {
    const formattedTenders = tenders.map((t) => ({
      method: t.method.toUpperCase(),
      amount: t.amount,
      tendered_amount: t.tenderedAmount ?? t.amount,
      change_due: t.changeDue ?? 0.0,
      transaction_ref: t.transactionRef || null,
    }));

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc(
        'settle_bill_with_tenders_atomic',
        {
          p_bill_id: billId,
          p_tenders: formattedTenders,
          p_settled_by: settledByUserId || null,
          p_paid_at: paidAt || new Date().toISOString(),
        }
      );

      if (rpcErr) {
        console.warn('[BillRepository] settle_bill_with_tenders_atomic notice:', rpcErr.message);
        // Fallback to legacy single status update if RPC is unapplied
        const fallbackMethod = tenders.length > 1 
          ? 'MIXED' 
          : (tenders[0]?.method?.toUpperCase() || 'CASH') as PaymentMethod;
        return this.updatePaymentStatus(billId, 'PAID', fallbackMethod, paidAt);
      }

      // Evict in-memory cache to force re-fetch with fresh tenders
      this.inMemoryStore.delete(billId);
      return this.getBillById(billId);
    } catch (e: any) {
      console.warn('[BillRepository] settleBillWithTenders warning:', e?.message || e);
      const fallbackMethod = tenders.length > 1 
        ? 'MIXED' 
        : (tenders[0]?.method?.toUpperCase() || 'CASH') as PaymentMethod;
      return this.updatePaymentStatus(billId, 'PAID', fallbackMethod, paidAt);
    }
  }

  public static clearMemoryStoreForTesting(): void {
    this.inMemoryStore.clear();
    this.sessionToBillIdMap.clear();
  }
}
