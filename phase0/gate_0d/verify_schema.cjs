/**
 * Milestone 2: Staging Schema Verification Script
 * Validates all schema objects, indices, and constraints in the staging database.
 */

const { Client } = require('pg');

const STAGING_HOST = 'db.nmlrggmiksxwxptrcntb.supabase.co';

async function verifySchema() {
  console.log('============================================================');
  console.log('MILESTONE 2: STAGING SCHEMA VERIFICATION');
  console.log('============================================================');

  const client = new Client({
    host: STAGING_HOST,
    port: 5432,
    user: 'test_runner',
    password: 'StagingSecretPassword123!',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 1. Verify Tables
    const requiredTables = [
      'cafes', 'tables', 'dining_sessions', 'orders',
      'bills', 'bill_orders', 'bill_payments', 'bill_settlement_idempotency'
    ];

    console.log('[SCHEMA CHECK 1] Verifying presence of required tables...');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    const existingTables = new Set(tablesRes.rows.map(r => r.table_name));

    for (const tbl of requiredTables) {
      if (!existingTables.has(tbl)) {
        throw new Error(`Missing required table in public schema: ${tbl}`);
      }
      console.log(`  ✓ public.${tbl} exists`);
    }

    // 2. Verify Partial Unique Index on bill_orders
    console.log('[SCHEMA CHECK 2] Verifying partial unique index idx_remote_bill_orders_active_unique...');
    const indexRes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'bill_orders' AND indexname = 'idx_remote_bill_orders_active_unique';
    `);

    if (indexRes.rows.length === 0) {
      throw new Error('Missing partial unique index: idx_remote_bill_orders_active_unique');
    }
    const idxDef = indexRes.rows[0].indexdef;
    console.log(`  ✓ Index definition: ${idxDef}`);
    if (!idxDef.includes('WHERE (association_status = \'ACTIVE\'::text)') &&
        !idxDef.includes('WHERE (association_status = \'ACTIVE\')')) {
      throw new Error(`Partial unique index predicate mismatch: ${idxDef}`);
    }
    console.log('  ✓ Partial unique index verified with exact ACTIVE filter.');

    // 3. Verify Constraints on bill_payments
    console.log('[SCHEMA CHECK 3] Verifying tender math constraints on bill_payments...');
    const chkRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as condef
      FROM pg_constraint
      WHERE conrelid = 'public.bill_payments'::regclass AND contype = 'c';
    `);
    const constraints = chkRes.rows.map(r => r.conname);
    console.log('  Found constraints:', constraints);
    if (!constraints.includes('chk_tender_math')) {
      throw new Error('Missing constraint chk_tender_math on bill_payments');
    }
    if (!constraints.includes('chk_non_cash_zero_change')) {
      throw new Error('Missing constraint chk_non_cash_zero_change on bill_payments');
    }
    console.log('  ✓ chk_tender_math and chk_non_cash_zero_change verified.');

    // 4. Verify RPC Function Signature & Security
    console.log('[SCHEMA CHECK 4] Verifying settle_bill_and_close_session_atomic attributes...');
    const funcRes = await client.query(`
      SELECT proname, prosecdef, prosrc, proconfig
      FROM pg_proc
      WHERE proname = 'settle_bill_and_close_session_atomic';
    `);

    if (funcRes.rows.length === 0) {
      throw new Error('Missing function public.settle_bill_and_close_session_atomic');
    }
    const func = funcRes.rows[0];
    if (!func.prosecdef) {
      throw new Error('Function is NOT SECURITY DEFINER');
    }
    console.log('  ✓ Function is SECURITY DEFINER');

    const configStr = (func.proconfig || []).join(', ');
    console.log(`  ✓ Function proconfig: [${configStr}]`);
    if (!configStr.includes('search_path=pg_catalog, public') && !configStr.includes('search_path=pg_catalog,public')) {
      throw new Error(`Function search_path is not pg_catalog, public! Got: ${configStr}`);
    }
    console.log('  ✓ Function search_path strictly set to pg_catalog, public');

    // 5. Verify Permissions
    console.log('[SCHEMA CHECK 5] Verifying execute permissions on RPC...');
    const permRes = await client.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.routine_privileges 
      WHERE routine_schema = 'public' AND routine_name = 'settle_bill_and_close_session_atomic';
    `);
    const grantees = new Set(permRes.rows.map(r => r.grantee));
    console.log('  Grantees:', Array.from(grantees));

    if (grantees.has('PUBLIC')) {
      throw new Error('SECURITY VIOLATION: PUBLIC has EXECUTE privilege on settle_bill_and_close_session_atomic');
    }
    if (grantees.has('anon')) {
      throw new Error('SECURITY VIOLATION: anon has EXECUTE privilege on settle_bill_and_close_session_atomic');
    }
    console.log('  ✓ PUBLIC and anon execute strictly revoked.');

    console.log('\n============================================================');
    console.log('MILESTONE 2 RESULT: 100% PASS — SCHEMA DEPLOYMENT VERIFIED');
    console.log('============================================================');
  } finally {
    await client.end();
  }
}

verifySchema().catch(err => {
  console.error('SCHEMA VERIFICATION FAILED:', err.message);
  process.exit(1);
});
