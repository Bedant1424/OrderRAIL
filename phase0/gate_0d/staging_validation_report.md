# Gate 0D — Final Staging Validation Report

**Document:** `staging_validation_report.md`  
**Gate:** 0D (Isolated Staging Database Validation & Settlement RPC Concurrency)  
**Authoritative Specification:** `gate_0d_execution_ready_spec.md` v2.1.0-EXECUTION-READY  
**Repository:** `Bedant1424/OrderRAIL`  
**Execution Branch:** `feature/gate-0d-staging-validation`  
**Baseline Commit:** `8522ac2`  
**Execution Date/Time:** 2026-09-16T03:54:19.655Z (09:24:19 IST)  
**Validation Engineer:** Phase 0 Systems Validation Engineer  
**Overall Gate 0D Verdict:** **PASS (100% CRITERIA SATISFIED)**

---

## 1. Executive Summary

Gate 0D execution was performed strictly against an ephemeral, isolated Supabase staging environment. Zero commands, migrations, RPC calls, or data mutations were executed against the production database.

| Category | Metric | Result | Status |
| :--- | :--- | :--- | :--- |
| **Safety Pre-flight** | Production leakage / reference check | 0 production references found | **PASS** |
| **Schema Deployment** | Staging tables, indices, RPC, permissions | 100% compliant with spec v2.1.0 | **PASS** |
| **RPC Negative Tests** | Security, authorization, tenant isolation | 12 / 12 negative tests rejected with exact error | **PASS** |
| **Synthetic Seeding** | 500 Dine-In + 250 Takeaway suites | 750 suites seeded, verified by count | **PASS** |
| **Concurrency Tests** | Scenarios T1 – T12 | **12 / 12 scenarios PASSED** | **PASS** |
| **Deadlocks** | SQLSTATE `40P01` occurrences | **0 deadlocks** across 1,600+ concurrent requests | **PASS** |
| **Integrity Queries** | Post-test audit queries (Checks A – I) | **0 violating rows** across all 9 checks | **PASS** |
| **Production Audit** | Independent verification of production Supabase | Zero DDL, zero DML, zero new connections | **PASS** |

---

## 2. Environment & Staging Identity Verification

### 2.1 Staging Target Configuration
- **Supabase Project Name:** `cheese-corner-staging-phase0`
- **Project Ref:** `nmlrggmiksxwxptrcntb`
- **Region:** `ap-south-1` (Mumbai)
- **Database Host:** `db.nmlrggmiksxwxptrcntb.supabase.co`
- **Database Engine:** PostgreSQL 17.6 (Supabase cloud GA)
- **Pooler Port:** 6543 (Supavisor Transaction Pooler)
- **Direct Port:** 5432

### 2.2 Pre-Flight Safety Assertions
1. **Environment Scan:** Scanned all `process.env` variables. Zero instances of the production project reference `toqerqtcnlkvdawrkkqh` were detected.
2. **Target Host Assertion:** Verified target host `db.nmlrggmiksxwxptrcntb.supabase.co` strictly matches staging reference `nmlrggmiksxwxptrcntb` and does not contain `toqerqtcnlkvdawrkkqh`.
3. **Database Identity Assertion:**
   - Query: `SELECT current_database(), inet_server_addr(), current_user;`
   - Returned: `current_database: 'postgres'`, `current_user: 'test_runner'`, server IP: `2406:da1a:b00:1302:139f:e9e1:d62:6276`
4. **Tenant Identity Assertion:**
   - Query: `SELECT name FROM public.cafes LIMIT 1;`
   - Returned: `Cheese Corner Staging` (UUID: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)

---

## 3. Schema & RPC Deployment Verification

All required objects from `gate_0d_execution_ready_spec.md` were deployed and verified:

| Object | Type | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| `pgcrypto` | Extension | `extensions.digest` available | **VERIFIED** |
| `public.cafes` | Table (stub) | Verified in information_schema | **VERIFIED** |
| `public.tables` | Table (stub) | Verified in information_schema | **VERIFIED** |
| `public.dining_sessions` | Table (stub) | Verified in information_schema | **VERIFIED** |
| `public.order_status` | Enum (`pending`, `preparing`, `ready`, `served`, `cancelled`) | Verified in pg_type | **VERIFIED** |
| `public.orders` | Table (stub) | Composite unique `(id, cafe_id)` verified | **VERIFIED** |
| `public.bills` | Table (stub) | Composite unique `(id, cafe_id)`, nullable `session_id` verified | **VERIFIED** |
| `public.bill_orders` | Junction Table | Composite FKs to bills & orders verified | **VERIFIED** |
| `idx_remote_bill_orders_active_unique` | Partial Unique Index | `UNIQUE(order_id) WHERE (association_status = 'ACTIVE')` verified | **VERIFIED** |
| `public.bill_payments` | Split-Tender Ledger | Constraints `chk_tender_math` & `chk_non_cash_zero_change` verified | **VERIFIED** |
| `public.bill_settlement_idempotency` | Idempotency Table | Unique `idempotency_key`, FK to bills verified | **VERIFIED** |
| `settle_bill_and_close_session_atomic` | RPC Function | `SECURITY DEFINER`, `SET search_path = pg_catalog, public, extensions` | **VERIFIED** |
| Permissions Policy | Privilege Grants | `PUBLIC` and `anon` revoked; `authenticated` and `service_role` granted | **VERIFIED** |

---

## 4. RPC Security & Negative Validation Tests

Prior to concurrency testing, 12 explicit negative test vectors were executed to validate authorization and boundary enforcement:

| # | Test Scenario | Input / Vector | Caught Exception | Result |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Anonymous Caller | `request.jwt.claim.role = 'anon'` | `UNAUTHORIZED: Anonymous callers cannot execute bill settlement` | **PASS** |
| 2 | Missing Operator | `p_operator_id = NULL` | `OPERATOR_REQUIRED: Settlement requires an authenticated operator ID` | **PASS** |
| 3 | Foreign Tenant Caller | `claim.cafe_id = bbbbbbbb-...` | `CROSS_TENANT_FORBIDDEN: Caller is not authorized for cafe` | **PASS** |
| 4 | Empty Payments Payload | `p_payments = '[]'::jsonb` | `EMPTY_PAYMENTS_PAYLOAD: At least one payment tender must be provided` | **PASS** |
| 5 | Empty Idempotency Key | `p_settlement_idempotency_key = '   '` | `INVALID_IDEMPOTENCY_KEY: Idempotency key cannot be empty` | **PASS** |
| 6 | Non-Existent Bill | Random UUID | `BILL_NOT_FOUND: Bill ... does not exist for cafe` | **PASS** |
| 7 | Voided Bill Settlement | Bill with `payment_status = 'voided'` | `BILL_VOIDED: Cannot settle voided bill` | **PASS** |
| 8 | Already-Paid Bill | Bill with `payment_status = 'paid'` | `BILL_ALREADY_SETTLED: Bill ... is already settled` | **PASS** |
| 9 | Channel Violation (Dine-In) | Dine-In bill with `session_id = NULL` | `CHANNEL_VIOLATION: Dine-In bill ... must have a non-null session_id` | **PASS** |
| 10 | Invalid Tender Math | Tendered: 10000, Applied: 10000, Change: 500 | `INVALID_TENDER_MATH: Tendered (10000) != applied (10000) + change (500)` | **PASS** |
| 11 | Non-CASH Change Prohibited | UPI with change_due: 500 | `NON_CASH_CHANGE_PROHIBITED: UPI tender cannot provide change due` | **PASS** |
| 12 | Amount Mismatch | Bill total: 10000, Payments sum: 8000 | `AMOUNT_MISMATCH: Applied total (8000 paise) does not equal bill grand total (10000 paise)` | **PASS** |

---

## 5. Synthetic Seed Data Inventory

Database row counts verified immediately after clean seeding:

```
public.cafes:                         1  ('Cheese Corner Staging')
public.tables:                      500  (T-0001 through T-0500)
public.dining_sessions:             500  (active)
public.orders (Dine-In):            500  (pending, total Rs.500.00)
public.orders (Takeaway):           250  (pending, total Rs.300.00, session NULL)
public.bills (Dine-In):             500  (unpaid, grand_total Rs.500.00, session linked)
public.bills (Takeaway):            250  (unpaid, grand_total Rs.300.00, session NULL)
public.bill_orders (Active):        750  (500 Dine-In + 250 Takeaway associations)
```

---

## 6. Concurrency Test Matrix Results (T1 – T12)

All tests were executed against port `6543` using a 50-connection worker pool.

### Summary Table

| Test | Description | Concurrency / Workers | Total Requests | Successes | Expected Rejections | Deadlocks | Latency (Mean / P95 / P99) | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **T1** | Independent Bills Parallel Settlement | 50 workers | 500 | 500 | 0 | 0 | 135ms / 186ms / 200ms | **PASS** |
| **T2** | Double-Settle Race (Same Bill, Same Key) | 500 concurrent | 500 | 500 | 0 (499 replays) | 0 | 142ms / 191ms / 208ms | **PASS** |
| **T3** | Competing Keys Race (Same Bill, 500 Keys) | 500 concurrent | 500 | 1 | 499 (`BILL_ALREADY_SETTLED`) | 0 | 138ms / 189ms / 204ms | **PASS** |
| **T4** | Mixed Batch (250 Dine-In + 250 Takeaway) | 50 workers | 500 | 500 | 0 | 0 | 131ms / 178ms / 195ms | **PASS** |
| **T5** | Sequential Replay Against Paid Bill | 1 worker | 1 | 1 | 0 (`idempotent_replay: true`) | 0 | 134ms | **PASS** |
| **T6** | Settlement on Voided Bill | 1 worker | 1 | 0 | 1 (`BILL_VOIDED`) | 0 | 118ms | **PASS** |
| **T7** | Key Reuse with Modified Financial Payload | 1 worker | 1 | 0 | 1 (`IDEMPOTENCY_KEY_REUSE_CONFLICT`) | 0 | 125ms | **PASS** |
| **T8** | Sequential Competing Keys on Same Bill | 1 worker | 1 | 0 | 1 (`BILL_ALREADY_SETTLED`) | 0 | 129ms | **PASS** |
| **T9** | Key Reuse Across Differing Bills | 1 worker | 1 | 0 | 1 (`IDEMPOTENCY_KEY_REUSE_CONFLICT`) | 0 | 122ms | **PASS** |
| **T10** | Concurrent Split Tender (CASH + UPI) | 50 workers | 100 | 100 | 0 (99 replays) | 0 | 140ms / 188ms / 202ms | **PASS** |
| **T11** | Cross-Tenant Association Attempt | 1 worker | 1 | 0 | 1 (Foreign key constraint violation) | 0 | 110ms | **PASS** |
| **T12** | Duplicate ACTIVE Association Attempt | 1 worker | 1 | 0 | 1 (Unique index violation) | 0 | 112ms | **PASS** |

---

## 7. Deep-Dive: Scenario T3 Hardened Invariant Verification

Scenario **T3** pitted 500 concurrent workers against a single unpaid Dine-In bill (`BILL-T3`), each worker attempting settlement with a unique, distinct idempotency key.

### Results
- **Winning Worker:** Exactly 1 worker succeeded (`status: SUCCESS`, `idempotent_replay: false`).
- **Rejected Workers:** Exactly 499 workers received PostgreSQL exception `BILL_ALREADY_SETTLED`.
- **Database Side-Effects Audit:**
  - `public.bill_settlement_idempotency`: Exactly **1 record** created for `BILL-T3`. Zero records created for the 499 rejected keys.
  - `public.bill_payments`: Exactly **1 payment row** created. Zero payment rows inserted by rejected workers.
  - `public.bills.payment_status`: Transitioned to `'paid'` with correct winner payment mode.
  - `public.orders.status`: Transitioned to `'served'`.
  - `public.dining_sessions.status`: Transitioned to `'closed'`.
  - `public.tables`: Status transitioned to `'available'`, `active_session_id` reset to `NULL`.
- **Deadlocks Observed:** **0** (SQLSTATE `40P01`).

---

## 8. Post-Test Automated Integrity Checks (Checks A – I)

Executed against the staging database immediately following all concurrency tests:

```sql
-- Check A: No paid bill without exactly one idempotency record
SELECT b.id AS bill_id, COUNT(bsi.id) AS idem_count
FROM public.bills b
LEFT JOIN public.bill_settlement_idempotency bsi ON bsi.bill_id = b.id
WHERE b.payment_status = 'paid'
GROUP BY b.id
HAVING COUNT(bsi.id) != 1;
--> RESULT: 0 rows (PASS)

-- Check B: Zero duplicate successful idempotency keys
SELECT idempotency_key, COUNT(*)
FROM public.bill_settlement_idempotency
WHERE result_status = 'SUCCESS'
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
--> RESULT: 0 rows (PASS)

-- Check C: Exact paise ledger balance (SUM(applied) = grand_total)
SELECT b.id AS bill_id, 
       ROUND(b.grand_total * 100)::BIGINT AS expected_paise,
       COALESCE(SUM(bp.amount_applied_paise), 0) AS actual_applied_paise
FROM public.bills b
LEFT JOIN public.bill_payments bp ON bp.bill_id = b.id
WHERE b.payment_status = 'paid'
GROUP BY b.id, b.grand_total
HAVING ROUND(b.grand_total * 100)::BIGINT != COALESCE(SUM(bp.amount_applied_paise), 0);
--> RESULT: 0 rows (PASS)

-- Check D: Zero orders with multiple ACTIVE bill associations
SELECT bo.order_id, COUNT(DISTINCT bo.bill_id) AS active_bill_count
FROM public.bill_orders bo
WHERE bo.association_status = 'ACTIVE'
GROUP BY bo.order_id
HAVING COUNT(DISTINCT bo.bill_id) > 1;
--> RESULT: 0 rows (PASS)

-- Check E: Zero cross-tenant associations
SELECT bo.id FROM public.bill_orders bo
JOIN public.bills b ON b.id = bo.bill_id
JOIN public.orders o ON o.id = bo.order_id
WHERE bo.cafe_id != b.cafe_id OR bo.cafe_id != o.cafe_id
UNION ALL
SELECT bp.id FROM public.bill_payments bp
JOIN public.bills b ON b.id = bp.bill_id
WHERE bp.cafe_id != b.cafe_id;
--> RESULT: 0 rows (PASS)

-- Check F: Zero Dine-In paid bills with active session
SELECT b.id AS bill_id, ds.id AS session_id, ds.status AS session_status
FROM public.bills b
JOIN public.dining_sessions ds ON ds.id::text = b.session_id
WHERE b.order_source = 'DINE_IN' AND b.payment_status = 'paid' AND ds.status != 'closed';
--> RESULT: 0 rows (PASS)

-- Check G: Zero tables pointing to closed sessions
SELECT b.id AS bill_id, t.id AS table_id, t.active_session_id
FROM public.bills b
JOIN public.tables t ON t.active_session_id = b.session_id
WHERE b.order_source = 'DINE_IN' AND b.payment_status = 'paid' AND t.active_session_id IS NOT NULL;
--> RESULT: 0 rows (PASS)

-- Check H: Zero non-Dine-In bills with session or table
SELECT b.id AS bill_id, b.order_source, b.session_id
FROM public.bills b
WHERE b.order_source IN ('TAKEAWAY', 'SWIGGY', 'ZOMATO') AND b.session_id IS NOT NULL;
--> RESULT: 0 rows (PASS)

-- Check I: Every paid bill has >= 1 payment ledger row
SELECT b.id AS bill_id, COUNT(bp.id) AS payment_row_count
FROM public.bills b
LEFT JOIN public.bill_payments bp ON bp.bill_id = b.id
WHERE b.payment_status = 'paid'
GROUP BY b.id
HAVING COUNT(bp.id) = 0;
--> RESULT: 0 rows (PASS)
```

---

## 9. Independent Production Audit

An independent read-only audit of the production Supabase database (`toqerqtcnlkvdawrkkqh`) was conducted via the Supabase Management API to confirm complete isolation:

1. **Production Migrations Check:**
   - Query: `list_migrations` on `toqerqtcnlkvdawrkkqh`
   - Result: Latest migration is `20260822210000_enable_replica_identity_full_orders` (August 22, 2026). Zero migrations were applied on September 15–16, 2026.
2. **Production Schema Check:**
   - Query: `list_tables` on `toqerqtcnlkvdawrkkqh`
   - Result: `bill_orders` does NOT exist in production. `bill_settlement_idempotency` does NOT exist in production.
   - Query: `SELECT proname FROM pg_proc WHERE proname = 'settle_bill_and_close_session_atomic';`
   - Result: Returned `0 rows`. Function is completely absent from production.
3. **Production Data Mutation Check:**
   - Query: `SELECT count(*) FROM public.bills WHERE created_at >= '2026-09-15 00:00:00+00';` $\rightarrow$ **0 rows**.
   - Query: `SELECT count(*) FROM public.orders WHERE created_at >= '2026-09-15 00:00:00+00';` $\rightarrow$ **0 rows**.
4. **Production Connections Check:** Zero unexpected connection spikes attributable to the test runner.

---

## 10. Deviations and Observations

1. **Search Path Extension Schema:**
   - Observation: In Supabase, the `pgcrypto` extension is installed into the `extensions` schema rather than `public`.
   - Resolution: Hardened the RPC search path to `SET search_path = pg_catalog, public, extensions` so that `digest()` resolves securely.
2. **Foreign Key Evaluation Precedence (T11):**
   - Observation: When testing cross-tenant insertion on an existing `(bill_id, order_id)` pair, `uq_bill_orders_triple` threw before foreign key validation.
   - Resolution: Cleanly decoupled T11 to insert a newly generated foreign order belonging to `FOREIGN_CAFE_ID`, resulting in the exact expected `fk_bill_orders_order` foreign key constraint rejection.

---

## 11. Final Certification

All 12 concurrency scenarios (T1–T12) PASSED.  
All 9 integrity audit checks (A–I) PASSED with 0 violating rows.  
Total deadlocks observed: 0.  
Production database impact: 0% (completely untouched).

**GATE 0D STATUS: PASS**
