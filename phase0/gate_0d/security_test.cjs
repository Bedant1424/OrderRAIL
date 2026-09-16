/**
 * Milestone 3: RPC Security & Explicit Negative Tests
 * Specification: gate_0d_execution_ready_spec.md v2.1.0-EXECUTION-READY
 */

const { Client } = require('pg');

const STAGING_HOST = 'db.nmlrggmiksxwxptrcntb.supabase.co';
const CAFE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const FOREIGN_CAFE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OPERATOR_ID = '11111111-1111-1111-1111-111111111111';

async function runSecurityTests() {
  console.log('============================================================');
  console.log('MILESTONE 3: RPC SECURITY & NEGATIVE VALIDATION TESTS');
  console.log('============================================================');

  const client = new Client({
    host: STAGING_HOST,
    port: 5432,
    user: 'test_runner',
    password: 'StagingSecretPassword123!',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const results = [];

  async function assertRpcError(name, setupSql, rpcCallSql, expectedErrorSubstr) {
    process.stdout.write(`  [TEST] ${name} ... `);
    try {
      await client.query('BEGIN;');
      if (setupSql) await client.query(setupSql);
      let errorThrown = null;
      try {
        await client.query(rpcCallSql);
      } catch (err) {
        errorThrown = err;
      }

      await client.query('ROLLBACK;');

      if (!errorThrown) {
        console.log('FAILED (Expected error but succeeded)');
        results.push({ name, passed: false, reason: 'Expected error but succeeded' });
        return;
      }

      if (errorThrown.message.includes(expectedErrorSubstr)) {
        console.log(`PASSED (Caught expected error: "${expectedErrorSubstr}")`);
        results.push({ name, passed: true, error: errorThrown.message });
      } else {
        console.log(`FAILED (Expected "${expectedErrorSubstr}", got "${errorThrown.message}")`);
        results.push({ name, passed: false, reason: `Error mismatch: ${errorThrown.message}` });
      }
    } catch (err) {
      console.log(`FAILED with setup/harness error: ${err.message}`);
      results.push({ name, passed: false, reason: err.message });
      try { await client.query('ROLLBACK;'); } catch (e) {}
    }
  }

  try {
    // Negative Test 1: Anonymous invocation
    await assertRpcError(
      'Anonymous invocation (role=anon)',
      `SELECT set_config('request.jwt.claim.role', 'anon', true);`,
      `SELECT public.settle_bill_and_close_session_atomic(
        gen_random_uuid(),
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":1000,"amount_applied_paise":1000,"change_due_paise":0}]'::jsonb,
        'idem_anon_test',
        '${OPERATOR_ID}'
      );`,
      'UNAUTHORIZED: Anonymous callers cannot execute bill settlement'
    );

    // Negative Test 2: Missing operator
    await assertRpcError(
      'Missing operator (operator_id=NULL)',
      `SELECT set_config('request.jwt.claim.role', 'authenticated', true);`,
      `SELECT public.settle_bill_and_close_session_atomic(
        gen_random_uuid(),
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":1000,"amount_applied_paise":1000,"change_due_paise":0}]'::jsonb,
        'idem_missing_op',
        NULL
      );`,
      'OPERATOR_REQUIRED: Settlement requires an authenticated operator ID'
    );

    // Negative Test 3: Foreign tenant invocation
    await assertRpcError(
      'Foreign tenant (JWT claim cafe_id mismatch)',
      `SELECT set_config('request.jwt.claim.role', 'authenticated', true);
       SELECT set_config('request.jwt.claim.cafe_id', '${FOREIGN_CAFE_ID}', true);`,
      `SELECT public.settle_bill_and_close_session_atomic(
        gen_random_uuid(),
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":1000,"amount_applied_paise":1000,"change_due_paise":0}]'::jsonb,
        'idem_foreign_tenant',
        '${OPERATOR_ID}'
      );`,
      'CROSS_TENANT_FORBIDDEN: Caller is not authorized for cafe'
    );

    // Negative Test 4: Empty payments payload
    await assertRpcError(
      'Empty payments payload',
      `SELECT set_config('request.jwt.claim.role', 'authenticated', true);
       SELECT set_config('request.jwt.claim.cafe_id', '${CAFE_ID}', true);`,
      `SELECT public.settle_bill_and_close_session_atomic(
        gen_random_uuid(),
        '${CAFE_ID}',
        '[]'::jsonb,
        'idem_empty_pay',
        '${OPERATOR_ID}'
      );`,
      'EMPTY_PAYMENTS_PAYLOAD'
    );

    // Negative Test 5: Invalid/empty idempotency key
    await assertRpcError(
      'Invalid empty idempotency key',
      `SELECT set_config('request.jwt.claim.role', 'authenticated', true);
       SELECT set_config('request.jwt.claim.cafe_id', '${CAFE_ID}', true);`,
      `SELECT public.settle_bill_and_close_session_atomic(
        gen_random_uuid(),
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":1000,"amount_applied_paise":1000,"change_due_paise":0}]'::jsonb,
        '   ',
        '${OPERATOR_ID}'
      );`,
      'INVALID_IDEMPOTENCY_KEY'
    );

    // Negative Test 6: Settle non-existent bill
    await assertRpcError(
      'Non-existent bill ID',
      `SELECT set_config('request.jwt.claim.role', 'authenticated', true);
       SELECT set_config('request.jwt.claim.cafe_id', '${CAFE_ID}', true);`,
      `SELECT public.settle_bill_and_close_session_atomic(
        gen_random_uuid(),
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":1000,"amount_applied_paise":1000,"change_due_paise":0}]'::jsonb,
        'idem_nonexist_bill',
        '${OPERATOR_ID}'
      );`,
      'BILL_NOT_FOUND'
    );

    // Setup for tests requiring a bill in DB
    const setupBillSql = `
      SELECT set_config('request.jwt.claim.role', 'authenticated', true);
      SELECT set_config('request.jwt.claim.cafe_id', '${CAFE_ID}', true);

      INSERT INTO public.tables (id, cafe_id, table_number, status)
      VALUES ('22222222-2222-2222-2222-222222222222', '${CAFE_ID}', 'T-NEG', 'occupied')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.dining_sessions (id, cafe_id, table_id, status)
      VALUES ('33333333-3333-3333-3333-333333333333', '${CAFE_ID}', '22222222-2222-2222-2222-222222222222', 'active')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.orders (id, cafe_id, table_id, session_id, status, order_source, total)
      VALUES ('44444444-4444-4444-4444-444444444444', '${CAFE_ID}', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'pending', 'DINE_IN', 100.00)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.bills (id, cafe_id, bill_number, session_id, grand_total, payment_status, order_source)
      VALUES ('55555555-5555-5555-5555-555555555555', '${CAFE_ID}', 'BILL-NEG-01', '33333333-3333-3333-3333-333333333333', 100.00, 'voided', 'DINE_IN')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.bill_orders (bill_id, order_id, cafe_id, association_status)
      VALUES ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', '${CAFE_ID}', 'ACTIVE')
      ON CONFLICT DO NOTHING;
    `;

    // Negative Test 7: Voided bill
    await assertRpcError(
      'Attempt settlement on voided bill',
      setupBillSql,
      `SELECT public.settle_bill_and_close_session_atomic(
        '55555555-5555-5555-5555-555555555555',
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":10000,"amount_applied_paise":10000,"change_due_paise":0}]'::jsonb,
        'idem_voided_bill',
        '${OPERATOR_ID}'
      );`,
      'BILL_VOIDED'
    );

    // Negative Test 8: Already paid bill
    const setupPaidBillSql = setupBillSql + `
      UPDATE public.bills SET payment_status = 'paid' WHERE id = '55555555-5555-5555-5555-555555555555';
    `;
    await assertRpcError(
      'Attempt settlement on already-paid bill',
      setupPaidBillSql,
      `SELECT public.settle_bill_and_close_session_atomic(
        '55555555-5555-5555-5555-555555555555',
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":10000,"amount_applied_paise":10000,"change_due_paise":0}]'::jsonb,
        'idem_paid_bill',
        '${OPERATOR_ID}'
      );`,
      'BILL_ALREADY_SETTLED'
    );

    // Negative Test 9: Channel violation (Dine-In with session_id = NULL)
    const setupNullSessionSql = setupBillSql + `
      UPDATE public.bills SET payment_status = 'unpaid', session_id = NULL WHERE id = '55555555-5555-5555-5555-555555555555';
    `;
    await assertRpcError(
      'Channel violation: Dine-In bill with NULL session_id',
      setupNullSessionSql,
      `SELECT public.settle_bill_and_close_session_atomic(
        '55555555-5555-5555-5555-555555555555',
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":10000,"amount_applied_paise":10000,"change_due_paise":0}]'::jsonb,
        'idem_null_session',
        '${OPERATOR_ID}'
      );`,
      'CHANNEL_VIOLATION: Dine-In bill'
    );

    // Negative Test 10: Invalid split tender math (tendered != applied + change)
    const setupUnpaidBillSql = setupBillSql + `
      UPDATE public.bills SET payment_status = 'unpaid' WHERE id = '55555555-5555-5555-5555-555555555555';
    `;
    await assertRpcError(
      'Invalid tender math (tendered != applied + change)',
      setupUnpaidBillSql,
      `SELECT public.settle_bill_and_close_session_atomic(
        '55555555-5555-5555-5555-555555555555',
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":10000,"amount_applied_paise":10000,"change_due_paise":500}]'::jsonb,
        'idem_invalid_math',
        '${OPERATOR_ID}'
      );`,
      'INVALID_TENDER_MATH'
    );

    // Negative Test 11: Non-CASH change prohibited
    await assertRpcError(
      'Non-CASH change prohibited (UPI with change_due > 0)',
      setupUnpaidBillSql,
      `SELECT public.settle_bill_and_close_session_atomic(
        '55555555-5555-5555-5555-555555555555',
        '${CAFE_ID}',
        '[{"method":"UPI","amount_tendered_paise":10500,"amount_applied_paise":10000,"change_due_paise":500}]'::jsonb,
        'idem_upi_change',
        '${OPERATOR_ID}'
      );`,
      'NON_CASH_CHANGE_PROHIBITED'
    );

    // Negative Test 12: Amount mismatch (applied != grand_total)
    await assertRpcError(
      'Amount mismatch (applied != grand_total)',
      setupUnpaidBillSql,
      `SELECT public.settle_bill_and_close_session_atomic(
        '55555555-5555-5555-5555-555555555555',
        '${CAFE_ID}',
        '[{"method":"CASH","amount_tendered_paise":8000,"amount_applied_paise":8000,"change_due_paise":0}]'::jsonb,
        'idem_amount_mismatch',
        '${OPERATOR_ID}'
      );`,
      'AMOUNT_MISMATCH'
    );

    console.log('\n============================================================');
    const passed = results.filter(r => r.passed).length;
    console.log(`MILESTONE 3 RESULT: ${passed} / ${results.length} PASSED`);
    console.log('============================================================');

    if (passed !== results.length) {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

runSecurityTests().catch(err => {
  console.error('SECURITY TESTS FATAL FAILURE:', err.message);
  process.exit(1);
});
