# OrderRail — Platform Architecture Lock v1.0 (ARCHITECTURE_LOCK.md)

> **Official Architectural Constitution & Implementation Reference** for the OrderRail Platform. Formally freezes the core architecture, platform overview, authoritative specifications, locked design decisions, engineering rules, roadmap, and change policies at Version 1.0.

---

## Section 1 — Architecture Status

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ARCHITECTURE STATUS DECK                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ ARCHITECTURE VERSION: v1.0                                                              │
│ STATUS:               LOCKED                                                            │
│ MILESTONE:            ARCHITECTURE COMPLETE                                             │
│ EFFECTIVE DATE:       2026-07-22                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

The core architecture of OrderRail is now formally **LOCKED at Version 1.0**.

- The core platform redesign phase is complete.
- Core platform architecture will not undergo fundamental redesign unless implementation exposes a genuine, unresolvable technical flaw.
- Minor feature additions and incremental optimizations are expected.
- All future engineering work switches to **implementation-first development**.

---

## Section 2 — Architecture Principles

Every component, module, and feature in OrderRail must adhere to ten core architectural principles:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               TEN CORE PLATFORM PRINCIPLES                              │
├───────────────────┬───────────────────┬───────────────────┬───────────────────────────────┤
│ 1. Customer-First │ 2. Offline-First  │ 3. Device Model   │ 4. Operators Use Devices      │
│ Zero-friction QR  │ Local IndexedDB & │ Permanent hardware│ Cashiers/staff switch via PIN │
│ self-ordering.    │ async sync engine.│ tied to cafes.    │ on fixed terminals.           │
├───────────────────┼───────────────────┼───────────────────┼───────────────────────────────┤
│ 5. Real-Time Sync │ 6. Sub-Second POS │ 7. Security First │ 8. Progressive Enhancement    │
│ WebSocket updates │ Minimal clicks &  │ Atomic permission │ Modular Web Core to           │
│ across terminals. │ quick hotkeys.    │ & audit trails.   │ Native wrappers.              │
├───────────────────┴───────────────────┴───────────────────┴───────────────────────────────┤
│ 9. Universal Device Lifecycle: Pairing → Profile Picker → PIN Auth → Bounded Application    │
│ 10. Native Application Strategy: 100% web core reuse in Electron, Tauri & Android POS       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Customer-First Experience:** Fast, responsive mobile web QR ordering requiring zero app downloads or mandatory customer registrations.
2. **Offline-First Operations:** Point-of-sale intake, KOT printing, and session operations execute against local memory and IndexedDB first, syncing asynchronously to PostgreSQL.
3. **Device-Oriented Architecture:** Dedicated hardware terminals (`device_id`) belong permanently to a café location.
4. **Operators Use Devices:** Human operators (cashiers, cooks, managers) log in/out of dedicated terminals using fast 4-digit PIN codes. Devices do not change; operators do.
5. **Real-Time Synchronization:** Supabase WebSockets keep all counters, kitchens, and customer screens instantly aligned.
6. **Sub-Second Operational Workflows:** POS workflows prioritize cashier speed (< 3 seconds per transaction) via high information density and function key shortcuts.
7. **Security & Auditability by Default:** Every financial mutation, void, discount, and drawer trigger requires permission verification and generates immutable audit records.
8. **Progressive Enhancement:** Modular component design that scales seamlessly from small single-counter cafés to multi-terminal enterprise venues.
9. **Unified Device Lifecycle:** Every operational hardware unit follows the exact same lifecycle: Pairing Code → Profile Picker → PIN Verification → Bounded Application Workspace.
10. **Future Native Compatibility:** The Web Application core is 100% reusable inside native wrappers (Electron, Tauri, Android POS) without backend architectural changes.

---

## Section 3 — Platform Overview

OrderRail is an ecosystem of specialized web applications:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  ORDERRAIL ECOSYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌──────────────────────┐   ┌──────────────────────┐   ┌─────────────────────────────┐  │
│  │ CUSTOMER WEB APP     │   │ COUNTER TERMINAL POS │   │ KITCHEN DISPLAY (KDS)       │  │
│  │ Self-service QR      │   │ Order intake, table  │   │ Line item prep Kanban, KOT  │  │
│  │ menu, cart, payments │   │ grid, billing & cash │   │ dispatch, cook timing       │  │
│  └──────────┬───────────┘   └──────────┬───────────┘   └──────────────┬──────────────┘  │
│             │                          │                              │                 │
│             └──────────────────┬───────┴──────────────────────────────┘                 │
│                                │ Realtime DB & Sync Engine                              │
│                                ▼                                                        │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ OWNER PORTAL                                                                      │  │
│  │ Administrative governance, menu catalog, tax rates, staff, device management      │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Customer Web App:** QR menu browsing, ordering, call staff requests, and payment options.
- **Counter POS Terminal:** Command deck for dine-in tables, takeaway intake, billing, discounts, payments, and thermal receipts.
- **Kitchen Display System (KDS):** Prep queue for line cooks, dish status updates, and thermal KOT print dispatch.
- **Staff Portal:** Staff onboarding, profile management, and shift role assignments.
- **Owner Portal:** Master business control panel for menu catalog, tax settings, staff permissions, revenue analytics, and hardware device management.

---

## Section 4 — Authoritative Specifications

The primary source of truth for OrderRail engineering consists of five authoritative documents:

| Specification Document | Path | Core Scope |
|------------------------|------|------------|
| **`COUNTER_SPEC.md`** | [`./COUNTER_SPEC.md`](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/COUNTER_SPEC.md) | Operational POS specifications, mechanics, offline state machine, and printing. |
| **`COUNTER_DESIGN_V2.md`** | [`./COUNTER_DESIGN_V2.md`](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/COUNTER_DESIGN_V2.md) | UI/UX visual layout, 3-column architecture, design tokens, and hotkeys. |
| **`DEVICE_ARCHITECTURE.md`** | [`./DEVICE_ARCHITECTURE.md`](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/DEVICE_ARCHITECTURE.md) | Hardware identity, 6-digit pairing code workflow, dual tokens, and health telemetry. |
| **`COUNTER_AUTH_SPEC.md`** | [`./COUNTER_AUTH_SPEC.md`](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/COUNTER_AUTH_SPEC.md) | Netflix profile picker, PIN auth, atomic permission bundles, and 3 shift modes. |
| **`CORE_STATE_MACHINES.md`** | [`./CORE_STATE_MACHINES.md`](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/CORE_STATE_MACHINES.md) | State transition FSMs for Sessions, Orders, Items, Tables, Payments, Devices, and Shifts. |

All implementation tasks **must strictly follow these documents**.

---

## Section 5 — Locked Architectural Decisions

The following fundamental design decisions are now **FROZEN at v1.0**:

1. **Dedicated Device Model:** Hardware terminals are permanently registered to cafés via `device_id`.
2. **Simplified 6-Digit Device Pairing:** Server-validated 6-digit pairing code exchange issuing long-lived device tokens.
3. **Operator Profile & PIN Auth:** Cashiers authenticate via Netflix-style profile selection + 4-digit PIN (<100ms SLA).
4. **Atomic Permission Bundle Architecture:** Operations governed by atomic permission strings (`orders.create`, `billing.process`, `billing.discount.large`) grouped into permission bundles.
5. **Configurable Shift Modes:** Supports Mode 1 (Disabled), Mode 2 (Simple Operator Tracking), and Mode 3 (Advanced Cash Float & Z-Reports).
6. **State Machine Driven Logic:** All business rules enforce formal FSM state transitions.
7. **3-Column Widescreen Counter Layout:** Physical Table Grid (30%), Order Workspace (45%), Billing Sidebar (25%).
8. **Offline Queue & Idempotency Engine:** Local IndexedDB operations with idempotent cloud sync RPCs (`submit_order_idempotent`).

---

## Section 6 — Engineering Rules

Engineers contributing to OrderRail must follow eight mandatory rules:

1. **Obey State Machine Rules:** Business logic mutations must follow the formal FSM contracts in `CORE_STATE_MACHINES.md`. Invalid transitions must throw explicit errors.
2. **Integrate With Existing Architecture:** New features must extend existing patterns rather than creating parallel systems.
3. **No Redundant Abstractions:** Reuse existing components, hooks (`useCafe`, `useAuth`, `usePermissions`), and DB utilities.
4. **Maintain Component Modularity:** Keep UI components focused, decoupled, and reusable across device types.
5. **Prioritize Backward Compatibility:** Database migrations and RPC signatures must preserve existing client compatibility.
6. **Document Before Implementing:** Any necessary architectural adjustment must be documented and reviewed before writing code.
7. **No Feature Shortcuts:** Never bypass authentication, RLS policies, audit logs, or offline queues for temporary convenience.
8. **Empirical Log Verification:** Bug fixes and features require runtime validation (`npm test`, `npx tsc --noEmit`, `npm run build`).

---

## Section 7 — Implementation Roadmap

Engineering execution proceeds in the following sequential implementation order:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 IMPLEMENTATION ROADMAP                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Counter Layout Foundation & Shell                [COMPLETED v1.0]              │
│ PHASE 2: Counter Core Engine (Active Cart, Menu, Table Sessions)                          │
│ PHASE 3: Billing & Settlement Engine (Discounts, Tender, Invoices)                      │
│ PHASE 4: Kitchen Display System (KDS & Prep Kanban)                                     │
│ PHASE 5: ESC/POS Thermal Printing Spooler Engine                                        │
│ PHASE 6: Offline Synchronization & Idempotent Worker Engine                             │
│ PHASE 7: Owner Hardware Device Dashboard & Remote Control                               │
│ FUTURE:   Waiter Handhelds, Kiosks, Customer Displays, Inventory, Native Desktop Wrappers │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Priorities may be adjusted by product requirements, but the underlying v1.0 architecture remains stable.

---

## Section 8 — Architecture Change Policy

### 8.1 Acceptable Reasons for Architectural Adjustments
- Critical implementation blocker discovered during code execution.
- Verified security vulnerability or risk.
- Major scalability or performance bottleneck proved via empirical benchmarks.
- Flawed assumption that breaks fundamental operational requirements.

### 8.2 Unacceptable Reasons
- Personal coding preferences or syntax opinions.
- Minor UI layout tweaks that do not alter data flow.
- Convenience shortcuts that bypass state machines or security rules.
- Temporary hacks.

### 8.3 Change Approval Process
1. Document the proposed change, rationale, and impacted specification files.
2. Verify backward compatibility for active cafés and device tokens.
3. Update relevant specifications (`DEVICE_ARCHITECTURE.md`, `CORE_STATE_MACHINES.md`, etc.).
4. Tag specification update with incremental version string (e.g. `v1.1`).

---

## Section 9 — Definition of Architecture Complete

OrderRail's architectural design phase is officially **COMPLETE**.

- The platform baseline is established.
- Engineering focus transitions 100% to software implementation.
- Documentation will evolve only to reflect verified implementation realities or approved architectural change proposals under Section 8.
