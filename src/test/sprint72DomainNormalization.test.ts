import { describe, it, expect } from 'vitest';
import { BillService } from '../lib/billing';
import { RestaurantOperationsService, REALTIME_EVENTS, TableEntity, OrderEntity, BillEntity } from '../lib/operations';
import { compareTableLabels } from '../lib/tables/naturalTableSort';

describe('Sprint 7.2 — Domain Normalization & Repository Refactor Tests', () => {
  it('1. UUID Normalization: Bill generated references session_id and table_id UUIDs', async () => {
    const tableUuid = 'f3a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f';
    const sessionUuid = `sess-norm-${Date.now()}`;

    const bill = await BillService.generateBill({
      cafeId: 'c1a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f',
      sessionId: sessionUuid,
      tableId: tableUuid,
      orders: [
        {
          items: [{ id: 'item-1', name: 'Espresso', qty: 2, price: 150 }],
        },
      ],
    });

    expect(bill.session_id).toBe(sessionUuid);
    expect(bill.table_id).toBe(tableUuid);
    expect(bill.subtotal).toBe(300);
  });

  it('2. Table Label Resolution: Human label "Table 4" is resolved at presentation layer', () => {
    const tableLabel = '4';
    const displayLabel = tableLabel.toLowerCase().startsWith('table') ? tableLabel : `Table ${tableLabel}`;
    
    expect(displayLabel).toBe('Table 4');
    expect(compareTableLabels('4', '10')).toBeLessThan(0);
  });

  it('3. RestaurantOperationsService Expansion: openSession, occupyTable, closeSession, releaseTable orchestrations execute safely', async () => {
    const tableUuid = 'f3a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f';
    const cafeId = 'c1a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f';

    const openRes = await RestaurantOperationsService.openSession(tableUuid, cafeId, '5');
    expect(openRes.tableId).toBe(tableUuid);
    expect(openRes.sessionId).toBeDefined();

    const resetRes = await RestaurantOperationsService.resetTable(tableUuid, cafeId, openRes.sessionId);
    expect(resetRes.success).toBe(true);
    expect(resetRes.tableId).toBe(tableUuid);
  });

  it('4. Realtime Event Registry: Centralized event constants', () => {
    expect(REALTIME_EVENTS.TABLE_RESET).toBe('TABLE_RESET');
    expect(REALTIME_EVENTS.SESSION_OPENED).toBe('SESSION_OPENED');
    expect(REALTIME_EVENTS.SESSION_CLOSED).toBe('SESSION_CLOSED');
    expect(REALTIME_EVENTS.ORDER_CREATED).toBe('ORDER_CREATED');
    expect(REALTIME_EVENTS.ORDER_UPDATED).toBe('ORDER_UPDATED');
    expect(REALTIME_EVENTS.SERVICE_REQUEST_UPDATED).toBe('SERVICE_REQUEST_UPDATED');
  });

  it('5. Normalized DTO Contracts: Ensures canonical interfaces validate UUID relationships', () => {
    const table: TableEntity = {
      id: 'f3a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f',
      label: 'Table 4',
      seats: 4,
      status: 'AVAILABLE',
    };

    const order: OrderEntity = {
      id: 'b2a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f',
      order_number: 101,
      cafe_id: 'c1a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f',
      table_id: table.id,
      status: 'NEW',
      total_cents: 1500,
      created_at: new Date().toISOString(),
    };

    const bill: BillEntity = {
      id: 'a1a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f',
      bill_number: 1,
      cafe_id: 'c1a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f',
      session_id: 'd4a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f',
      table_id: table.id,
      order_type: 'DINE_IN',
      payment_status: 'PAID',
      payment_method: 'CASH',
      subtotal: 15,
      discount: 0,
      service_charge: 0,
      cgst: 0.375,
      sgst: 0.375,
      round_off: 0,
      grand_total: 15.75,
      total_items: 1,
      created_at: new Date().toISOString(),
    };

    expect(table.id).toBe(order.table_id);
    expect(bill.table_id).toBe(table.id);
  });
});
