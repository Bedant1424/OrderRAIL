import { describe, it, expect, beforeEach } from 'vitest';
import { Logger } from '../lib/observability/logger';
import { SortingPolicy, RestaurantOperationsService, REALTIME_EVENTS } from '../lib/operations';

describe('Sprint 8 — Production Pilot Readiness & Observability Tests', () => {
  beforeEach(() => {
    Logger.clearBuffer();
  });

  it('1. Observability Logger: Appends info, warn, error log entries with structured fields', () => {
    Logger.info('TEST_MODULE', 'TEST_ACTION', 'System initialized');
    Logger.warn('TEST_MODULE', 'WARN_ACTION', 'Low memory notice');
    Logger.error('TEST_MODULE', 'ERROR_ACTION', 'Database connection exception', new Error('DB_TIMEOUT'));

    const logs = Logger.getBufferedLogs();
    expect(logs.length).toBe(3);

    expect(logs[0].level).toBe('INFO');
    expect(logs[0].message).toBe('System initialized');

    expect(logs[1].level).toBe('WARN');
    expect(logs[1].message).toBe('Low memory notice');

    expect(logs[2].level).toBe('ERROR');
    expect(logs[2].error?.message).toBe('DB_TIMEOUT');
  });

  it('2. Observability Logger Buffer Limit: Maintains max buffer length', () => {
    for (let i = 0; i < 150; i++) {
      Logger.info('STRESS_TEST', 'LOG_EVENT', `Log entry #${i}`);
    }

    const logs = Logger.getBufferedLogs();
    expect(logs.length).toBe(100); // Max buffer size
    expect(logs[logs.length - 1].message).toBe('Log entry #149');
  });

  it('3. Production Operational Safeguards: Realtime event constants intact', () => {
    expect(REALTIME_EVENTS.TABLE_RESET).toBe('TABLE_RESET');
    expect(REALTIME_EVENTS.SESSION_CLOSED).toBe('SESSION_CLOSED');
  });

  it('4. Table Reset Execution: RestaurantOperationsService completes reset cycle safely', async () => {
    const res = await RestaurantOperationsService.resetTable(
      'f3a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f',
      'c1a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f'
    );

    expect(res.success).toBe(true);
    expect(res.tableId).toBe('f3a4b9c1-8d2e-4f1a-9c3b-5a7b9c1d3e5f');
    expect(res.timestamp).toBeDefined();
  });
});
