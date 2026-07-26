# OrderRail Production Pilot Deployment Checklist

This document provides the mandatory step-by-step verification checklist for deploying OrderRail into a production café environment.

---

## 1. Environment & Secrets Audit

- [ ] **Supabase Production Project**: Ensure production Supabase project is provisioned with custom domain.
- [ ] **Environment Variables**:
  - `VITE_SUPABASE_URL`: Pointed to production Supabase URL.
  - `VITE_SUPABASE_ANON_KEY`: Set to production public anon key.
  - **Security Check**: Confirm `SUPABASE_SERVICE_ROLE_KEY` is NEVER bundled in client code or `.env` files.
- [ ] **Demo Mode Disabled**: Verify fallback mock flags (`isDemoMode`) are disabled in production build configuration.

---

## 2. Database & RLS Security Verification

- [ ] **Database Migrations Applied**:
  - Run all migration scripts up to `20260725210000_billing_concurrency_hardening.sql`.
  - Verify `UNIQUE (session_id)` constraint exists on `bills` table.
- [ ] **Row Level Security (RLS) Audit**:
  - `cafes`: Read access for public, write access restricted to owner.
  - `tables`: Read access for public, write access for staff/owner.
  - `dining_sessions`: Insert/Update for customer & staff sessions.
  - `orders` & `order_items`: Read access for linked session/table, status updates restricted to staff.
  - `bills` & `bill_items`: Insert/Update restricted to authenticated staff/cashier roles.
  - `service_requests`: Insert for customer session, update/dismiss for staff roles.

---

## 3. Hardware & Thermal Printing Validation

- [ ] **Printer Hardware Connection**: ESC/POS 80mm or 58mm thermal printer connected via USB, Bluetooth, or LAN.
- [ ] **Print Width Test**: Verify receipt width and typography (`font-mono text-black bg-white`) match physical paper roll margins.
- [ ] **Long Receipt Support**: Test printing multi-item bills (20+ items) without line truncation or overflow.
- [ ] **Multi-Copy Support**: Verify KOT slips dispatch cleanly to kitchen area printers.
- [ ] **Printer Offline Fallback**: Confirm toast warning notifies cashier gracefully if print spooler is offline without blocking payment completion.

---

## 4. Physical Table & QR Code Deployment

- [ ] **Table Label Mapping**: Audit table labels (`Table 1`, `Table 2`, ..., `Table N`) in Owner Portal match physical table stickers.
- [ ] **QR Code Verification**: Test scanning physical QR stickers on Android Chrome and iPhone Safari.
- [ ] **Direct Navigation Test**: Confirm QR URL opens directly into `TableOrderPage` with pre-filled table ID and active session.

---

## 5. Staff Onboarding & Operations Training

- [ ] **POS Counter Training**: Cashiers trained on opening sessions, taking draft orders, sending KOTs, applying discounts, and generating receipts.
- [ ] **Staff Console Training**: Kitchen & floor staff trained on status workflow (`NEW` ➔ `PREPARING` ➔ `READY` ➔ `SERVED`) and answering service requests.
- [ ] **Table Reset Protocol**: Staff trained on releasing tables via `RestaurantOperationsService.resetTable()` to clear requests and table state.

---

## 6. Operational Observability & Emergency Recovery

- [ ] **Client Logging Verification**: Test structured logger (`Logger.info`, `Logger.warn`, `Logger.error`) logs runtime errors cleanly.
- [ ] **Database Backup Procedure**:
  - Configure daily automated Supabase PostgreSQL point-in-time recovery (PITR) backups.
- [ ] **Rollback Plan**:
  - Revert deployment to previous verified release tag if critical blocking issue occurs.
  - Re-run `npx vitest run` and `npm run build` to validate release candidate stability.
