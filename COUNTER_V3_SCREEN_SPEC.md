# OrderRail — Counter V3 Screen Specification (COUNTER_V3_SCREEN_SPEC.md)

> **Definitive Screen-by-Screen UI Specification Manual** for OrderRail Counter Interface v3. Fully annotates every screen, layout state, interaction workflow, focus state, touch target, and animation behavior to eliminate all UI ambiguity prior to engineering implementation.

---

## Authoritative Reference Alignment

This specification strictly adheres to:
- [`ARCHITECTURE_LOCK.md`](./ARCHITECTURE_LOCK.md) (v1.0 Architecture Lock)
- [`COUNTER_V3_UX_REDESIGN.md`](./COUNTER_V3_UX_REDESIGN.md) (UX Redesign Philosophy & 53% Noise Reduction)
- [`COUNTER_V3_LAYOUTS.md`](./COUNTER_V3_LAYOUTS.md) (2-Pane Primary Deck & Contextual Billing Drawer Wireframes)
- [`COUNTER_V3_USER_FLOWS.md`](./COUNTER_V3_USER_FLOWS.md) (Cashier Workflows & Hotkey Matrix)
- [`COUNTER_V3_DESIGN_REVIEW.md`](./COUNTER_V3_DESIGN_REVIEW.md) (Senior Product Design Critique & Scorecard)

---

## Table of Contents

- [1. Screen 1: Default Counter Screen](#1-screen-1-default-counter-screen)
- [2. Screen 2: Table Selected State (Occupied Table)](#2-screen-2-table-selected-state-occupied-table)
- [3. Screen 3: Open Table Flow (Available Table)](#3-screen-3-open-table-flow-available-table)
- [4. Screen 4: Order Building Flow (Catalog & Cart)](#4-screen-4-order-building-flow-catalog--cart)
- [5. Screen 5: Submit KOT State](#5-screen-5-submit-kot-state)
- [6. Screen 6: Contextual Billing Drawer](#6-screen-6-contextual-billing-drawer)
- [7. Screen 7: Payment Success Overlay State](#7-screen-7-payment-success-overlay-state)
- [8. Screen 8: Service Request Notification Popover](#8-screen-8-service-request-notification-popover)
- [9. Screen 9: Search Mode Screen](#9-screen-9-search-mode-screen)
- [10. Screen 10: Empty State Screen](#10-screen-10-empty-state-screen)
- [11. Screen 11: Loading State Screen](#11-screen-11-loading-state-screen)
- [12. Screen 12: Offline Mode State](#12-screen-12-offline-mode-state)
- [13. Screen 13: Error State & Validation Modal](#13-screen-13-error-state--validation-modal)
- [14. Screen 14: Large Venue Floor Zone Layout](#14-screen-14-large-venue-floor-zone-layout)
- [15. Screen 15: Touch POS Handheld Mode](#15-screen-15-touch-pos-handheld-mode)
- [16. Screen 16: Keyboard Focus & Focus Trap States](#16-screen-16-keyboard-focus--focus-trap-states)

---

## 1. Screen 1: Default Counter Screen

### 1.1 Annotated Layout Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ [A] Header Bar (56px)
│ [A1] OrderRail POS │ [A2] Cafe Central │ [A3] Cashier: Sarah M. │ [A4] 🔔 2 Calls │ [A5] NET: ● ONLINE │ [A6] PRINTER: ● READY  │
├──────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────┤
│ [B] PANE 1: TABLES DECK (35% Width)      │ [C] PANE 2: ACTIVE OPERATIONAL WORKSPACE (65% Width)                         │
│ [B1] Filter Pills:                       │ [C1] Session Header: Table 4 (Dine-In • 4 Guests • 34m ago)                  │
│ [ All (12) ] [ Free (8) ] [ Active (4) ] │ [C2] Search Input: [ Search Menu by name or code... (F2)                   ] │
├──────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ [B2] Physical Table Cards Grid:          │ [C3] Category Selector: [All] [Coffee] [Food] [Beverages] [Desserts]         │
│ ┌──────────────────┐ ┌──────────────────┐├──────────────────────────────────────────────────────────────────────────────┤
│ │ TABLE 1    [FREE]│ │ TABLE 2 [OCCUPIED]││ [C4] Menu Catalog Items Grid:                                                │
│ │ 4 Seats          │ │ 💧 14m ago       ││ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│ └──────────────────┘ └──────────────────┘│ │ Double Espresso  │ │ Club Sandwich    │ │ Iced Latte       │ │ Truffle Fries│ │
│ ┌──────────────────┐ ┌──────────────────┐│ │ $4.50     [+Add] │ │ $12.00    [+Add] │ │ $5.50     [+Add] │ │ $8.00  [+Add]│ │
│ │ TABLE 3    [FREE]│ │ TABLE 4 [BILL REQ]││ └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────┘ │
│ │ 6 Seats          │ │ 🧾 32m ago [★]   │├──────────────────────────────────────────────────────────────────────────────┤
│ └──────────────────┘ └──────────────────┘│ [C5] Active Cart Line Items (4 Items):                      Subtotal: $37.50│
│ ┌──────────────────┐ ┌──────────────────┐│ • 1x Double Espresso                              @ $4.50  = $4.50         │
│ │ TABLE 5  [CLEAN] │ │ TABLE 6 [OCCUPIED]││ • 2x Artisan Club Sandwich                        @ $12.00 = $24.00        │
│ │ Mark Available   │ │ 05m ago          ││ • 1x Iced Latte (Extra ice)                       @ $5.50  = $5.50         │
│ └──────────────────┘ └──────────────────┘│ • 1x Sparkling Water                              @ $3.50  = $3.50         │
│ ┌──────────────────┐ ┌──────────────────┐├──────────────────────────────────────────────────────────────────────────────┤
│ │ TABLE 7  [RESERV]│ │ TABLE 8    [FREE]││ [C6] Primary Action Bar:                                                     │
│ │ 19:30 Booking    │ │ 4 Seats          ││ [ CLEAR CART (Esc) ]      [ SUBMIT KOT (F5) ]      [ COLLECT PAYMENT (F10) ➔ ]   │
│ └──────────────────┘ └──────────────────┘│                                                                              │
├──────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────┤ [D] Status Bar (32px)
│ [D1] QUICK KEYS: [F1: Takeaway] [F2: Search] [F3: Calls (2)] [F5: KOT] [F8: Print Bill] [F10: Collect Payment] │ [D2] 100% OK │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Labels & Visual Priorities

1. **[A] Header Bar (56px fixed):**
   - **[A1] Brand Badge:** High-contrast logo (`OR`).
   - **[A2] Tenant Title:** Café name (`Cafe Central`).
   - **[A3] Cashier Badge:** Currently authenticated cashier name (`Sarah M.`).
   - **[A4] Service Call Badge:** Floating notification trigger (`🔔 2 Calls`).
   - **[A5] Network Indicator:** Online status (`● ONLINE`).
   - **[A6] Printer Status:** Hardware health (`● READY`).
2. **[B] Pane 1: Tables Deck (35% width):**
   - **[B1] Filter Pills:** Status filtering tabs.
   - **[B2] Table Cards Grid:** Minimalist 3-point table cards (Label, Status Badge, Elapsed Time, Service Alert Micro-badge).
3. **[C] Pane 2: Active Workspace (65% width):**
   - **[C1] Table Session Header:** Metadata banner for currently selected table.
   - **[C2] Menu Search:** Instant sub-50ms search input.
   - **[C3] Category Selector:** Filter pills for dish categories.
   - **[C4] Menu Catalog Grid:** Item cards with price and `+ Add` button.
   - **[C5] Active Cart Line Items:** Itemized cart list with line item notes and subtotal.
   - **[C6] Primary Action Bar:** High-contrast CTAs (`Clear Cart`, `Submit KOT`, `Collect Payment ➔`).
4. **[D] Persistent Status Bar (32px fixed):**
   - **[D1] Quick Keys Bar:** Shortcut hint pills.
   - **[D2] Sync Indicator:** Realtime engine sync status (`100% OK`).

---

## 2. Screen 2: Table Selected State (Occupied Table)

### 2.1 Specification Details

- **Purpose:** Display active session details and order history for an occupied dining table.
- **Visible Components:**
  - Workspace Header updates: `Table 4 (Dine-In • 4 Guests • Session #s-9821 • 34m ago)`.
  - Active Cart populated with line items ordered by Table 4.
  - Action Bar displays: `[ CLEAR CART (Esc) ]`, `[ SUBMIT KOT (F5) ]`, `[ COLLECT PAYMENT (F10) ➔ ]`.
- **Primary Action:** `[ COLLECT PAYMENT (F10) ➔ ]` (Triggers Billing Drawer slide-over).
- **Secondary Actions:** Add new items from Catalog, edit line item notes, or press `F8` to print invoice.
- **Hidden Information:** Financial cash tender calculations and discount sliders remain hidden until Billing Drawer opens.
- **Keyboard Behavior:** `Arrow Keys` navigate table cards. Pressing `F10` opens Billing Drawer with focus on payment tender.
- **Expected Animation:** Selected Table Card highlights with a 150ms spring scale (`scale(1.02)`) and emerald ring glow (`ring-2 ring-brand`).

---

## 3. Screen 3: Open Table Flow (Available Table)

### 3.1 Specification Details

- **Purpose:** Allow cashier to open a new dining session for a free table.
- **Visible Components:**
  - Selected Table Card: `Table 1 [FREE]`.
  - Workspace Header displays: `Table 1 (Available • 4 Seats)`.
  - Banner Alert: `Table 1 is currently FREE. Tap "+ Open Session" to begin.`.
  - Action Button: `[ + OPEN SESSION (Enter) ]`.
- **Primary Action:** Click `[ + OPEN SESSION ]` or press `Enter`.
- **Secondary Actions:** Reserve Table, Mark Out of Service.
- **Hidden Information:** Cart is empty; no line items or totals displayed.
- **Keyboard Behavior:** Pressing `Enter` executes `openTable("t-1")` RPC, creates `DiningSessionModel` (`status: "OPEN"`), and focuses Menu Search input.
- **Expected Animation:** Table card badge transitions from Green `FREE` to Amber `OCCUPIED` in 150ms.

---

## 4. Screen 4: Order Building Flow (Catalog & Cart)

### 4.1 Specification Details

- **Purpose:** Allow cashier to rapidly add dishes, beverages, and line item notes to the active cart.
- **Visible Components:**
  - Menu Search input field with search string (`"Latte"`).
  - Category Pills: `[Coffee]` highlighted.
  - Menu Catalog cards filtered to matching items.
  - Active Cart showing added items, quantity adjusters (`[-] 1 [+]`), and note inputs (`"Extra ice"`).
- **Primary Action:** `[ SUBMIT KOT (F5) ]`.
- **Secondary Actions:** Modify quantity, remove line item (`Del`), clear cart draft (`Esc`).
- **Hidden Information:** Billing settlement controls.
- **Keyboard Behavior:** Typing filters catalog live. Pressing `Enter` adds highlighted item. Pressing `F5` submits KOT.
- **Expected Animation:** Added cart item flashes `bg-brand/10` for 200ms upon insertion.

---

## 5. Screen 5: Submit KOT State

### 5.1 Specification Details

- **Purpose:** Confirm kitchen ticket dispatch and spool ESC/POS thermal print job.
- **Visible Components:**
  - Green Toast Alert: `✅ KOT Ticket #104 Submitted to Kitchen (Table 4)`.
  - Active Cart status updates to `SUBMITTED`.
  - Kitchen Spooler Indicator: `Job #104 ACK`.
- **Primary Action:** Return to table grid or select next table.
- **Keyboard Behavior:** `F5` triggers submission, plays soft chime, and returns focus to Table Grid (`Alt + T`).
- **Expected Animation:** Submit button turns green with checkmark icon for 1000ms.

---

## 6. Screen 6: Contextual Billing Drawer

### 6.1 Specification Details

```
┌────────────────────────────────────────────────────────┐
│ BILLING DRAWER (Slide-Over • 420px Width)              │
├────────────────────────────────────────────────────────┤
│ Table 4 (Session #s-9821 • Dine-In • 4 Guests)         │
├────────────────────────────────────────────────────────┤
│ ITEMIZED BREAKDOWN:                                    │
│   1x Double Espresso                      $4.50        │
│   2x Artisan Club Sandwich               $24.00        │
│   1x Iced Vanilla Latte                   $5.50        │
│   1x Sparkling Water                      $3.50        │
├────────────────────────────────────────────────────────┤
│ FINANCIAL CALCULATIONS:                                │
│   Subtotal:                              $37.50        │
│   Tax (GST 8%):                           $3.00        │
│   Discount (10% Promo):                  -$3.75        │
│   ───────────────────────────────────────────────      │
│   NET AMOUNT DUE:                        $36.75        │
├────────────────────────────────────────────────────────┤
│ PAYMENT TENDER:                                        │
│   Mode:  (●) Cash   ( ) Credit Card   ( ) UPI          │
│   Cash Tendered Input: [ $40.00                ]       │
│   Change Due to Customer:                $3.25         │
├────────────────────────────────────────────────────────┤
│ PRIMARY ACTION BUTTONS:                                │
│   [ F8: PRINT INVOICE ]                                │
│   [ F10: COLLECT CASH & FREE TABLE ➔ ]                 │
└────────────────────────────────────────────────────────┘
```

- **Purpose:** Provide a focused, high-contrast settlement modal without cluttering the main workspace.
- **Visible Components:** Session metadata, itemized price list, Subtotal, GST Tax (8%), Discount Slider (10%), Net Total Due (`$36.75`), Tender Selector (`Cash`, `Card`, `UPI`), Cash Tendered input (`$40.00`), Change Due (`$3.25`), Action Buttons (`F8`, `F10`).
- **Primary Action:** `[ F10: COLLECT CASH & FREE TABLE ➔ ]`.
- **Keyboard Behavior:** Focus is trapped inside the drawer. `Tab` toggles tender modes. `Esc` closes drawer. `Enter` completes payment.
- **Expected Animation:** Slides smoothly from right edge in 200ms (`translateX(0)`). Workspace background dims with 20% dark overlay.

---

## 7. Screen 7: Payment Success Overlay State

### 7.1 Specification Details

- **Purpose:** Confirm successful financial transaction and cash drawer release.
- **Visible Components:**
  - Centered Modal Overlay with Large Green Checkmark Badge (`✓`).
  - Text: `Payment Collected: $36.75 (Cash)`.
  - Subtext: `Change Due: $3.25 | Cash Drawer Opened`.
  - Table Status: `Table 4 marked CLEANING`.
- **Primary Action:** Auto-dismisses after 1.5 seconds (or press `Enter` / `Esc`).
- **Expected Animation:** Checkmark scale-in animation (`scale(0) → scale(1)` with spring bounce). Audio success chime.

---

## 8. Screen 8: Service Request Notification Popover

### 8.1 Specification Details

- **Purpose:** Display pending customer QR assistance requests without taking up permanent grid space.
- **Visible Components:**
  - Header Badge: `🔔 2 Calls` (Amber pulsing dot).
  - Floating Popover Card (Width: 320px):
    - `💧 Table 2: Water requested (45s ago)` `[ Acknowledge ]`
    - `🧾 Table 4: Bill requested (12s ago)` `[ View Session ]`
- **Primary Action:** Click `[ Acknowledge ]` or `[ View Session ]`.
- **Keyboard Behavior:** `F3` opens popover. `Esc` dismisses popover.
- **Expected Animation:** Popover fades and drops down 8px from header bell icon (`opacity: 0 → 1`, `translateY(-8px → 0)`).

---

## 9. Screen 9: Search Mode Screen

### 9.1 Specification Details

- **Purpose:** Live sub-50ms catalog filtering when searching for specific dishes or code numbers.
- **Visible Components:**
  - Search Input: Focused with active query text (`"Pizza"`).
  - Highlighted search matches in catalog grid.
  - Keyboard hint badge: `Press Enter to add first match`.
- **Primary Action:** `Enter` to add top search result to cart.
- **Keyboard Behavior:** `F2` focuses search input immediately. `Esc` clears search text.

---

## 10. Screen 10: Empty State Screen

### 10.1 Specification Details

- **Purpose:** Render clean guidance when no table is selected or table grid is empty.
- **Visible Components:**
  - Center Illustration Icon: `ShoppingBag` in muted container.
  - Title: `No Active Table Selected`.
  - Subtext: `Select a physical table from the left grid or press F1 to open a Takeaway order.`.
  - Action Button: `[ F1: New Takeaway Order ]`.

---

## 11. Screen 11: Loading State Screen

### 11.1 Specification Details

- **Purpose:** Display feedback during initial workspace boot or cloud sync fetch.
- **Visible Components:**
  - Center Loading Spinner (`RotateCw` animation in brand green).
  - Text: `Loading Counter Workspace & Table Engine...`.
  - Subtext: `Syncing IndexedDB Local Cache (100%)`.

---

## 12. Screen 12: Offline Mode State

### 12.1 Specification Details

- **Purpose:** Alert cashier that internet connection is offline and operations are running locally.
- **Visible Components:**
  - Header Badge updates: `✖ OFFLINE (Local IndexedDB Mode)`.
  - Top Banner Alert (Amber/Orange): `⚠️ Network Disconnected. Orders & receipts are saving locally to IndexedDB. Auto-sync will resume upon connection.`.
- **Primary Action:** Continue normal order intake and local thermal printing.

---

## 13. Screen 13: Error State & Validation Modal

### 13.1 Specification Details

- **Purpose:** Alert cashier when an invalid state transition or operation is rejected by the Table Engine.
- **Visible Components:**
  - Error Modal Dialog with Warning Icon (`AlertTriangle`).
  - Title: `Invalid Operation Rejected`.
  - Reason Text: `Cannot open Table 11 because it is currently OUT OF SERVICE.`.
  - Actions: `[ OK (Esc) ]` `[ Restore Service ]`.

---

## 14. Screen 14: Large Venue Floor Zone Layout

### 14.1 Specification Details

- **Purpose:** Prevent vertical scroll fatigue for large restaurants with 25+ physical tables.
- **Visible Components:**
  - Floor Zone Filter Pills above Table Grid in Pane 1:
    `[ All (28) ] [ Main Floor (12) ] [ Patio (8) ] [ Bar (8) ]`
  - Selecting a zone tab filters Pane 1 grid cards instantly.

---

## 15. Screen 15: Touch POS Handheld Mode

### 15.1 Specification Details

- **Purpose:** Adapt Counter V3 to 5-inch to 8-inch touch POS handheld devices (375px–480px width).
- **Visible Components:**
  - Single active pane layout.
  - Bottom Touch Navigation Bar (Height: 56px, Touch targets: 48×48px):
    `[ 🪑 Tables ]  [ 🛒 Active Cart (4) ]  [ 💳 Settlement ]`
  - All button heights expanded to 48px with 12px touch padding.

---

## 16. Screen 16: Keyboard Focus & Focus Trap States

### 16.1 Specification Details

- **Purpose:** Guarantee 100% keyboard accessibility and visual focus tracking for mouse-free cashiers.
- **Visible Components:**
  - Active focused element displays a high-contrast 2px brand focus ring: `ring-2 ring-brand ring-offset-2 ring-offset-background`.
  - When Billing Drawer opens, keyboard focus traps inside the drawer elements (`Tab` loops inside drawer; `Esc` exits drawer).
