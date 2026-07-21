# OrderRail — Database Architecture Documentation

> **Single Source of Truth** for OrderRail PostgreSQL database design, domain modeling, RLS security policies, state lifecycles, RPC contracts, and deployment workflows.

---

## Table of Contents
- [1. Overview](#1-overview)
- [2. Design Philosophy](#2-design-philosophy)
- [3. High-Level Domain Model](#3-high-level-domain-model)
- [4. Database Modules](#4-database-modules)
- [5. State Machines & Lifecycles](#5-state-machines--lifecycles)
- [6. Core Table Documentation](#6-core-table-documentation)
- [7. RPC Functions](#7-rpc-functions)
- [8. Database Triggers](#8-database-triggers)
- [9. Row Level Security (RLS) Architecture](#9-row-level-security-rls-architecture)
- [10. Data Integrity & Constraints](#10-data-integrity--constraints)
- [11. Performance & Realtime Architecture](#11-performance--realtime-architecture)
- [12. Migration & Deployment Strategy](#12-migration--deployment-strategy)
- [13. Future Database Evolution](#13-future-database-evolution)

---

## 1. Overview

### 1.1 Purpose of the Database
The OrderRail database is the operational engine powering multi-tenant QR code dining, real-time kitchen workflows, staff dashboard synchronization, customer cart persistence, and cafe operations. It manages physical resources (cafes, tables, menu items), customer interactions (dining sessions, orders, service requests), and enterprise security (roles, RLS, demo restrictions).

### 1.2 PostgreSQL as the Absolute Source of Truth
In OrderRail, the PostgreSQL database is not merely a passive persistence store; it is the **authoritative coordinator of system state**. 
- Application clients (Customer web app, Staff dashboard, Owner portal) are lightweight UI projections of database state.
- Offline-first operations synchronize directly against PostgreSQL state machines.
- State transitions (table occupancy, dining session creation, order placement, table releases) are governed by database constraints, triggers, and RPC functions.

### 1.3 Why Business Logic Lives in the Database
Critical business rules reside inside PostgreSQL (via RLS policies, PL/pgSQL RPC functions, and triggers) to guarantee:
1. **Multi-Client Consistency:** Whether a customer submits an order via mobile web, staff updates an order status, or a background worker cleans up expired sessions, the same security and validation constraints apply.
2. **Zero-Trust Client Boundary:** Unauthenticated customer devices operate under the `anon` role. Business logic inside database RPCs and triggers prevents rogue clients from manipulating prices, hijacking sessions, or modifying structural metadata.
3. **Atomic Operations:** Session creation, table state transitions, and order rollups require transaction isolation to avoid race conditions.

---

## 2. Design Philosophy

### 2.1 Single Active Dining Session per Table
A physical restaurant table can have at most **one active dining session** at any point in time. 
- When a customer scans a QR code, `getOrCreateDiningSession()` binds or creates a `dining_sessions` record (`status: 'browsing'` or `'active'`) and links it to `tables.active_session_id`.
- Multiple diners sitting at the same table share the exact same `dining_session_id`, allowing collaborative ordering.

### 2.2 Orders Belong to Dining Sessions
Orders are bound to a `dining_session_id`, not directly to transient HTTP browser sessions.
- Even if a customer closes their browser or switches devices, their active orders remain linked to the table's dining session.
- Serving an order or completing kitchen preparation **does not close the session or free the table**.

### 2.3 Tables Represent Physical Resources
The `tables` entity represents physical restaurant hardware and layout geometry (`label`, `seats`, `cafe_id`).
- Physical table metadata is **structural** and static during routine dining workflows.
- Runtime table state (`active_session_id`, `status`) is **transient** and reflects real-time occupancy.

### 2.4 Separation of Runtime State & Structural Metadata
OrderRail enforces a strict boundary between:
- **Structural Metadata:** `id`, `cafe_id`, `label`, `seats`, `is_active`. Protected against unauthorized mutation via database triggers (`trg_enforce_demo_table_update_protection`).
- **Runtime State:** `active_session_id`, `status`. Continuously updated as diners arrive, order, and vacate.

### 2.5 Explicit Staff Table Release (`markTableFree`)
Table occupancy is decoupled from order completion.
- When all kitchen orders reach `"served"`, the dining session remains `active` and the table remains `occupied`.
- A table becomes `free` **only** when staff explicitly invokes `markTableFree()` / `free_table` RPC, closing the dining session and clearing `tables.active_session_id`.

---

## 3. High-Level Domain Model

```
Cafe (Multi-Tenant Root)
├── Tables (Physical Layout)
│   └── Dining Sessions (Occupancy Container)
│       ├── Orders (Kitchen Transactions)
│       │   └── Order Items (Line Items)
│       ├── Service Requests (Staff Call Assistance)
│       └── Bills & Payments (Future)
├── Menu Categories & Items (Catalog)
├── Staff & User Roles (RBAC)
└── Reviews (Customer Feedback)
```

### Relationship Topology
1. **Cafe → Tables (1:N):** One cafe owns multiple physical tables.
2. **Table → Dining Sessions (1:N):** A table accumulates sequential historical dining sessions over time.
3. **Table → Active Session (1:1 optional):** A table references its currently active `dining_session_id`.
4. **Dining Session → Orders (1:N):** A single dining session collects all rounds of customer orders placed during a visit.
5. **Order → Order Items (1:N):** An order contains multiple menu line items with snapshot pricing.
6. **Dining Session → Service Requests (1:N):** Diners in a session can raise multiple staff assistance calls ("Water", "Bill", "Waiter").

---

## 4. Database Modules

| Module | Core Purpose | Primary Entities | Key Behavior |
|--------|--------------|------------------|--------------|
| **Cafe** | Multi-tenant organization container | `cafes` | Tenant isolation root; holds branding, currency, operating hours. |
| **Menu** | Catalog of offerings | `menu_categories`, `menu_items` | Categorized items with pricing, availability, and veg/non-veg types. |
| **Tables** | Physical layout & occupancy | `tables` | Physical seat resources linked to active dining sessions. |
| **Dining Sessions** | Customer visit container | `dining_sessions` | Lifecycle tracking from `browsing` → `active` → `closed`. |
| **Orders** | Kitchen & fulfillment workflow | `orders`, `order_items` | Order placement, status tracking (`pending` → `preparing` → `ready` → `served`), and line items. |
| **Service Requests** | Realtime customer assistance | `service_requests` | Staff call tickets (`water`, `bill`, `waiter`) with lifecycle (`open` → `acknowledged` → `resolved`). |
| **Staff & Auth** | Role-based access control | `profiles`, `user_roles`, `staff_invites` | Owner and staff permissions per cafe tenant. |
| **Reviews** | Customer feedback | `reviews` | Star ratings and comments tied to completed dining visits. |
| **Analytics** | Operational metrics | Views & helper functions | Realtime rollups of revenue, active tables, and average fulfillment time. |

---

## 5. State Machines & Lifecycles

### 5.1 Dining Session Lifecycle
```
       [ QR Scan ]
            │
            ▼
┌───────────────────────┐   First Order Placed   ┌───────────────────────┐
│       browsing        │ ─────────────────────► │        active         │
└───────────────────────┘                        └───────────────────────┘
            │                                                │
 15-Min Expiry / Idle                               Mark Table Free (Staff)
            │                                                │
            ▼                                                ▼
┌───────────────────────┐                        ┌───────────────────────┐
│        closed         │                        │        closed         │
└───────────────────────┘                        └───────────────────────┘
```
- **`browsing`**: Created automatically when a customer scans a table QR code. Expires after 15 minutes of inactivity if no order is placed.
- **`active`**: Promoted automatically upon placement of the first order. Persists indefinitely until staff frees the table.
- **`closed`**: Set when staff marks the table free. Seals the session, records `closed_at` and `total_amount`, and clears `tables.active_session_id`.

### 5.2 Table Lifecycle
```
┌───────────────────────┐    QR Scan / Active Session    ┌───────────────────────┐
│         free          │ ─────────────────────────────► │       occupied        │
└───────────────────────┘                                └───────────────────────┘
            ▲                                                        │
            │────────────── Mark Table Free (RPC) ───────────────────│
```

### 5.3 Order Lifecycle
```
┌─────────────┐   Staff Ack    ┌─────────────┐  Kitchen Done  ┌─────────────┐  Delivered  ┌─────────────┐
│   pending   │ ─────────────► │  preparing  │ ─────────────► │    ready    │ ───────────►│   served    │
└─────────────┘                └─────────────┘                └─────────────┘             └─────────────┘
       │                              │                              │
       └──────────────────────────────┴──────────────────────────────┴─── Staff/Cust Cancel ──► ┌───────────┐
                                                                                                │ cancelled │
                                                                                                └───────────┘
```

---

## 6. Core Table Documentation

### 6.1 `tables`
- **Purpose:** Stores physical table layout and links to active dining sessions.
- **Primary Key:** `id` (UUID)
- **Important Columns:**
  - `cafe_id` (UUID, FK `cafes.id`): Tenant reference.
  - `label` (TEXT): Table identifier shown to users (e.g. `"1"`, `"Patio-3"`).
  - `active_session_id` (UUID, FK `dining_sessions.id`, nullable): Reference to currently open session.
  - `status` (TEXT): `'free'` or `'occupied'`.
- **Business Rules:** `status` must match `CHECK (status IN ('free', 'occupied'))`. `active_session_id` is set when occupied and `null` when free.

### 6.2 `dining_sessions`
- **Purpose:** Tracks a single dining party's visit lifecycle from QR scan through payment/table release.
- **Primary Key:** `id` (UUID)
- **Important Columns:**
  - `table_id` (UUID, FK `tables.id`): Target table.
  - `status` (TEXT): `'browsing'`, `'active'`, or `'closed'`.
  - `opened_at` (TIMESTAMPTZ): Session start timestamp.
  - `closed_at` (TIMESTAMPTZ, nullable): Session completion timestamp.
  - `total_amount` (INT): Cumulative cents spent across all session orders.

### 6.3 `orders`
- **Purpose:** Represents an order submitted to the kitchen for preparation and fulfillment.
- **Primary Key:** `id` (UUID)
- **Important Columns:**
  - `dining_session_id` (UUID, FK `dining_sessions.id`, nullable): Binds order to session.
  - `table_id` (UUID, FK `tables.id`): Destination table.
  - `status` (TEXT): `'pending'`, `'preparing'`, `'ready'`, `'served'`, `'cancelled'`.
  - `total_cents` (INT): Total price in cents for this specific order batch.
  - `order_number` (INT): Sequential daily order number per cafe.

---

## 7. RPC Functions

### 7.1 `public.free_table(p_table_id UUID, p_staff_id UUID DEFAULT NULL)`
- **Purpose:** Safely closes an active dining session, verifies no pending kitchen orders remain, auto-resolves open service requests, and resets the table status to `'free'`.
- **Validation:**
  - Checks if `active_session_id` is non-null. Throws `'Table is not currently occupied.'` if null.
  - Checks if active orders exist (`status IN ('pending', 'preparing', 'ready')`). Throws `'Cannot mark table free: there are active orders...'` if found.
- **Database Changes:**
  1. Sums `total_cents` across all session orders and updates `dining_sessions.total_amount`.
  2. Updates `service_requests` status to `'resolved'` for all open requests in the session.
  3. Updates `dining_sessions.status = 'closed'` and `closed_at = now()`.
  4. Updates `tables.active_session_id = NULL` and `status = 'free'`.

### 7.2 `public.cleanup_expired_browsing_sessions()`
- **Purpose:** Housekeeping procedure to close abandoned `browsing` sessions older than 15 minutes.
- **Database Changes:**
  1. Sets `tables.active_session_id = NULL` and `status = 'free'` for tables holding expired browsing sessions.
  2. Updates `dining_sessions.status = 'closed'` for browsing sessions where `opened_at < now() - INTERVAL '15 minutes'`.

---

## 8. Database Triggers

### 8.1 `trg_check_table_can_be_freed`
- **Table:** `public.tables`
- **Timing:** `BEFORE UPDATE ON public.tables FOR EACH ROW`
- **Purpose:** Enforces data integrity when clearing `active_session_id`.
- **Validation:** If `OLD.active_session_id IS NOT NULL` and `NEW.active_session_id IS NULL`, checks if any orders linked to `OLD.active_session_id` are in `'pending'`, `'preparing'`, or `'ready'` status. Raises an exception if unserved orders remain.

### 8.2 `trg_enforce_demo_table_update_protection`
- **Table:** `public.tables`
- **Timing:** `BEFORE UPDATE ON public.tables FOR EACH ROW`
- **Purpose:** Protects public demo table structures while allowing runtime state mutations.
- **Validation:** If `is_demo_cafe(cafe_id)` is true, checks if `id`, `cafe_id`, `label`, `seats`, or `is_active` are altered. Throws `'Modifying table structural metadata is disabled in the public demo.'` if structural fields change. Allows `active_session_id` and `status` updates.

---

## 9. Row Level Security (RLS) Architecture

OrderRail uses PostgreSQL Row Level Security (RLS) to enforce tenant isolation and role permissions.

### 9.1 Access Categories
1. **Public / Anonymous (`anon` role):**
   - Can `SELECT` active tables, menu categories, and available menu items (`is_active = true`).
   - Can `INSERT` new `dining_sessions` and `orders`.
   - Can `UPDATE` runtime state (`tables.active_session_id`, `tables.status`) via `tables_runtime_update` policy.
2. **Authenticated Staff (`authenticated` role with staff/owner claims):**
   - Full `SELECT`, `UPDATE` access to orders, service requests, and table operations for their assigned `cafe_id`.
3. **Owner (`authenticated` role with owner claim):**
   - Full CRUD management across `menu_items`, `menu_categories`, `tables`, and `user_roles` for their cafe.

---

## 10. Data Integrity & Constraints

- **Foreign Keys:** All parent-child relationships enforce referential integrity (`ON DELETE CASCADE` for line items; `ON DELETE SET NULL` for table sessions).
- **Check Constraints:** Validates enumerated statuses (`CHECK (status IN ('free', 'occupied'))`, `CHECK (seats > 0)`).
- **Concurrency Isolation:** Session updates and table freeing use atomic Postgres transactions to prevent double-booking or state drift.

---

## 11. Performance & Realtime Architecture

- **Indexes:** B-tree indexes are maintained on `tables(cafe_id)`, `orders(table_id)`, `orders(dining_session_id)`, and `dining_sessions(table_id, status)`.
- **Realtime Subscriptions:** Supabase Realtime listens to PostgreSQL WAL changes on `orders`, `service_requests`, and `tables`, broadcasting live updates to staff dashboards without client polling.

---

## 12. Migration & Deployment Strategy

### 12.1 Separation of Frontend & Database Deployments
- **Vite/Vercel Pipeline:** Deploys compiled frontend web bundles (`dist/`). Does **NOT** execute database migrations.
- **Supabase CLI Pipeline:** Applies database migrations (`supabase/migrations/*.sql`) directly to the PostgreSQL instance via `supabase db push`.

### 12.2 Migration Workflow Checklist
1. Write new SQL file under `supabase/migrations/YYYYMMDDHHMMSS_name.sql`.
2. Test locally or using dry-run (`npx supabase db push --dry-run`).
3. Apply migration to production database (`npx supabase db push`).
4. Verify migration state using `npx supabase migration list`.

---

## 13. Future Database Evolution

1. **Billing & Payments:** Addition of `bills` and `payments` tables bound to `dining_session_id` for digital invoice splitting and payment gateway reconciliation.
2. **Kitchen Display System (KDS):** Specialized line-item routing per station (`kitchen_stations`, `order_item_modifiers`).
3. **Multi-Outlet Franchising:** Extending `cafes` hierarchy to support `outlets` and regional menu overrides.
