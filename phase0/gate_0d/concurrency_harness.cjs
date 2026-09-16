/**
 * Milestone 5 & 6 & 7: Concurrency Test Harness & Integrity Checks
 * Executes T1 through T12 and Integrity Checks A through I.
 * 
 * Target: db.nmlrggmiksxwxptrcntb.supabase.co:6543 (Supavisor Transaction Pooler)
 */

const { Pool } = require('pg');

const STAGING_HOST = 'db.nmlrggmiksxwxptrcntb.supabase.co';
const STAGING_PORT = 6543;
const CAFE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const FOREIGN_CAFE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OPERATOR_ID = '11111111-1111-1111-1111-111111111111';

const pool = new Pool({
  host: STAGING_HOST,
  port: STAGING_PORT,
  user: 'test_runner',
  password: 'StagingSecretPassword123!',
  database: 'postgres',
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
});

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { min: 0, max: 0, mean: 0, p95: 0, p99: 0 };
  latencies.sort((a, b) => a - b);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || max;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || max;
  return { min, max, mean: Math.round(mean), p95, p99 };
}

async function executeRpc(client, billId, payments, idempotencyKey) {
  const start = Date.now();
  try {
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true);`);
    await client.query(`SELECT set_config('request.jwt.claim.cafe_id', '${CAFE_ID}', true);`);

    const res = await client.query(
      `SELECT public.settle_bill_and_close_session_atomic(
        $1::uuid,
        $2::uuid,
        $3::jsonb,
        $4::text,
        $5::uuid
      ) AS result;`,
      [billId, CAFE_ID, JSON.stringify(payments), idempotencyKey, OPERATOR_ID]
    );
    const duration = Date.now() - start;
    return { success: true, duration, result: res.rows[0].result };
  } catch (err) {
    const duration = Date.now() - start;
    return { success: false, duration, error: err.message, code: err.code };
  }
}

async function runConcurrenctWorkers(items, workerFn, concurrency = 50) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      const client = await pool.connect();
      try {
        const res = await workerFn(client, item, currentIndex);
        results[currentIndex] = res;
      } finally {
        client.release();
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

// -------------------------------------------------------------
// Test Suite
// -------------------------------------------------------------

const testReport = {
  executionDate: new Date().toISOString(),
  stagingHost: STAGING_HOST,
  deadlockCount: 0,
  tests: {},
  integrityChecks: {},
  summary: {}
};

async function main() {
  console.log('============================================================');
  console.log('MILESTONE 5: EXECUTING CONCURRENCY TESTS T1 – T12');
  console.log('============================================================');

  // Helper to re-seed clean state
  async function reseedAll() {
    const client = await pool.connect();
    try {
      await client.query(`
        TRUNCATE TABLE public.bill_settlement_idempotency,
                       public.bill_payments,
                       public.bill_orders,
                       public.bills,
                       public.orders,
                       public.dining_sessions,
                       public.tables
        CASCADE;
      `);

      const dineInTables = [];
      const dineInSessions = [];
      const dineInOrders = [];
      const dineInBills = [];
      const dineInBillOrders = [];

      for (let i = 1; i <= 500; i++) {
        const pad = String(i).padStart(4, '0');
        const tableId = `10000000-0000-0000-0000-${pad}00000001`;
        const sessionId = `20000000-0000-0000-0000-${pad}00000002`;
        const orderId = `30000000-0000-0000-0000-${pad}00000003`;
        const billId = `40000000-0000-0000-0000-${pad}00000004`;

        dineInTables.push(`('${tableId}', '${CAFE_ID}', 'T-${pad}', '${sessionId}', 'occupied')`);
        dineInSessions.push(`('${sessionId}', '${CAFE_ID}', '${tableId}', 'active')`);
        dineInOrders.push(`('${orderId}', '${CAFE_ID}', '${tableId}', '${sessionId}', 'pending', 'DINE_IN', 500.00)`);
        dineInBills.push(`('${billId}', '${CAFE_ID}', 'BILL-DINE-${pad}', '${sessionId}', 500.00, 'unpaid', 'DINE_IN')`);
        dineInBillOrders.push(`('${billId}', '${orderId}', '${CAFE_ID}', 'ACTIVE')`);
      }

      await client.query(`INSERT INTO public.tables (id, cafe_id, table_number, active_session_id, status) VALUES ${dineInTables.join(',')};`);
      await client.query(`INSERT INTO public.dining_sessions (id, cafe_id, table_id, status) VALUES ${dineInSessions.join(',')};`);
      await client.query(`INSERT INTO public.orders (id, cafe_id, table_id, session_id, status, order_source, total) VALUES ${dineInOrders.join(',')};`);
      await client.query(`INSERT INTO public.bills (id, cafe_id, bill_number, session_id, grand_total, payment_status, order_source) VALUES ${dineInBills.join(',')};`);
      await client.query(`INSERT INTO public.bill_orders (bill_id, order_id, cafe_id, association_status) VALUES ${dineInBillOrders.join(',')};`);

      const takeawayOrders = [];
      const takeawayBills = [];
      const takeawayBillOrders = [];

      for (let i = 1; i <= 250; i++) {
        const pad = String(i).padStart(4, '0');
        const orderId = `50000000-0000-0000-0000-${pad}00000001`;
        const billId = `60000000-0000-0000-0000-${pad}00000002`;

        takeawayOrders.push(`('${orderId}', '${CAFE_ID}', NULL, NULL, 'pending', 'TAKEAWAY', 300.00)`);
        takeawayBills.push(`('${billId}', '${CAFE_ID}', 'BILL-TAKE-${pad}', NULL, 300.00, 'unpaid', 'TAKEAWAY')`);
        takeawayBillOrders.push(`('${billId}', '${orderId}', '${CAFE_ID}', 'ACTIVE')`);
      }

      await client.query(`INSERT INTO public.orders (id, cafe_id, table_id, session_id, status, order_source, total) VALUES ${takeawayOrders.join(',')};`);
      await client.query(`INSERT INTO public.bills (id, cafe_id, bill_number, session_id, grand_total, payment_status, order_source) VALUES ${takeawayBills.join(',')};`);
      await client.query(`INSERT INTO public.bill_orders (bill_id, order_id, cafe_id, association_status) VALUES ${takeawayBillOrders.join(',')};`);
    } finally {
      client.release();
    }
  }

  // Initial fresh seed
  await reseedAll();

  // -----------------------------------------------------------
  // T1: 500 Independent Bills Parallel Settlement (50 workers)
  // -----------------------------------------------------------
  console.log('\n--- [TEST T1] 500 Independent Bills Parallel Settlement (50 workers) ---');
  const t1Items = [];
  for (let i = 1; i <= 500; i++) {
    const pad = String(i).padStart(4, '0');
    t1Items.push({
      billId: `40000000-0000-0000-0000-${pad}00000004`,
      payments: [{ method: 'CASH', amount_tendered_paise: 50000, amount_applied_paise: 50000, change_due_paise: 0 }],
      key: `idem_t1_${pad}`
    });
  }

  const t1Start = Date.now();
  const t1Results = await runConcurrenctWorkers(t1Items, async (client, item) => {
    return executeRpc(client, item.billId, item.payments, item.key);
  }, 50);
  const t1Duration = Date.now() - t1Start;

  const t1Successes = t1Results.filter(r => r.success).length;
  const t1Deadlocks = t1Results.filter(r => r.code === '40P01').length;
  testReport.deadlockCount += t1Deadlocks;
  const t1Latencies = t1Results.map(r => r.duration);
  const t1Stats = calculatePercentiles(t1Latencies);

  console.log(`  Duration: ${t1Duration}ms, Successes: ${t1Successes}/500, Deadlocks: ${t1Deadlocks}`);
  console.log(`  Latency: min=${t1Stats.min}ms, max=${t1Stats.max}ms, mean=${t1Stats.mean}ms, p95=${t1Stats.p95}ms, p99=${t1Stats.p99}ms`);
  const t1Passed = t1Successes === 500 && t1Deadlocks === 0;
  testReport.tests.T1 = { passed: t1Passed, total: 500, successes: t1Successes, deadlocks: t1Deadlocks, latency: t1Stats };
  console.log(`  T1 Verdict: ${t1Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T2: 500 Concurrent Workers, Same Bill, Identical Key (Double-Settle Race)
  // -----------------------------------------------------------
  console.log('\n--- [TEST T2] 500 Concurrent Workers, Same Bill, Identical Key ---');
  // Seed a dedicated bill for T2
  const t2BillId = '40000000-0000-0000-0000-000000000002';
  const t2OrderId = '30000000-0000-0000-0000-000000000002';
  const t2TableId = '10000000-0000-0000-0000-000000000002';
  const t2SessionId = '20000000-0000-0000-0000-000000000002';
  const t2Client = await pool.connect();
  await t2Client.query(`
    INSERT INTO public.tables (id, cafe_id, table_number, active_session_id, status) VALUES ('${t2TableId}', '${CAFE_ID}', 'T-T2', '${t2SessionId}', 'occupied');
    INSERT INTO public.dining_sessions (id, cafe_id, table_id, status) VALUES ('${t2SessionId}', '${CAFE_ID}', '${t2TableId}', 'active');
    INSERT INTO public.orders (id, cafe_id, table_id, session_id, status, order_source, total) VALUES ('${t2OrderId}', '${CAFE_ID}', '${t2TableId}', '${t2SessionId}', 'pending', 'DINE_IN', 500.00);
    INSERT INTO public.bills (id, cafe_id, bill_number, session_id, grand_total, payment_status, order_source) VALUES ('${t2BillId}', '${CAFE_ID}', 'BILL-T2', '${t2SessionId}', 500.00, 'unpaid', 'DINE_IN');
    INSERT INTO public.bill_orders (bill_id, order_id, cafe_id, association_status) VALUES ('${t2BillId}', '${t2OrderId}', '${CAFE_ID}', 'ACTIVE');
  `);
  t2Client.release();

  const t2Items = Array.from({ length: 500 }, () => ({
    billId: t2BillId,
    payments: [{ method: 'CASH', amount_tendered_paise: 50000, amount_applied_paise: 50000, change_due_paise: 0 }],
    key: 'idem_t2_race_key'
  }));

  const t2Results = await runConcurrenctWorkers(t2Items, async (client, item) => {
    return executeRpc(client, item.billId, item.payments, item.key);
  }, 50);

  const t2Successes = t2Results.filter(r => r.success).length;
  const t2Deadlocks = t2Results.filter(r => r.code === '40P01').length;
  testReport.deadlockCount += t2Deadlocks;

  const t2FreshCount = t2Results.filter(r => r.success && r.result.idempotent_replay === false).length;
  const t2ReplayCount = t2Results.filter(r => r.success && r.result.idempotent_replay === true).length;

  console.log(`  Total: 500, Successes: ${t2Successes}, Fresh Settlements: ${t2FreshCount}, Cached Replays: ${t2ReplayCount}, Deadlocks: ${t2Deadlocks}`);

  // Invariant verification on DB
  const t2VerifyClient = await pool.connect();
  const t2DbIdemRes = await t2VerifyClient.query(`SELECT COUNT(*) FROM public.bill_settlement_idempotency WHERE bill_id = '${t2BillId}';`);
  const t2DbPayRes = await t2VerifyClient.query(`SELECT COUNT(*) FROM public.bill_payments WHERE bill_id = '${t2BillId}';`);
  t2VerifyClient.release();

  const t2DbIdemCount = parseInt(t2DbIdemRes.rows[0].count);
  const t2DbPayCount = parseInt(t2DbPayRes.rows[0].count);
  console.log(`  DB Idempotency Records: ${t2DbIdemCount} (Expected 1), DB Payment Rows: ${t2DbPayCount} (Expected 1)`);

  const t2Passed = t2Successes === 500 && t2FreshCount === 1 && t2ReplayCount === 499 && t2DbIdemCount === 1 && t2DbPayCount === 1 && t2Deadlocks === 0;
  testReport.tests.T2 = { passed: t2Passed, freshCount: t2FreshCount, replayCount: t2ReplayCount, dbIdemCount: t2DbIdemCount, dbPayCount: t2DbPayCount, deadlocks: t2Deadlocks };
  console.log(`  T2 Verdict: ${t2Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T3: 500 Concurrent Workers, Same Bill, 500 DIFFERENT Keys (Competing Keys Race)
  // -----------------------------------------------------------
  console.log('\n--- [TEST T3] 500 Concurrent Workers, Same Unpaid Bill, 500 DIFFERENT Keys ---');
  const t3BillId = '40000000-0000-0000-0000-000000000003';
  const t3OrderId = '30000000-0000-0000-0000-000000000003';
  const t3TableId = '10000000-0000-0000-0000-000000000003';
  const t3SessionId = '20000000-0000-0000-0000-000000000003';
  const t3Client = await pool.connect();
  await t3Client.query(`
    INSERT INTO public.tables (id, cafe_id, table_number, active_session_id, status) VALUES ('${t3TableId}', '${CAFE_ID}', 'T-T3', '${t3SessionId}', 'occupied');
    INSERT INTO public.dining_sessions (id, cafe_id, table_id, status) VALUES ('${t3SessionId}', '${CAFE_ID}', '${t3TableId}', 'active');
    INSERT INTO public.orders (id, cafe_id, table_id, session_id, status, order_source, total) VALUES ('${t3OrderId}', '${CAFE_ID}', '${t3TableId}', '${t3SessionId}', 'pending', 'DINE_IN', 500.00);
    INSERT INTO public.bills (id, cafe_id, bill_number, session_id, grand_total, payment_status, order_source) VALUES ('${t3BillId}', '${CAFE_ID}', 'BILL-T3', '${t3SessionId}', 500.00, 'unpaid', 'DINE_IN');
    INSERT INTO public.bill_orders (bill_id, order_id, cafe_id, association_status) VALUES ('${t3BillId}', '${t3OrderId}', '${CAFE_ID}', 'ACTIVE');
  `);
  t3Client.release();

  const t3Items = Array.from({ length: 500 }, (_, i) => ({
    billId: t3BillId,
    payments: [{ method: 'CASH', amount_tendered_paise: 50000, amount_applied_paise: 50000, change_due_paise: 0 }],
    key: `idem_t3_competing_${String(i).padStart(4, '0')}`
  }));

  const t3Results = await runConcurrenctWorkers(t3Items, async (client, item) => {
    return executeRpc(client, item.billId, item.payments, item.key);
  }, 50);

  const t3Successes = t3Results.filter(r => r.success).length;
  const t3AlreadySettledCount = t3Results.filter(r => !r.success && r.error.includes('BILL_ALREADY_SETTLED')).length;
  const t3Deadlocks = t3Results.filter(r => r.code === '40P01').length;
  testReport.deadlockCount += t3Deadlocks;

  console.log(`  Total: 500, Successes: ${t3Successes} (Expected 1), BILL_ALREADY_SETTLED: ${t3AlreadySettledCount} (Expected 499), Deadlocks: ${t3Deadlocks}`);

  // Hardened T3 invariant checks on DB
  const t3VerifyClient = await pool.connect();
  const t3DbIdemRes = await t3VerifyClient.query(`SELECT COUNT(*) FROM public.bill_settlement_idempotency WHERE bill_id = '${t3BillId}';`);
  const t3DbPayRes = await t3VerifyClient.query(`SELECT COUNT(*) FROM public.bill_payments WHERE bill_id = '${t3BillId}';`);
  const t3BillStateRes = await t3VerifyClient.query(`SELECT payment_status FROM public.bills WHERE id = '${t3BillId}';`);
  const t3OrderStateRes = await t3VerifyClient.query(`SELECT status FROM public.orders WHERE id = '${t3OrderId}';`);
  const t3SessStateRes = await t3VerifyClient.query(`SELECT status FROM public.dining_sessions WHERE id = '${t3SessionId}';`);
  const t3TableStateRes = await t3VerifyClient.query(`SELECT active_session_id, status FROM public.tables WHERE id = '${t3TableId}';`);
  t3VerifyClient.release();

  const t3DbIdemCount = parseInt(t3DbIdemRes.rows[0].count);
  const t3DbPayCount = parseInt(t3DbPayRes.rows[0].count);
  const t3BillStatus = t3BillStateRes.rows[0].payment_status;
  const t3OrderStatus = t3OrderStateRes.rows[0].status;
  const t3SessStatus = t3SessStateRes.rows[0].status;
  const t3TableStatus = t3TableStateRes.rows[0].status;
  const t3TableActiveSess = t3TableStateRes.rows[0].active_session_id;

  console.log(`  T3 DB Invariants:`);
  console.log(`    Idempotency Records: ${t3DbIdemCount} (Expected 1)`);
  console.log(`    Payment Ledger Rows: ${t3DbPayCount} (Expected 1)`);
  console.log(`    Bill Payment Status: '${t3BillStatus}' (Expected 'paid')`);
  console.log(`    Order Status: '${t3OrderStatus}' (Expected 'served')`);
  console.log(`    Session Status: '${t3SessStatus}' (Expected 'closed')`);
  console.log(`    Table Status: '${t3TableStatus}' (Expected 'available'), active_session_id: ${t3TableActiveSess} (Expected null)`);

  const t3Passed = (
    t3Successes === 1 &&
    t3AlreadySettledCount === 499 &&
    t3DbIdemCount === 1 &&
    t3DbPayCount === 1 &&
    t3BillStatus === 'paid' &&
    t3OrderStatus === 'served' &&
    t3SessStatus === 'closed' &&
    t3TableStatus === 'available' &&
    t3TableActiveSess === null &&
    t3Deadlocks === 0
  );
  testReport.tests.T3 = { passed: t3Passed, successes: t3Successes, alreadySettled: t3AlreadySettledCount, dbIdemCount: t3DbIdemCount, dbPayCount: t3DbPayCount, deadlocks: t3Deadlocks };
  console.log(`  T3 Verdict: ${t3Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T4: 250 Dine-In + 250 Takeaway Mixed Batch (50 workers)
  // -----------------------------------------------------------
  console.log('\n--- [TEST T4] 250 Dine-In + 250 Takeaway Mixed Batch (50 workers) ---');
  // Re-seed to ensure fresh 250 Dine-In + 250 Takeaway
  await reseedAll();

  const t4Items = [];
  // 250 Dine-In
  for (let i = 1; i <= 250; i++) {
    const pad = String(i).padStart(4, '0');
    t4Items.push({
      billId: `40000000-0000-0000-0000-${pad}00000004`,
      payments: [{ method: 'CASH', amount_tendered_paise: 50000, amount_applied_paise: 50000, change_due_paise: 0 }],
      key: `idem_t4_dine_${pad}`
    });
  }
  // 250 Takeaway
  for (let i = 1; i <= 250; i++) {
    const pad = String(i).padStart(4, '0');
    t4Items.push({
      billId: `60000000-0000-0000-0000-${pad}00000002`,
      payments: [{ method: 'CASH', amount_tendered_paise: 30000, amount_applied_paise: 30000, change_due_paise: 0 }],
      key: `idem_t4_take_${pad}`
    });
  }

  const t4Results = await runConcurrenctWorkers(t4Items, async (client, item) => {
    return executeRpc(client, item.billId, item.payments, item.key);
  }, 50);

  const t4Successes = t4Results.filter(r => r.success).length;
  const t4Deadlocks = t4Results.filter(r => r.code === '40P01').length;
  testReport.deadlockCount += t4Deadlocks;

  // Invariant verification on DB
  const t4VerifyClient = await pool.connect();
  const t4ClosedDineSessions = await t4VerifyClient.query(`SELECT COUNT(*) FROM public.dining_sessions WHERE status = 'closed';`);
  const t4ReleasedDineTables = await t4VerifyClient.query(`SELECT COUNT(*) FROM public.tables WHERE status = 'available' AND active_session_id IS NULL;`);
  t4VerifyClient.release();

  console.log(`  Total: 500, Successes: ${t4Successes}/500, Deadlocks: ${t4Deadlocks}`);
  console.log(`  Closed Dine-In Sessions: ${t4ClosedDineSessions.rows[0].count}/250, Released Dine-In Tables: ${t4ReleasedDineTables.rows[0].count}/250`);

  const t4Passed = t4Successes === 500 && parseInt(t4ClosedDineSessions.rows[0].count) === 250 && parseInt(t4ReleasedDineTables.rows[0].count) === 250 && t4Deadlocks === 0;
  testReport.tests.T4 = { passed: t4Passed, successes: t4Successes, deadlocks: t4Deadlocks };
  console.log(`  T4 Verdict: ${t4Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T5: Sequential Replay Against Paid Bill
  // -----------------------------------------------------------
  console.log('\n--- [TEST T5] Sequential Replay Against Paid Bill ---');
  const t5BillId = `40000000-0000-0000-0000-000100000004`; // Already paid in T4
  const t5Key = `idem_t4_dine_0001`;
  const t5Client = await pool.connect();
  const t5Res = await executeRpc(t5Client, t5BillId, [{ method: 'CASH', amount_tendered_paise: 50000, amount_applied_paise: 50000, change_due_paise: 0 }], t5Key);
  t5Client.release();

  const t5Passed = t5Res.success && t5Res.result.status === 'SUCCESS' && t5Res.result.idempotent_replay === true;
  console.log(`  Replay Result: success=${t5Res.success}, idempotent_replay=${t5Res.result?.idempotent_replay}`);
  testReport.tests.T5 = { passed: t5Passed, result: t5Res };
  console.log(`  T5 Verdict: ${t5Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T6: Settlement Attempt Against Voided Bill
  // -----------------------------------------------------------
  console.log('\n--- [TEST T6] Settlement Attempt Against Voided Bill ---');
  const t6BillId = '40000000-0000-0000-0000-000000000006';
  const t6Client = await pool.connect();
  await t6Client.query(`
    INSERT INTO public.bills (id, cafe_id, bill_number, session_id, grand_total, payment_status, order_source)
    VALUES ('${t6BillId}', '${CAFE_ID}', 'BILL-T6-VOID', NULL, 100.00, 'voided', 'TAKEAWAY')
    ON CONFLICT (id) DO NOTHING;
  `);
  const t6Res = await executeRpc(t6Client, t6BillId, [{ method: 'CASH', amount_tendered_paise: 10000, amount_applied_paise: 10000, change_due_paise: 0 }], 'idem_t6_void');
  t6Client.release();

  const t6Passed = !t6Res.success && t6Res.error.includes('BILL_VOIDED');
  console.log(`  Result: success=${t6Res.success}, error="${t6Res.error}"`);
  testReport.tests.T6 = { passed: t6Passed, error: t6Res.error };
  console.log(`  T6 Verdict: ${t6Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T7: Same Idempotency Key with Modified Financial Payload
  // -----------------------------------------------------------
  console.log('\n--- [TEST T7] Same Idempotency Key with Modified Financial Payload ---');
  const t7BillId = t5BillId; // Paid in T4 with applied 50000
  const t7Key = t5Key;
  const t7Client = await pool.connect();
  // Alter amount_tendered from 50000 to 60000
  const t7Res = await executeRpc(t7Client, t7BillId, [{ method: 'CASH', amount_tendered_paise: 60000, amount_applied_paise: 50000, change_due_paise: 10000 }], t7Key);
  t7Client.release();

  const t7Passed = !t7Res.success && t7Res.error.includes('IDEMPOTENCY_KEY_REUSE_CONFLICT');
  console.log(`  Result: success=${t7Res.success}, error="${t7Res.error}"`);
  testReport.tests.T7 = { passed: t7Passed, error: t7Res.error };
  console.log(`  T7 Verdict: ${t7Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T8: Sequential Competing Keys on Same Bill
  // -----------------------------------------------------------
  console.log('\n--- [TEST T8] Sequential Competing Keys on Same Bill ---');
  const t8BillId = t5BillId; // Already paid under t5Key
  const t8Key = 'idem_t8_different_competing_key';
  const t8Client = await pool.connect();
  const t8Res = await executeRpc(t8Client, t8BillId, [{ method: 'CASH', amount_tendered_paise: 50000, amount_applied_paise: 50000, change_due_paise: 0 }], t8Key);
  t8Client.release();

  const t8Passed = !t8Res.success && t8Res.error.includes('BILL_ALREADY_SETTLED');
  console.log(`  Result: success=${t8Res.success}, error="${t8Res.error}"`);
  testReport.tests.T8 = { passed: t8Passed, error: t8Res.error };
  console.log(`  T8 Verdict: ${t8Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T9: Same Idempotency Key Across Differing Bills
  // -----------------------------------------------------------
  console.log('\n--- [TEST T9] Same Idempotency Key Across Differing Bills ---');
  const t9BillId = `40000000-0000-0000-0000-000200000004`; // Different bill
  const t9Key = t5Key; // Key used for bill 0001
  const t9Client = await pool.connect();
  const t9Res = await executeRpc(t9Client, t9BillId, [{ method: 'CASH', amount_tendered_paise: 50000, amount_applied_paise: 50000, change_due_paise: 0 }], t9Key);
  t9Client.release();

  const t9Passed = !t9Res.success && t9Res.error.includes('IDEMPOTENCY_KEY_REUSE_CONFLICT');
  console.log(`  Result: success=${t9Res.success}, error="${t9Res.error}"`);
  testReport.tests.T9 = { passed: t9Passed, error: t9Res.error };
  console.log(`  T9 Verdict: ${t9Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T10: Concurrent Split Tender (CASH + UPI, 100 Workers)
  // -----------------------------------------------------------
  console.log('\n--- [TEST T10] Concurrent Split Tender (CASH + UPI, 100 Workers) ---');
  const t10BillId = '40000000-0000-0000-0000-000000000010';
  const t10OrderId = '30000000-0000-0000-0000-000000000010';
  const t10TableId = '10000000-0000-0000-0000-000000000010';
  const t10SessionId = '20000000-0000-0000-0000-000000000010';
  const t10Client = await pool.connect();
  await t10Client.query(`
    INSERT INTO public.tables (id, cafe_id, table_number, active_session_id, status) VALUES ('${t10TableId}', '${CAFE_ID}', 'T-T10', '${t10SessionId}', 'occupied') ON CONFLICT DO NOTHING;
    INSERT INTO public.dining_sessions (id, cafe_id, table_id, status) VALUES ('${t10SessionId}', '${CAFE_ID}', '${t10TableId}', 'active') ON CONFLICT DO NOTHING;
    INSERT INTO public.orders (id, cafe_id, table_id, session_id, status, order_source, total) VALUES ('${t10OrderId}', '${CAFE_ID}', '${t10TableId}', '${t10SessionId}', 'pending', 'DINE_IN', 500.00) ON CONFLICT DO NOTHING;
    INSERT INTO public.bills (id, cafe_id, bill_number, session_id, grand_total, payment_status, order_source) VALUES ('${t10BillId}', '${CAFE_ID}', 'BILL-T10', '${t10SessionId}', 500.00, 'unpaid', 'DINE_IN') ON CONFLICT DO NOTHING;
    INSERT INTO public.bill_orders (bill_id, order_id, cafe_id, association_status) VALUES ('${t10BillId}', '${t10OrderId}', '${CAFE_ID}', 'ACTIVE') ON CONFLICT DO NOTHING;
  `);
  t10Client.release();

  // Split: 30000 paise UPI + 20000 paise CASH (tendered 25000, change 5000)
  const splitPayments = [
    { method: 'UPI', amount_tendered_paise: 30000, amount_applied_paise: 30000, change_due_paise: 0, transaction_reference: 'UPI_REF_9999' },
    { method: 'CASH', amount_tendered_paise: 25000, amount_applied_paise: 20000, change_due_paise: 5000, transaction_reference: null }
  ];

  const t10Items = Array.from({ length: 100 }, () => ({
    billId: t10BillId,
    payments: splitPayments,
    key: 'idem_t10_split_race_key'
  }));

  const t10Results = await runConcurrenctWorkers(t10Items, async (client, item) => {
    return executeRpc(client, item.billId, item.payments, item.key);
  }, 50);

  const t10Successes = t10Results.filter(r => r.success).length;
  const t10FreshCount = t10Results.filter(r => r.success && r.result.idempotent_replay === false).length;
  const t10ReplayCount = t10Results.filter(r => r.success && r.result.idempotent_replay === true).length;
  const t10Deadlocks = t10Results.filter(r => r.code === '40P01').length;
  testReport.deadlockCount += t10Deadlocks;

  const t10VerifyClient = await pool.connect();
  const t10DbPayRes = await t10VerifyClient.query(`SELECT payment_method, amount_applied_paise, change_due_paise FROM public.bill_payments WHERE bill_id = '${t10BillId}' ORDER BY payment_method;`);
  t10VerifyClient.release();

  const t10PayRows = t10DbPayRes.rows;
  console.log(`  Total: 100, Successes: ${t10Successes}, Fresh: ${t10FreshCount}, Replays: ${t10ReplayCount}`);
  console.log(`  Payment Ledger Rows: ${t10PayRows.length} (Expected exactly 2: CASH & UPI)`);

  const t10Passed = t10Successes === 100 && t10FreshCount === 1 && t10ReplayCount === 99 && t10PayRows.length === 2 && t10Deadlocks === 0;
  testReport.tests.T10 = { passed: t10Passed, successes: t10Successes, freshCount: t10FreshCount, replayCount: t10ReplayCount, ledgerRows: t10PayRows.length, deadlocks: t10Deadlocks };
  console.log(`  T10 Verdict: ${t10Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T11: Cross-Tenant Bill/Order Association Attempt
  // -----------------------------------------------------------
  console.log('\n--- [TEST T11] Cross-Tenant Bill/Order Association Attempt ---');
  const t11Client = await pool.connect();
  let t11Error = null;
  try {
    // 1. Create a foreign cafe and a foreign order
    await t11Client.query(`
      INSERT INTO public.cafes (id, name) VALUES ('${FOREIGN_CAFE_ID}', 'Foreign Cafe') ON CONFLICT DO NOTHING;
      INSERT INTO public.orders (id, cafe_id, status, order_source, total)
      VALUES ('70000000-0000-0000-0000-000000000011', '${FOREIGN_CAFE_ID}', 'pending', 'TAKEAWAY', 100.00)
      ON CONFLICT DO NOTHING;
    `);

    // 2. Attempt to link Bill (belonging to CAFE_ID) with Order (belonging to FOREIGN_CAFE_ID)
    // Specifying cafe_id = CAFE_ID causes fk_bill_orders_order to fail because (order_id, CAFE_ID) does not exist in orders
    await t11Client.query(`
      INSERT INTO public.bill_orders (bill_id, order_id, cafe_id, association_status)
      VALUES ('${t10BillId}', '70000000-0000-0000-0000-000000000011', '${CAFE_ID}', 'ACTIVE');
    `);
  } catch (err) {
    t11Error = err.message;
  }
  t11Client.release();

  const t11Passed = t11Error !== null && (t11Error.includes('violates foreign key constraint') || t11Error.includes('foreign key'));
  console.log(`  Result: error="${t11Error}"`);
  testReport.tests.T11 = { passed: t11Passed, error: t11Error };
  console.log(`  T11 Verdict: ${t11Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // T12: Duplicate ACTIVE Order Association Attempt
  // -----------------------------------------------------------
  console.log('\n--- [TEST T12] Duplicate ACTIVE Order Association Attempt ---');
  const t12Client = await pool.connect();
  let t12Error = null;
  try {
    // Order t10OrderId is already ACTIVE on t10BillId. Attempt to link it ACTIVE to t2BillId.
    await t12Client.query(`
      INSERT INTO public.bill_orders (bill_id, order_id, cafe_id, association_status)
      VALUES ('${t2BillId}', '${t10OrderId}', '${CAFE_ID}', 'ACTIVE');
    `);
  } catch (err) {
    t12Error = err.message;
  }
  t12Client.release();

  const t12Passed = t12Error !== null && t12Error.includes('idx_remote_bill_orders_active_unique');
  console.log(`  Result: error="${t12Error}"`);
  testReport.tests.T12 = { passed: t12Passed, error: t12Error };
  console.log(`  T12 Verdict: ${t12Passed ? 'PASS' : 'FAIL'}`);

  // -----------------------------------------------------------
  // Milestone 6: Post-Test Automated Integrity Checks A – I
  // -----------------------------------------------------------
  console.log('\n============================================================');
  console.log('MILESTONE 6: EXECUTING INTEGRITY CHECKS A – I');
  console.log('============================================================');

  const checkClient = await pool.connect();

  async function runIntegrityCheck(checkId, title, sql) {
    process.stdout.write(`  [CHECK ${checkId}] ${title} ... `);
    const res = await checkClient.query(sql);
    const violatingRows = res.rows.length;
    const passed = violatingRows === 0;
    console.log(passed ? `PASSED (0 violating rows)` : `FAILED (${violatingRows} violating rows)`);
    testReport.integrityChecks[checkId] = { title, passed, violatingRows, rows: res.rows };
    return passed;
  }

  // Check A: Exactly 1 idempotency record per paid bill
  await runIntegrityCheck('A', 'No paid bill without exactly one idempotency record', `
    SELECT b.id AS bill_id, COUNT(bsi.id) AS idem_count
    FROM public.bills b
    LEFT JOIN public.bill_settlement_idempotency bsi ON bsi.bill_id = b.id
    WHERE b.payment_status = 'paid'
    GROUP BY b.id
    HAVING COUNT(bsi.id) != 1;
  `);

  // Check B: Zero duplicate successful idempotency keys
  await runIntegrityCheck('B', 'Zero duplicate successful idempotency keys', `
    SELECT idempotency_key, COUNT(*)
    FROM public.bill_settlement_idempotency
    WHERE result_status = 'SUCCESS'
    GROUP BY idempotency_key
    HAVING COUNT(*) > 1;
  `);

  // Check C: Exact paise ledger balance (SUM(applied) = grand_total)
  await runIntegrityCheck('C', 'Exact paise ledger balance (SUM(applied) = grand_total)', `
    SELECT b.id AS bill_id, 
           ROUND(b.grand_total * 100)::BIGINT AS expected_paise,
           COALESCE(SUM(bp.amount_applied_paise), 0) AS actual_applied_paise
    FROM public.bills b
    LEFT JOIN public.bill_payments bp ON bp.bill_id = b.id
    WHERE b.payment_status = 'paid'
    GROUP BY b.id, b.grand_total
    HAVING ROUND(b.grand_total * 100)::BIGINT != COALESCE(SUM(bp.amount_applied_paise), 0);
  `);

  // Check D: Zero orders with multiple ACTIVE bill associations
  await runIntegrityCheck('D', 'Zero orders with multiple ACTIVE bill associations', `
    SELECT bo.order_id, COUNT(DISTINCT bo.bill_id) AS active_bill_count
    FROM public.bill_orders bo
    WHERE bo.association_status = 'ACTIVE'
    GROUP BY bo.order_id
    HAVING COUNT(DISTINCT bo.bill_id) > 1;
  `);

  // Check E: Zero cross-tenant associations
  await runIntegrityCheck('E', 'Zero cross-tenant associations in bill_orders or bill_payments', `
    SELECT bo.id, 'bill_orders' as source
    FROM public.bill_orders bo
    JOIN public.bills b ON b.id = bo.bill_id
    JOIN public.orders o ON o.id = bo.order_id
    WHERE bo.cafe_id != b.cafe_id OR bo.cafe_id != o.cafe_id
    UNION ALL
    SELECT bp.id, 'bill_payments' as source
    FROM public.bill_payments bp
    JOIN public.bills b ON b.id = bp.bill_id
    WHERE bp.cafe_id != b.cafe_id;
  `);

  // Check F: Zero Dine-In paid bills with active session
  await runIntegrityCheck('F', 'Zero Dine-In paid bills with active session', `
    SELECT b.id AS bill_id, ds.id AS session_id, ds.status AS session_status
    FROM public.bills b
    JOIN public.dining_sessions ds ON ds.id::text = b.session_id
    WHERE b.order_source = 'DINE_IN'
      AND b.payment_status = 'paid'
      AND ds.status != 'closed';
  `);

  // Check G: Zero tables pointing to closed sessions
  await runIntegrityCheck('G', 'Zero tables pointing to closed sessions', `
    SELECT b.id AS bill_id, t.id AS table_id, t.active_session_id
    FROM public.bills b
    JOIN public.tables t ON t.active_session_id = b.session_id
    WHERE b.order_source = 'DINE_IN'
      AND b.payment_status = 'paid'
      AND t.active_session_id IS NOT NULL;
  `);

  // Check H: Zero non-Dine-In bills with session/table
  await runIntegrityCheck('H', 'Zero non-Dine-In bills with session or table', `
    SELECT b.id AS bill_id, b.order_source, b.session_id
    FROM public.bills b
    WHERE b.order_source IN ('TAKEAWAY', 'SWIGGY', 'ZOMATO')
      AND b.session_id IS NOT NULL;
  `);

  // Check I: Every paid bill has >= 1 payment ledger row
  await runIntegrityCheck('I', 'Every paid bill has >= 1 payment ledger row', `
    SELECT b.id AS bill_id, COUNT(bp.id) AS payment_row_count
    FROM public.bills b
    LEFT JOIN public.bill_payments bp ON bp.bill_id = b.id
    WHERE b.payment_status = 'paid'
    GROUP BY b.id
    HAVING COUNT(bp.id) = 0;
  `);

  checkClient.release();

  // Summary
  const allTestsPassed = Object.values(testReport.tests).every(t => t.passed);
  const allChecksPassed = Object.values(testReport.integrityChecks).every(c => c.passed);
  const totalDeadlocks = testReport.deadlockCount;

  testReport.summary = {
    allTestsPassed,
    allChecksPassed,
    totalDeadlocks,
    gate0dVerdict: allTestsPassed && allChecksPassed && totalDeadlocks === 0 ? 'PASS' : 'FAIL'
  };

  console.log('\n============================================================');
  console.log(`CONCURRENCY TESTS SUMMARY: ${Object.keys(testReport.tests).length} Tests Executed. All Passed: ${allTestsPassed}`);
  console.log(`INTEGRITY CHECKS SUMMARY: ${Object.keys(testReport.integrityChecks).length} Checks Executed. All Passed: ${allChecksPassed}`);
  console.log(`TOTAL DEADLOCKS (SQLSTATE 40P01): ${totalDeadlocks}`);
  console.log(`OVERALL MILESTONE 5 & 6 VERDICT: ${testReport.summary.gate0dVerdict}`);
  console.log('============================================================\n');

  // Output test report to JSON file for milestone report generation
  const fs = require('fs');
  fs.writeFileSync('phase0/gate_0d/raw_results.json', JSON.stringify(testReport, null, 2));
  console.log('Saved raw results to phase0/gate_0d/raw_results.json');
}

main().catch(err => {
  console.error('HARNESS FATAL ERROR:', err);
  process.exit(1);
}).finally(() => {
  pool.end();
});
