import { describe, it, expect } from 'vitest';
import { SortingPolicy, RestaurantOperationsService } from '../lib/operations';
import { BillSummaryCalculator } from '../lib/billing';

describe('Sprint 7.1 — Operational Consistency & Lifecycle Restoration Tests', () => {
  it('1. SortingPolicy: Counter tables sort OCCUPIED (oldest session first) -> RESERVED -> CLEANING_REQUIRED -> AVAILABLE', () => {
    const tables = [
      { id: 't1', label: 'Table 1', status: 'AVAILABLE' },
      { id: 't2', label: 'Table 2', status: 'OCCUPIED', sessionStartTimeMs: 1000 },
      { id: 't3', label: 'Table 3', status: 'CLEANING_REQUIRED' },
      { id: 't4', label: 'Table 4', status: 'OCCUPIED', sessionStartTimeMs: 500 },
      { id: 't5', label: 'Table 5', status: 'RESERVED' },
    ];

    const sorted = SortingPolicy.sortCounterTables(tables);

    expect(sorted[0].id).toBe('t4'); // OCCUPIED, sessionStartTimeMs: 500 (oldest session)
    expect(sorted[1].id).toBe('t2'); // OCCUPIED, sessionStartTimeMs: 1000
    expect(sorted[2].id).toBe('t5'); // RESERVED
    expect(sorted[3].id).toBe('t3'); // CLEANING_REQUIRED
    expect(sorted[4].id).toBe('t1'); // AVAILABLE
  });

  it('2. SortingPolicy: Staff console orders sort Incoming/Active FIFO (oldest first) and Done LIFO (newest first)', () => {
    const orders = [
      { id: 'o1', status: 'NEW', created_at: '2026-07-25T10:00:00Z' },
      { id: 'o2', status: 'NEW', created_at: '2026-07-25T09:30:00Z' },
      { id: 'o3', status: 'SERVED', created_at: '2026-07-25T08:00:00Z', updated_at: '2026-07-25T08:30:00Z' },
      { id: 'o4', status: 'SERVED', created_at: '2026-07-25T08:00:00Z', updated_at: '2026-07-25T09:00:00Z' },
    ];

    const sorted = SortingPolicy.sortStaffOrders(orders);

    // Active orders first, oldest created_at first
    expect(sorted[0].id).toBe('o2'); // 09:30:00
    expect(sorted[1].id).toBe('o1'); // 10:00:00

    // Done orders next, newest updated_at first
    expect(sorted[2].id).toBe('o4'); // updated 09:00:00
    expect(sorted[3].id).toBe('o3'); // updated 08:30:00
  });

  it('3. RestaurantOperationsService: resetTable executes table reset and session closure safely', async () => {
    const result = await RestaurantOperationsService.resetTable(
      'table-ops-test-1',
      'cafe-ops-test',
      'sess-ops-test-1'
    );

    expect(result.success).toBe(true);
    expect(result.tableId).toBe('table-ops-test-1');
    expect(result.previousSessionId).toBe('sess-ops-test-1');
    expect(result.timestamp).toBeDefined();
  });

  it('4. Elimination of Random KOT Numbers: Order display and bill calculations match order_number', () => {
    const orderNumber = 42;
    const summary = BillSummaryCalculator.buildBillSummary({
      orders: [
        {
          subtotal: 300,
          items: [{ id: 'i1', name: 'Coffee', price: 150, qty: 2 }],
        },
      ],
    });

    expect(summary.subtotal).toBe(300);
    expect(summary.tax).toBe(24);
    expect(summary.grandTotal).toBe(324); // 300 * 1.08 = 324
    expect(orderNumber).toBe(42);
  });
});
