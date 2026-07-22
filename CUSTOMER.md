# OrderRail — Customer Experience Architecture

> **Definitive Customer Experience Architecture Document** for OrderRail, detailing the end-to-end guest journey, zero-friction QR dining, collaborative ordering, offline resilience, real-time tracking, and accessibility standards.

---

## Table of Contents
- [1. Purpose & System Role](#1-purpose--system-role)
- [2. Design Philosophy](#2-design-philosophy)
- [3. End-to-End Customer Journey](#3-end-to-end-customer-journey)
- [4. Entry Points](#4-entry-points)
- [5. Dining Session Lifecycle](#5-dining-session-lifecycle)
- [6. Menu Browsing](#6-menu-browsing)
- [7. Cart Management](#7-cart-management)
- [8. Ordering Workflow](#8-ordering-workflow)
- [9. Collaborative Ordering](#9-collaborative-ordering)
- [10. Service Requests](#10-service-requests)
- [11. Order Tracking](#11-order-tracking)
- [12. Billing Experience](#12-billing-experience)
- [13. Feedback & Reviews](#13-feedback--reviews)
- [14. Offline & Recovery Architecture](#14-offline--recovery-architecture)
- [15. Security & Permissions](#15-security--permissions)
- [16. Accessibility & Responsiveness](#16-accessibility--responsiveness)
- [17. Performance Goals & SLAs](#17-performance-goals--slas)
- [18. Future Customer Features](#18-future-customer-features)
- [19. Cross-References & Related Documentation](#19-cross-references--related-documentation)

---

## 1. Purpose & System Role

### 1.1 Customer Application's Role
The OrderRail Customer web application is the primary guest interface for self-service dining. It allows restaurant patrons to scan a QR code at their physical table, browse the digital menu, place food and beverage orders, trigger real-time staff assistance, track kitchen progress, and inspect their dining bill directly from their mobile browser without downloading an app or creating an account.

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                CUSTOMER MOBILE WEB APP                                    │
│             (Zero-Download Mobile-First PWA — Instant QR Code Access)                      │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
                    ▼                                                   ▼
┌─────────────────────────────────────────┐         ┌─────────────────────────────────────────┐
│              POSTGRESQL DB              │         │            COUNTER TERMINAL             │
│        (Shared Session & Orders)        │         │      (Realtime Order Fulfillment)       │
└─────────────────────────────────────────┘         └─────────────────────────────────────────┘
```

### 1.2 Relationship with Counter, Database, and Owner
1. **With Database:** Customer devices operate under the unauthenticated `anon` PostgreSQL role, communicating via PostgREST and Supabase Realtime to mutate and listen to active `dining_sessions`, `orders`, and `service_requests` (as specified in [`DATABASE.md`](./DATABASE.md)).
2. **With Counter:** Orders placed by customers instantly stream to the Counter Terminal (`COUNTER.md`) for kitchen preparation and status updates (`pending` → `preparing` → `ready` → `served`).
3. **With Owner:** Reads published menu items, categories, pricing, and operating hours managed in the Owner Portal.

---

## 2. Design Philosophy

### 2.1 Frictionless Self-Service Ordering
Guests at a restaurant table want to order quickly without administrative hurdles:
- **No App Download Required:** Built as a progressive web app running in native iOS Safari and Android Chrome.
- **No Account Creation / Sign-In Required:** Guests can order immediately upon QR scan without providing emails or passwords.
- **Instant Scan-to-Menu Latency:** Target < 1.5s from camera QR trigger to interactive menu presentation.

### 2.2 Mobile-First Touch Interaction
Designed specifically for small touchscreens:
- Dynamic floating cart button anchored at bottom right for easy thumb reach.
- Large touch targets (minimum 44x44px touch boundaries).
- Smooth sticky category navigation for effortless fast scrolling through long menus.

### 2.3 Dining Session-Centric Design
The customer experience is anchored to the table's physical **`dining_session_id`**.
- Guests joining the table automatically attach to the active session.
- Allows multiple diners at the same table to view shared order progress and request assistance collaboratively.

---

## 3. End-to-End Customer Journey

```mermaid
journey
    title Complete Customer Dining Experience Lifecycle
    section Arrival & Scan
      Scan Table QR Code: 5: Customer
      Bind Dining Session: 5: System
    section Menu & Cart
      Browse Categories & Items: 4: Customer
      Add Items to Cart: 5: Customer
    section Ordering & Kitchen
      Submit Order: 5: Customer
      Track Live Status (Preparing/Ready): 4: Customer & System
    section Service & Bill
      Call Staff (Water/Bill): 5: Customer
      Inspect Final Bill: 4: Customer
    section Departure
      Staff Frees Table: 5: Staff
      Submit Star Review: 5: Customer
```

---

## 4. Entry Points

### 4.1 Table QR Code Scan (Primary)
- Customer scans the physical QR code fixed to their table (URL pattern: `/t/:tableId`).
- `TableLayout.tsx` extracts `tableId`, initializes or attaches to the active `dining_session_id`, and redirects to `/t/:tableId/menu`.

### 4.2 Shared Session Links (Future)
- A guest at Table 4 taps "Share Table Link", sending a URL with encoded `session_token` to friends via WhatsApp or SMS so late arrivals join the exact same ordering session.

### 4.3 Advance Pre-Ordering & Reservations (Future)
- Customers scanning a promotional link pre-select items for an upcoming table reservation.

---

## 5. Dining Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> QR_Scan : Scan /t/:tableId
    QR_Scan --> Join_Session : Extract tableId
    
    state Join_Session {
        [*] --> Fetch_Table
        Fetch_Table --> Check_Active_Session
        Check_Active_Session --> Reuse_Active : Active Session Found
        Check_Active_Session --> Create_Browsing : No Session Found
    }
    
    Join_Session --> Browsing : Render Menu
    Browsing --> Active_Session : First Order Submitted
    Active_Session --> Active_Session : Additional Order Rounds
    
    Active_Session --> Table_Freed : Staff executes free_table
    Table_Freed --> Review_Prompt : Show Feedback Dialog
    Review_Prompt --> [*]
```

### 5.1 Joining & Continuing Sessions
- **First Diner:** Scanning QR creates a `dining_sessions` row with `status: 'browsing'`.
- **Subsequent Diners:** Scanning the same QR reuses the existing active session.
- **Browser Refresh Recovery:** If a customer reloads the page, `TableLayout.tsx` re-reads `tableId`, queries PostgreSQL for non-closed `dining_sessions`, and restores session context seamlessly.

---

## 6. Menu Browsing

### 6.1 Categories & Item Catalog
- Menu items are grouped under `menu_categories` (e.g. *Appetizers*, *Main Course*, *Beverages*, *Desserts*).
- Each item displays name, description, price, food type icon (`veg`, `non-veg`, `egg`), and image URL.

### 6.2 Real-Time Availability & Out-of-Stock Handling
- If staff marks an item `is_available = false` in the Owner Portal or Counter, Supabase Realtime updates the customer menu instantly.
- Unavailable items render with a greyed-out "Out of Stock" badge and disable the "Add to Cart" button.

---

## 7. Cart Management

### 7.1 Local Persistence & Dynamic Calculations
- Cart state is managed locally via React component state and persisted in browser `localStorage`.
- Item subtotals, quantity adjustments, and overall cart total in cents are calculated dynamically in real-time.

### 7.2 Session Cart Synchronization
- Placing an order pushes the cart items to `orders` and `order_items` in PostgreSQL.
- Once submitted, local cart clears, and items transition to the live **Order Status View**.

---

## 8. Ordering Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Guest as Customer Mobile
    participant UI as TableCartPage.tsx
    participant DB as PostgreSQL
    participant Staff as Staff Dashboard

    Guest->>UI: Tap "Place Order"
    UI->>UI: Validate Cart (items > 0, quantities valid)
    UI->>DB: INSERT INTO orders (cafe_id, table_id, dining_session_id, total_cents)
    DB-->>UI: Return order_id
    UI->>DB: INSERT INTO order_items (order_id, menu_item_id, qty, price_cents)
    UI->>DB: UPDATE dining_sessions SET status = 'active' WHERE id = sessionId
    DB-->>Staff: Postgres Realtime WAL Broadcast (INSERT on orders)
    UI->>UI: Clear Local Cart & Switch to Order Tracking Screen
```

---

## 9. Collaborative Ordering

- **Shared Dining Session:** Multiple diners sitting at Table 4 share the exact same `dining_session_id`.
- **Independent Cart & Device:** Each diner can add items on their own phone independently.
- **Unified Order Progress & Billing:** All order rounds submitted by any phone attach to Table 4's dining session. The combined bill displays all items ordered across all rounds.

---

## 10. Service Requests (Call Staff)

Customers can summon staff directly from their phone screen via `CallStaff.tsx`:

```
┌─────────────────────────────────────────────────────────┐
│                   CALL STAFF ASSISTANCE                 │
├─────────────────────────────────────────────────────────┤
│  [ 💧 Request Water ]         [ 🔔 Call Waiter ]        │
│  [ 🧾 Bring Bill ]            [ ❓ Custom Request ]     │
└─────────────────────────────────────────────────────────┘
```

1. Customer selects request type (`water`, `waiter`, `bill`, `custom`).
2. System inserts a row into `service_requests` (`status: 'open'`).
3. Cooldown timer (60 seconds) activates on the customer button to prevent spamming.
4. Staff dashboard displays floating badge and sounds audio chime. When staff taps "Acknowledge", customer screen updates to **"Staff Notified & On Their Way"**.

---

## 11. Order Tracking

Real-time status pipeline displayed on customer device (`OrderStatusView.tsx`):

| Order Status | Customer Badge Color | Visual Message | Customer Experience |
|--------------|----------------------|----------------|---------------------|
| `pending` | Amber | *"Order Sent to Kitchen"* | Kitchen received ticket. |
| `preparing` | Blue | *"Chef is Preparing Your Food"* | Cooking in progress. |
| `ready` | Green | *"Food Ready — Serving Shortly"* | Plated in kitchen. |
| `served` | Neutral / Emerald | *"Delivered to Your Table"* | Order complete. |
| `cancelled` | Red | *"Order Cancelled"* | Cancelled by staff/manager. |

---

## 12. Billing Experience

### 12.1 Viewing Totals & Requesting Bill
- Customers tap "View Session Bill" at any point during their meal.
- Displays an itemized breakdown of all orders placed during the session, formatted subtotal, taxes, and net amount.
- Tapping "Request Bill" sends a `bill` service request ticket to the Counter terminal.

### 12.2 Payment Flow
- **Current Model:** Counter staff receives bill request, prints physical invoice receipt, and collects cash/card/UPI at table or counter.
- **Future Model:** Embedded Razorpay / Stripe gateway link allowing customer to pay digitally from their phone screen.

---

## 13. Feedback & Reviews

- When staff executes `free_table` RPC on Table 4, the active session closes.
- Supabase Realtime notifies Table 4 customer devices.
- Customer screen automatically presents a **"Thank You for Dining!"** feedback dialog prompting for a 1-5 star rating and optional text review (`ReviewForm.tsx`), saved to `reviews` table.

---

## 14. Offline & Recovery Architecture

1. **Cached Menu Data:** Menu items and categories are cached locally in browser storage using TanStack React Query (`staleTime: 5 mins`). If network drops while browsing, menu remains readable.
2. **Offline Cart Resilience:** Shopping cart state persists in `localStorage`.
3. **Queued Order Submissions:** If customer taps "Place Order" while offline, `orderQueue.ts` saves the order payload into IndexedDB. Upon network recovery, order posts automatically.
4. **Browser Refresh Recovery:** Page reload reads `tableId` from URL path, fetches active session from PostgreSQL, and resumes tracking state without data loss.

---

## 15. Security & Permissions

- **`anon` Role Capabilities:** Anonymous customer clients can read active tables/menu items, create dining sessions, insert orders/order_items/service_requests, and update table status to `occupied`.
- **Restricted Actions:** Customers **cannot** edit menu prices, modify structural table metadata (`trg_enforce_demo_table_update_protection`), view orders from other tables, or mark tables `free`.
- **Session Isolation:** Queries filter strictly by `table_id` or `dining_session_id`.

---

## 16. Accessibility & Responsiveness

- **Mobile-First Responsive Layouts:** Optimized for screen widths from 320px (compact smartphones) to 768px (tablets).
- **Touch Target Sizing:** Interactive buttons adhere to minimum **44x44px** touch target dimensions.
- **Color Contrast:** High contrast text labels and ARIA support for badges and order statuses.
- **Future Multilingual Support:** Multi-language toggle (English, Hindi, Spanish) for menu titles and UI labels.

---

## 17. Performance Goals & SLAs

- **QR Scan to Menu Load:** < 1.5 seconds on 4G connection.
- **Menu Scroll Responsiveness:** 60 FPS smooth scrolling.
- **Order Placement Latency:** < 300ms to local UI confirmation.
- **Real-Time Status Update Sync:** < 150ms WAL latency from staff action to customer screen badge change.

---

## 18. Future Customer Features

1. **Digital Mobile Payments:** In-app UPI / Apple Pay / Google Pay payment settlement.
2. **AI Dish Recommendations:** Smart suggestions based on popularity and dietary preferences.
3. **Customer Loyalty Points:** Earning points per session tied to phone numbers.
4. **Split-Bill Calculator:** Allowing guests to select individual line items and split payments directly on mobile.

---

## 19. Cross-References & Related Documentation

- [`./DATABASE.md`](./DATABASE.md) — Comprehensive PostgreSQL database design, RLS permissions matrix, and schema specifications.
- [`./ARCHITECTURE.md`](./ARCHITECTURE.md) — System Architecture, Component Hierarchy, and Realtime Engine.
- [`./PRODUCT.md`](./PRODUCT.md) — Product Requirements & Feature Specifications.
- [`./COUNTER.md`](./COUNTER.md) — Counter Operational Architecture & Staff Handover Governance.
- [`./DEVELOPMENT_WORKFLOW.md`](./DEVELOPMENT_WORKFLOW.md) — Engineering standards and testing guidelines.
