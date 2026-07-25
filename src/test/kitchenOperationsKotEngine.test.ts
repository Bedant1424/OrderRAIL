import { describe, it, expect } from 'vitest';
import { PriorityEngine } from '../lib/kitchen/priorityEngine';
import { type KitchenTicket } from '../lib/kitchen/types';
import { printService, type KotPrintPayloadData } from '../lib/printing';

describe('Kitchen Operations & Production KOT Engine Unit & Integration Tests', () => {
  it('1. PriorityEngine: Should assign correct priority level based on elapsed preparation time', () => {
    const now = 1000000000000; // Fixed timestamp baseline

    // 2 mins ago -> NORMAL
    expect(PriorityEngine.getPriority(now - 2 * 60 * 1000, now)).toBe('NORMAL');

    // 7 mins ago -> HIGH
    expect(PriorityEngine.getPriority(now - 7 * 60 * 1000, now)).toBe('HIGH');

    // 12 mins ago -> URGENT
    expect(PriorityEngine.getPriority(now - 12 * 60 * 1000, now)).toBe('URGENT');

    // 18 mins ago -> CRITICAL
    expect(PriorityEngine.getPriority(now - 18 * 60 * 1000, now)).toBe('CRITICAL');
  });

  it('2. PriorityEngine: Should format elapsed time string correctly', () => {
    const now = 1000000000000;
    const createdAt = now - (8 * 60 + 25) * 1000; // 8m 25s

    expect(PriorityEngine.formatElapsedTime(createdAt, now)).toBe('8m 25s');
    expect(PriorityEngine.getElapsedMins(createdAt, now)).toBe(8);
  });

  it('3. Status Workflow: Should validate kitchen state machine transitions', () => {
    // Valid transitions
    expect(PriorityEngine.isValidTransition('NEW', 'PREPARING')).toBe(true);
    expect(PriorityEngine.isValidTransition('PREPARING', 'READY')).toBe(true);
    expect(PriorityEngine.isValidTransition('READY', 'SERVED')).toBe(true);

    // Invalid terminal transition
    expect(PriorityEngine.isValidTransition('SERVED', 'PREPARING')).toBe(false);
  });

  it('4. KOT Payload & PrintService Dispatch: Should enqueue device-agnostic payload to KOT_PRINTER', async () => {
    const mockTicket: KitchenTicket = {
      id: 'ord-kot-777',
      orderNumber: 777,
      tableLabel: 'Table 4',
      orderType: 'DINE_IN',
      timestamp: '01:15 PM',
      createdAtMs: Date.now() - 3 * 60 * 1000,
      status: 'NEW',
      priority: 'NORMAL',
      elapsedMins: 3,
      items: [
        { id: 'i1', name: 'Artisan Club Sandwich', qty: 2, notes: 'Extra fries' },
        { id: 'i2', name: 'Iced Vanilla Latte', qty: 1, notes: 'Oat milk' },
      ],
    };

    const payload: KotPrintPayloadData = {
      type: 'KOT',
      orderId: mockTicket.id,
      orderNumber: mockTicket.orderNumber,
      tableLabel: mockTicket.tableLabel,
      timestamp: mockTicket.timestamp,
      items: mockTicket.items.map((i) => ({
        id: i.id || i.name,
        name: i.name,
        price: 0, // KOT has no financial prices
        qty: i.qty,
        notes: i.notes || undefined,
      })),
    };

    const { success, job } = await printService.enqueue('KOT', 'KOT_PRINTER', payload, {
      orderId: mockTicket.id,
    });

    expect(success).toBe(true);
    expect(job).toBeDefined();
    expect(job?.destination).toBe('KOT_PRINTER');
    expect(job?.payload.type).toBe('KOT');
  });
});
