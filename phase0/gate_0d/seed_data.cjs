/**
 * Milestone 4: Synthetic Data Generator
 * Seeds strictly staging data:
 * - 1 Staging Cafe: 'Cheese Corner Staging'
 * - 500 Dine-In tables, sessions, orders, bills, and bill_orders associations
 * - 250 Takeaway orders, bills, and bill_orders associations
 */

const { Client } = require('pg');

const STAGING_HOST = 'db.nmlrggmiksxwxptrcntb.supabase.co';
const CAFE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

async function seedData() {
  console.log('============================================================');
  console.log('MILESTONE 4: SYNTHETIC DATA SEEDING');
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

  try {
    // 1. Ensure staging cafe exists
    console.log('[SEED 1] Ensuring staging cafe exists...');
    await client.query(`
      INSERT INTO public.cafes (id, name)
      VALUES ('${CAFE_ID}', 'Cheese Corner Staging')
      ON CONFLICT (id) DO UPDATE SET name = 'Cheese Corner Staging';
    `);

    // Clean previous test data (except cafe) to ensure idempotent fresh seed
    console.log('[SEED 2] Cleaning any prior test runs...');
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

    // 2. Seed 500 Dine-In Suites (Table, Session, Order, Bill, Bill_Order)
    console.log('[SEED 3] Generating 500 Dine-In test records...');
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

    // Insert Dine-In in correct FK dependency order
    await client.query(`INSERT INTO public.tables (id, cafe_id, table_number, active_session_id, status) VALUES ${dineInTables.join(',')};`);
    await client.query(`INSERT INTO public.dining_sessions (id, cafe_id, table_id, status) VALUES ${dineInSessions.join(',')};`);
    await client.query(`INSERT INTO public.orders (id, cafe_id, table_id, session_id, status, order_source, total) VALUES ${dineInOrders.join(',')};`);
    await client.query(`INSERT INTO public.bills (id, cafe_id, bill_number, session_id, grand_total, payment_status, order_source) VALUES ${dineInBills.join(',')};`);
    await client.query(`INSERT INTO public.bill_orders (bill_id, order_id, cafe_id, association_status) VALUES ${dineInBillOrders.join(',')};`);
    console.log('  ✓ 500 Dine-In tables, sessions, orders, bills, and bill_orders inserted.');

    // 3. Seed 250 Takeaway Suites (Order, Bill, Bill_Order)
    console.log('[SEED 4] Generating 250 Takeaway test records...');
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
    console.log('  ✓ 250 Takeaway orders, bills, and bill_orders inserted.');

    // 4. Verify counts
    console.log('[SEED 5] Verifying exact database row counts...');
    const countsRes = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM public.cafes) AS cafes_count,
        (SELECT COUNT(*) FROM public.tables) AS tables_count,
        (SELECT COUNT(*) FROM public.dining_sessions) AS sessions_count,
        (SELECT COUNT(*) FROM public.orders WHERE order_source = 'DINE_IN') AS dine_in_orders_count,
        (SELECT COUNT(*) FROM public.orders WHERE order_source = 'TAKEAWAY') AS takeaway_orders_count,
        (SELECT COUNT(*) FROM public.bills WHERE order_source = 'DINE_IN') AS dine_in_bills_count,
        (SELECT COUNT(*) FROM public.bills WHERE order_source = 'TAKEAWAY') AS takeaway_bills_count,
        (SELECT COUNT(*) FROM public.bill_orders WHERE association_status = 'ACTIVE') AS active_bill_orders_count;
    `);

    const c = countsRes.rows[0];
    console.log('  Verified counts:', c);

    if (parseInt(c.cafes_count) !== 1 ||
        parseInt(c.tables_count) !== 500 ||
        parseInt(c.sessions_count) !== 500 ||
        parseInt(c.dine_in_orders_count) !== 500 ||
        parseInt(c.takeaway_orders_count) !== 250 ||
        parseInt(c.dine_in_bills_count) !== 500 ||
        parseInt(c.takeaway_bills_count) !== 250 ||
        parseInt(c.active_bill_orders_count) !== 750) {
      throw new Error(`Row count verification failed! Actual counts: ${JSON.stringify(c)}`);
    }

    console.log('\n============================================================');
    console.log('MILESTONE 4 RESULT: 100% PASS — 750 SUITES SEEDED CLEANLY');
    console.log('============================================================');
  } finally {
    await client.end();
  }
}

seedData().catch(err => {
  console.error('SEEDING FATAL FAILURE:', err.message);
  process.exit(1);
});
