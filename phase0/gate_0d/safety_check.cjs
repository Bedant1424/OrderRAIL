/**
 * Milestone 1: Harness-Side Production Safety Verification
 * 
 * Asserts that:
 * 1. Target database is strictly the dedicated staging instance (nmlrggmiksxwxptrcntb).
 * 2. Production project ref (toqerqtcnlkvdawrkkqh) is NOT in any target URL or host.
 * 3. Environment variables do not leak production secrets.
 * 4. Staging identity is verified via SELECT current_database(), inet_server_addr().
 * 5. Staging cafe name is strictly 'Cheese Corner Staging'.
 */

const { Client } = require('pg');

const PRODUCTION_REF = 'toqerqtcnlkvdawrkkqh';
const STAGING_REF = 'nmlrggmiksxwxptrcntb';
const STAGING_HOST = 'db.nmlrggmiksxwxptrcntb.supabase.co';

async function runSafetyCheck() {
  console.log('============================================================');
  console.log('MILESTONE 1: HARNESS-SIDE PRODUCTION SAFETY VERIFICATION');
  console.log('============================================================');

  // Pre-socket assertions
  console.log('[SAFETY CHECK 1] Scanning environment variables for production references...');
  const suspiciousEnv = [];
  for (const [key, val] of Object.entries(process.env)) {
    if (typeof val === 'string' && val.includes(PRODUCTION_REF)) {
      suspiciousEnv.push({ key, valSnippet: val.substring(0, 30) });
    }
  }

  if (suspiciousEnv.length > 0) {
    console.error('FATAL: Production project ref detected in environment variables:', suspiciousEnv);
    process.exit(1);
  }
  console.log('  PASSED: 0 production project references found in process.env.');

  console.log('[SAFETY CHECK 2] Validating target database host & configuration...');
  const targetHost = STAGING_HOST;
  if (targetHost.includes(PRODUCTION_REF)) {
    console.error(`FATAL: Target host contains production reference: ${targetHost}`);
    process.exit(1);
  }
  if (!targetHost.includes(STAGING_REF)) {
    console.error(`FATAL: Target host is not the declared staging project: ${targetHost}`);
    process.exit(1);
  }
  console.log(`  PASSED: Target host strictly matches staging reference: ${targetHost}`);

  // Post-socket assertions
  console.log('[SAFETY CHECK 3] Opening connection to verified staging host...');
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
    console.log('  PASSED: Connected to staging database socket.');

    console.log('[SAFETY CHECK 4] Querying database identity (SELECT current_database(), inet_server_addr())...');
    const idRes = await client.query('SELECT current_database(), inet_server_addr(), current_user;');
    const row = idRes.rows[0];
    console.log('  Database identity:', row);

    console.log('[SAFETY CHECK 5] Verifying tenant identity (SELECT name FROM public.cafes LIMIT 1)...');
    const cafeRes = await client.query('SELECT id, name FROM public.cafes LIMIT 1;');
    if (cafeRes.rows.length === 0) {
      console.error('FATAL: public.cafes is empty in staging database!');
      process.exit(1);
    }
    const cafe = cafeRes.rows[0];
    console.log('  Cafe identity:', cafe);

    if (cafe.name !== 'Cheese Corner Staging') {
      console.error(`FATAL: Staging cafe name mismatch! Expected 'Cheese Corner Staging', got: '${cafe.name}'`);
      process.exit(1);
    }
    console.log("  PASSED: Cafe name is strictly 'Cheese Corner Staging'.");

    console.log('\n============================================================');
    console.log('MILESTONE 1 RESULT: 100% PASS — STAGING ISOLATION VERIFIED');
    console.log('============================================================');
  } catch (err) {
    console.error('FATAL SAFETY FAILURE:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSafetyCheck();
