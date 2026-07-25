import { supabase } from '../db';
import { Bill, BillItem } from '../billing/types';
import { BillRepository } from '../billing/BillRepository';

export class AnalyticsRepository {
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
        // Memory fallback for tests & local dev
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
}
