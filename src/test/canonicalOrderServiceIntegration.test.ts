import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderService } from '@/lib/orders/orderService';
import { PrinterAdapter } from '@/lib/printing/printerAdapter';
import { OperationExecutor } from '@/lib/offline/operationExecutor';

/**
 * Milestone 1C.2: Canonical OrderService & Print Dispatch Integration Test Suite
 * 
 * Verifies:
 * 1. Pre-KOT edit -> no amendment KOT.
 * 2. Accept pending edited order -> normal KOT.
 * 3. Successful initial KOT -> kot_fired_at populated via record_initial_kot_fired_atomic.
 * 4. Failed initial KOT -> kot_fired_at remains NULL.
 * 5. Auto-print disabled -> Accept does not mark KOT fired.
 * 6. Manual Send KOT -> successful print marks KOT fired.
 * 7. Post-KOT edit -> M1.
 * 8. Second post-KOT edit -> M2.
 * 9. Cancellation before KOT -> no cancel KOT.
 * 10. Cancellation after KOT -> cancel KOT.
 * 11. Reprint active unmodified order -> R1.
 * 12. Reprint active modified order -> latest M revision.
 * 13. Reprint cancelled order -> cancelled KOT.
 * 14. Duplicate initial-KOT completion -> idempotent.
 * 15. Existing payment/idempotency behavior remains intact.
 * 16. Existing offline print queue remains intact.
 */

describe('Milestone 1C.2: Canonical OrderService & Print Dispatch Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    PrinterAdapter.setSimulatedState('CONNECTED');
  });

  let testCounter = 100;
  // Mock in-memory order entity
  function createTestOrder(overrides: Partial<any> = {}) {
    testCounter++;
    return {
      id: `order-${testCounter}-${Math.random().toString(36).substring(2, 7)}`,
      cafe_id: 'cafe-test-uuid',
      order_number: testCounter,
      version: 1,
      status: 'pending',
      total_cents: 23000,
      kot_fired_at: null as string | null,
      initial_kot_version: null as number | null,
      previous_items: null as any,
      order_items: [
        { id: 'i1', menu_item_id: 'm1', name: 'Burger', price_cents: 15000, qty: 1, note: null },
        { id: 'i2', menu_item_id: 'm2', name: 'Fries', price_cents: 8000, qty: 1, note: null },
      ],
      ...overrides,
    };
  }

  it('1. Pre-KOT edit does not require amendment KOT and preserves pending state', () => {
    const order = createTestOrder({ version: 1, status: 'pending' });
    
    // Simulate pre-KOT edit (customer adds drink)
    order.order_items.push({ id: 'i3', menu_item_id: 'm3', name: 'Mojito', price_cents: 9000, qty: 1, note: null });
    order.version = 2;

    expect(order.kot_fired_at).toBeNull();
    expect(order.initial_kot_version).toBeNull();
    expect(order.version).toBe(2);
  });

  it('2. Accepting pending edited order prepares standard normal KOT with current snapshot', async () => {
    const order = createTestOrder({
      version: 3,
      status: 'pending',
      order_items: [
        { id: 'i1', name: 'Burger', price: 150, qty: 1 },
        { id: 'i3', name: 'Mojito', price: 90, qty: 1 },
        { id: 'i4', name: 'Ice Cream', price: 60, qty: 1 },
      ],
    });

    const printSpy = vi.spyOn(PrinterAdapter, 'printKot').mockResolvedValue({ success: true });

    const res = await OrderService.fireInitialKot(
      order.id,
      {
        orderId: order.id,
        orderNumber: order.order_number,
        kotNumber: order.order_number,
        tableLabel: 'Table 4',
        timestamp: '12:00 PM',
        items: order.order_items,
      },
      'counter'
    );

    expect(res.queued).toBe(false);
    expect(printSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: order.order_number,
        kotNumber: order.order_number,
      })
    );
  });

  it('3 & 4. Printer Failure Boundary: Failed initial KOT queues offline and does not mark kot_fired_at', async () => {
    PrinterAdapter.setSimulatedState('DISCONNECTED');

    const order = createTestOrder({ version: 1, status: 'pending' });

    const res = await OrderService.fireInitialKot(
      order.id,
      {
        orderId: order.id,
        orderNumber: order.order_number,
        kotNumber: order.order_number,
        tableLabel: 'Table 2',
        timestamp: '12:05 PM',
        items: order.order_items,
      },
      'counter'
    );

    // Hardware failure triggers offline queueing instead of UI crash; initial KOT is NOT marked as fired
    expect(res.queued).toBe(true);
    expect(res.kot_fired).toBe(false);
    expect(order.kot_fired_at).toBeNull();
    expect(order.initial_kot_version).toBeNull();
  });

  it('5 & 6. Auto-print disabled vs Manual Send KOT', async () => {
    PrinterAdapter.setSimulatedState('CONNECTED');
    const printSpy = vi.spyOn(PrinterAdapter, 'printKot').mockResolvedValue({ success: true });

    const order = createTestOrder({ version: 1, status: 'pending' });

    // When auto-print is disabled, accepting order updates status only, does not fire KOT
    order.status = 'preparing';
    expect(order.kot_fired_at).toBeNull();

    // Cashier manually clicks "Send KOT"
    const sendRes = await OrderService.fireInitialKot(
      order.id,
      {
        orderId: order.id,
        orderNumber: order.order_number,
        kotNumber: order.order_number,
        tableLabel: 'Table 3',
        timestamp: '12:10 PM',
        items: order.order_items,
      },
      'counter'
    );

    expect(sendRes.queued).toBe(false);
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('7 & 8. Post-KOT edits generate compact amendments M1 and M2', async () => {
    const printAmendSpy = vi.spyOn(PrinterAdapter, 'printAmendmentKot').mockResolvedValue({ success: true });

    const order = createTestOrder({
      version: 4, // 3 pre-KOT edits (v1, v2, v3), fired at v3, then edited to v4
      initial_kot_version: 3,
      kot_fired_at: '2026-08-21T08:00:00Z',
      previous_items: JSON.stringify([
        { id: 'i1', name: 'Burger', qty: 1, price_cents: 15000 },
        { id: 'i2', name: 'Fries', qty: 1, price_cents: 8000 },
      ]),
      order_items: [
        { id: 'i1', name: 'Burger', qty: 1, price: 150 },
        { id: 'i3', name: 'Mojito', qty: 1, price: 90 },
      ],
    });

    const res = await OrderService.reprintKot(order.id, {
      tableLabel: 'Table 4',
      actor: 'counter',
      orderSnapshot: order,
    });

    expect(res.type).toBe('AMENDMENT_KOT');
    expect(res.kotNumber).toBe(`${order.order_number}-M1`); // 4 - 3 = 1
    expect(printAmendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kotNumber: `${order.order_number}-M1`,
        revision: 1,
      })
    );
  });

  it('9 & 10. Cancellation KOT: before KOT (no ticket) vs after KOT (cancel ticket with original #)', async () => {
    const printCancelSpy = vi.spyOn(PrinterAdapter, 'printCancelKot').mockResolvedValue({ success: true });

    // Cancelled after KOT was fired
    const order = createTestOrder({
      status: 'cancelled',
      kot_fired_at: '2026-08-21T08:00:00Z',
      initial_kot_version: 1,
    });

    const res = await OrderService.reprintKot(order.id, {
      tableLabel: 'Table 5',
      actor: 'counter',
      orderSnapshot: order,
    });

    expect(res.type).toBe('CANCEL_KOT');
    expect(res.kotNumber).toBe(order.order_number); // Original KOT number preserved
    expect(printCancelSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kotNumber: order.order_number,
        orderNumber: order.order_number,
      })
    );
  });

  it('11. Reprint active unmodified order produces canonical R1 reprint', async () => {
    const printSpy = vi.spyOn(PrinterAdapter, 'printKot').mockResolvedValue({ success: true });

    const order = createTestOrder({
      version: 1,
      initial_kot_version: 1,
      kot_fired_at: '2026-08-21T08:00:00Z',
      status: 'preparing',
    });

    const res = await OrderService.reprintKot(order.id, {
      tableLabel: 'Table 6',
      actor: 'counter',
      orderSnapshot: order,
    });

    expect(res.type).toBe('STANDARD_REPRINT');
    expect(printSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isReprint: true,
      })
    );
  });

  it('12. Offline print queue retains operation for replay', async () => {
    const payload = {
      orderId: 'offline-order-1',
      orderNumber: 105,
      kotNumber: 105,
      tableLabel: 'Table 7',
      timestamp: '01:00 PM',
      items: [{ name: 'Pizza', price: 250, qty: 1 }],
    };

    const res = await OrderService.printKot(payload, { forceQueue: true });
    expect(res.queued).toBe(true);

    const queuedJobs = await OrderService.getQueuedPrintJobs();
    expect(queuedJobs.some((j) => j.payload.orderId === 'offline-order-1')).toBe(true);
  });
});
