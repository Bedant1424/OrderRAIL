import { supabase } from '../db';
import { Bill, BillItem } from '../billing/types';
import { BillRepository } from '../billing/BillRepository';
import type { OwnerAnalyticsRangeResponse } from './analyticsTypes';

export class AnalyticsRepository {
  /**
   * Fetch authoritative multi-day owner analytics directly from PostgreSQL RPC public.get_owner_analytics_range
   * 
   * @param cafeId Cafe UUID
   * @param rangeDays Optional number of days (e.g. 7, 30, 90)
   * @param startDate Optional start business date YYYY-MM-DD
   * @param endDate Optional end business date YYYY-MM-DD
   */
  public static async fetchOwnerAnalyticsRange(
    cafeId: string,
    rangeDays: number = 7,
    startDate?: string | null,
    endDate?: string | null
  ): Promise<OwnerAnalyticsRangeResponse> {
    if (!cafeId) {
      throw new Error('[AnalyticsRepository] cafeId is required to fetch owner analytics range.');
    }

    const { data, error } = await supabase.rpc('get_owner_analytics_range', {
      p_cafe_id: cafeId,
      p_range_days: rangeDays,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });

    if (error) {
      console.error('[AnalyticsRepository] Failed to fetch owner analytics range from RPC:', error);
      throw new Error(
        `Failed to fetch owner analytics range: ${error.message || error.details || 'Unknown database error'}`
      );
    }

    if (!data || typeof data !== 'object') {
      throw new Error('[AnalyticsRepository] RPC returned empty or invalid data format.');
    }

    const raw = data as Record<string, any>;
    const rawRangeFin = raw.range_financials || {};
    const rawTodayFin = raw.today_financials || {};
    const rawTenders = raw.tenders || {};
    const rawOperational = raw.operational_summary || {};
    const rawByDay = Array.isArray(raw.by_day) ? raw.by_day : [];
    const rawTopItems = Array.isArray(raw.top_items) ? raw.top_items : [];

    return {
      cafe_id: String(raw.cafe_id || cafeId),
      current_business_date: String(raw.current_business_date || ''),
      start_business_date: String(raw.start_business_date || ''),
      end_business_date: String(raw.end_business_date || ''),
      range_days: Number(raw.range_days) || rangeDays,
      range_financials: {
        gross_subtotal: Number(rawRangeFin.gross_subtotal) || 0,
        total_discounts: Number(rawRangeFin.total_discounts) || 0,
        total_tax: Number(rawRangeFin.total_tax) || 0,
        cgst: Number(rawRangeFin.cgst) || 0,
        sgst: Number(rawRangeFin.sgst) || 0,
        total_service_charge: Number(rawRangeFin.total_service_charge) || 0,
        total_round_off: Number(rawRangeFin.total_round_off) || 0,
        net_collected: Number(rawRangeFin.net_collected) || 0,
        paid_bills_count: Number(rawRangeFin.paid_bills_count) || 0,
        total_items_sold: Number(rawRangeFin.total_items_sold) || 0,
        average_bill_value: Number(rawRangeFin.average_bill_value) || 0,
      },
      today_financials: {
        gross_subtotal: Number(rawTodayFin.gross_subtotal) || 0,
        total_discounts: Number(rawTodayFin.total_discounts) || 0,
        total_tax: Number(rawTodayFin.total_tax) || 0,
        cgst: Number(rawTodayFin.cgst) || 0,
        sgst: Number(rawTodayFin.sgst) || 0,
        total_service_charge: Number(rawTodayFin.total_service_charge) || 0,
        total_round_off: Number(rawTodayFin.total_round_off) || 0,
        net_collected: Number(rawTodayFin.net_collected) || 0,
        paid_bills_count: Number(rawTodayFin.paid_bills_count) || 0,
        total_items_sold: Number(rawTodayFin.total_items_sold) || 0,
        average_bill_value: Number(rawTodayFin.average_bill_value) || 0,
      },
      tenders: {
        cash: Number(rawTenders.cash) || 0,
        upi: Number(rawTenders.upi) || 0,
        card: Number(rawTenders.card) || 0,
        other: Number(rawTenders.other) || 0,
      },
      by_day: rawByDay.map((d: any) => ({
        business_date: String(d.business_date || ''),
        day: String(d.day || ''),
        revenue: Number(d.revenue) || 0,
        gross_subtotal: Number(d.gross_subtotal) || 0,
        paid_bills: Number(d.paid_bills) || 0,
        items_sold: Number(d.items_sold) || 0,
      })),
      top_items: rawTopItems.map((item: any) => ({
        name: String(item.name || ''),
        qty: Number(item.qty) || 0,
        revenue: Number(item.revenue) || 0,
        percentage: Number(item.percentage) || 0,
      })),
      operational_summary: {
        total_orders_placed: Number(rawOperational.total_orders_placed) || 0,
        cancelled_orders_count: Number(rawOperational.cancelled_orders_count) || 0,
        unsettled_orders_count: Number(rawOperational.unsettled_orders_count) || 0,
        unsettled_pipeline_cents: Number(rawOperational.unsettled_pipeline_cents) || 0,
      },
    };
  }

  /**
   * Fetches all bills for a cafe within a date range.
   */
  public static async getBillsByDateRange(
    cafeId: string,
    startDate: string,
    endDate: string
  ): Promise<Bill[]> {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('cafe_id', cafeId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (error || !data || data.length === 0) {
        const memoryBills = await BillRepository.getBillsByDateRange(cafeId, startDate, endDate);
        return memoryBills;
      }

      return data as Bill[];
    } catch {
      const memoryBills = await BillRepository.getBillsByDateRange(cafeId, startDate, endDate);
      return memoryBills;
    }
  }

  /**
   * Fetches bill items for paid bills within date range.
   */
  public static async getBillItemsByDateRange(
    cafeId: string,
    startDate: string,
    endDate: string
  ): Promise<BillItem[]> {
    try {
      const { data, error } = await supabase
        .from('bill_items')
        .select('*, bills!inner(cafe_id, payment_status, created_at)')
        .eq('bills.cafe_id', cafeId)
        .eq('bills.payment_status', 'PAID')
        .gte('bills.created_at', startDate)
        .lte('bills.created_at', endDate);

      if (error || !data) {
        return [];
      }

      return data as BillItem[];
    } catch {
      return [];
    }
  }

  /**
   * Fetches kitchen order metrics within date range.
   */
  public static async getKitchenOrdersByDateRange(
    cafeId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, created_at, updated_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error || !data) {
        return [];
      }

      return data;
    } catch {
      return [];
    }
  }

  /**
   * Fetches complete itemized sales performance for paid bills within a date range without truncation.
   */
  public static async fetchFullTopItems(
    cafeId: string,
    sinceIso: string,
    untilIso: string,
    startDate?: string | null,
    endDate?: string | null
  ): Promise<Array<{ name: string; qty: number; revenue: number; percentage: number }>> {
    try {
      let query = supabase
        .from('bill_items')
        .select('item_name, quantity, line_total, bills!inner(cafe_id, payment_status, created_at, business_date)')
        .eq('bills.cafe_id', cafeId)
        .eq('bills.payment_status', 'PAID');

      if (startDate && endDate) {
        query = query.gte('bills.business_date', startDate).lte('bills.business_date', endDate);
      } else {
        query = query.gte('bills.created_at', sinceIso).lte('bills.created_at', untilIso);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        // Fallback if business_date filtering yielded no records (e.g. legacy records with only created_at)
        if (startDate && endDate) {
          const fallbackRes = await supabase
            .from('bill_items')
            .select('item_name, quantity, line_total, bills!inner(cafe_id, payment_status, created_at)')
            .eq('bills.cafe_id', cafeId)
            .eq('bills.payment_status', 'PAID')
            .gte('bills.created_at', sinceIso)
            .lte('bills.created_at', untilIso);
          if (fallbackRes.data && fallbackRes.data.length > 0) {
            return this.aggregateTopItemsFromBillItems(fallbackRes.data);
          }
        }
        return [];
      }

      return this.aggregateTopItemsFromBillItems(data);
    } catch (err) {
      console.error('[AnalyticsRepository] fetchFullTopItems failed:', err);
      return [];
    }
  }

  private static aggregateTopItemsFromBillItems(
    data: any[]
  ): Array<{ name: string; qty: number; revenue: number; percentage: number }> {
    const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of data) {
      const name = it.item_name || 'Unknown Item';
      const cur = itemMap.get(name) ?? { name, qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity || 1);
      cur.revenue += Number(it.line_total || 0);
      itemMap.set(name, cur);
    }

    const sorted = Array.from(itemMap.values()).sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty;
      return b.revenue - a.revenue;
    });

    const maxQty = sorted[0]?.qty || 1;
    return sorted.map((item) => ({
      name: item.name,
      qty: item.qty,
      revenue: item.revenue,
      percentage: maxQty > 0 ? Math.round((item.qty / maxQty) * 100) : 0,
    }));
  }
}
