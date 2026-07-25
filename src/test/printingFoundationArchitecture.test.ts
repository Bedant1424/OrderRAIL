import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PrintService,
  MockProvider,
  ProviderFactory,
  providerFactory,
  type KotPrintPayloadData,
  type ReceiptPrintPayloadData,
  type TestPrintPayloadData,
  type IPrintProvider,
} from '../lib/printing';

describe('Printing Foundation & ProviderFactory Architecture Tests', () => {
  let mockProvider: MockProvider;

  beforeEach(() => {
    mockProvider = new MockProvider({ simulatedDelayMs: 0 });
    PrintService.resetInstanceForTesting(mockProvider);
    ProviderFactory.resetInstanceForTesting();
  });

  it('1. Should initialize with MockProvider via ProviderFactory and report CONNECTED state', async () => {
    const service = PrintService.getInstance();
    expect(service.getConnectionState()).toBe('CONNECTED');

    const meta = service.getStatusMeta();
    expect(meta.activeProviderId).toBe('mock-provider');
    expect(meta.state).toBe('CONNECTED');
  });

  it('2. ProviderFactory Registry: Should contain mock, qz-tray, and orderrail-agent defaults', () => {
    const factory = ProviderFactory.getInstance();
    const registered = factory.getRegisteredTypes();

    expect(registered).toContain('mock');
    expect(registered).toContain('qz-tray');
    expect(registered).toContain('orderrail-agent');
  });

  it('3. ProviderFactory Instantiation: Should instantiate MockProvider cleanly', () => {
    const factory = ProviderFactory.getInstance();
    const provider = factory.createProvider('mock');

    expect(provider.id).toBe('mock-provider');
    expect(provider.name).toContain('Development Mock Provider');
  });

  it('4. ProviderFactory Registration & Overrides: Prevent duplicate registration unless override=true', () => {
    const factory = ProviderFactory.getInstance();
    const customFactoryFn = () => new MockProvider();

    // Duplicate registration should throw
    expect(() => factory.registerProvider('mock', customFactoryFn)).toThrow(
      'Provider type "mock" is already registered'
    );

    // Override registration should succeed
    expect(() => factory.registerProvider('mock', customFactoryFn, true)).not.toThrow();
  });

  it('5. ProviderFactory Fallback: Unknown provider type falls back gracefully to mock', () => {
    const factory = ProviderFactory.getInstance();
    const provider = factory.createProvider('non_existent_provider');

    expect(provider.id).toBe('mock-provider');
  });

  it('6. PrintService Provider Switching: setProviderType updates active provider via factory', async () => {
    const service = PrintService.getInstance();
    expect(service.getActiveProvider().id).toBe('mock-provider');

    // Switch to mock explicitly via setProviderType
    await service.setProviderType('mock');
    expect(providerFactory.getActiveProviderType()).toBe('mock');
    expect(service.getActiveProvider().id).toBe('mock-provider');
  });

  it('7. Should enqueue and process KOT print job using device-agnostic structured payload', async () => {
    const service = PrintService.getInstance();

    const kotPayload: KotPrintPayloadData = {
      type: 'KOT',
      orderId: 'ord-101',
      orderNumber: 101,
      tableLabel: 'Table 4',
      timestamp: '12:30 PM',
      items: [
        { id: 'i1', name: 'New York Cheesecake', price: 280, qty: 2, notes: 'Extra berry sauce' },
      ],
    };

    const { success, job } = await service.enqueue('KOT', 'KOT_PRINTER', kotPayload, { orderId: 'ord-101' });

    expect(success).toBe(true);
    expect(job.status).toBe('COMPLETED');
    expect(job.type).toBe('KOT');
    expect(job.destination).toBe('KOT_PRINTER');
    expect(job.payload).toEqual(kotPayload);
  });

  it('8. Should enqueue and process RECEIPT print job for BILL_PRINTER destination', async () => {
    const service = PrintService.getInstance();

    const receiptPayload: ReceiptPrintPayloadData = {
      type: 'RECEIPT',
      orderId: 'ord-102',
      billNumber: 'BILL-102',
      sessionId: 'session-44',
      tableLabel: 'Table 2',
      cashierName: 'John',
      timestamp: '12:35 PM',
      items: [{ id: 'i2', name: 'Espresso', price: 120, qty: 1 }],
      subtotal: 120,
      tax: 9.6,
      discountPct: 0,
      discountAmt: 0,
      netTotal: 129.6,
      tenders: [{ method: 'cash', amount: 130 }],
    };

    const { success, job } = await service.enqueue('RECEIPT', 'BILL_PRINTER', receiptPayload, { orderId: 'ord-102' });

    expect(success).toBe(true);
    expect(job.status).toBe('COMPLETED');
    expect(job.destination).toBe('BILL_PRINTER');
  });

  it('9. Transactional Guarantee: Should return success: false when provider fails, preserving order state', async () => {
    mockProvider.setShouldFailNextJob(true, 'Paper Out Error');
    const service = PrintService.getInstance();

    const kotPayload: KotPrintPayloadData = {
      type: 'KOT',
      orderNumber: 103,
      tableLabel: 'Table 1',
      timestamp: '12:40 PM',
      items: [{ id: 'i3', name: 'Cappuccino', price: 150, qty: 1 }],
    };

    const { success, job } = await service.enqueue('KOT', 'KOT_PRINTER', kotPayload);

    expect(success).toBe(false);
    expect(job.status).toBe('FAILED');
    expect(job.errorMessage).toBe('Paper Out Error');
  });

  it('10. Retry Strategy: Should allow retrying a FAILED job up to maxRetries', async () => {
    mockProvider.setShouldFailNextJob(true, 'Temporary Spool Error');
    const service = PrintService.getInstance();

    const testPayload: TestPrintPayloadData = {
      type: 'TEST',
      timestamp: new Date().toISOString(),
      message: 'Retry test',
    };

    const { success: initialSuccess, job } = await service.enqueue('TEST', 'DEFAULT_PRINTER', testPayload);
    expect(initialSuccess).toBe(false);
    expect(job.status).toBe('FAILED');
    expect(job.retryCount).toBe(0);

    // Retry job (now provider succeeds)
    const retrySuccess = await service.retryJob(job.id);
    expect(retrySuccess).toBe(true);
    expect(job.status).toBe('COMPLETED');
    expect(job.retryCount).toBe(1);
  });

  it('11. Should support discovering printers through active provider', async () => {
    const service = PrintService.getInstance();
    const printers = await service.getActiveProvider().discoverPrinters();

    expect(printers).toHaveLength(3);
    expect(printers[0].name).toContain('Mock KOT Thermal Printer');
  });

  it('12. Should notify status listeners when connection state or provider changes', async () => {
    const service = PrintService.getInstance();
    const listener = vi.fn();

    const unsubscribe = service.subscribeStatus(listener);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ state: 'CONNECTED' }));

    const customMock: IPrintProvider = new MockProvider({ simulatedDelayMs: 0 });
    await service.setProvider(customMock);

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ activeProviderId: 'mock-provider' }));
    unsubscribe();
  });
});
