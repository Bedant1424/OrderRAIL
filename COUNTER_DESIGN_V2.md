# OrderRail — Counter Interface Design & UI/UX Specification v2 (COUNTER_DESIGN_V2.md)

> **Definitive UI/UX Design Specification & Visual Layout Blueprint** for the next-generation OrderRail Counter Interface v2, engineered from [`COUNTER_SPEC.md`](./COUNTER_SPEC.md) for maximum cashier speed, high information density, sub-second keyboard navigation, and bulletproof offline operational clarity.

---

## Table of Contents
- [1. Design Philosophy & Core UI/UX Principles](#1-design-philosophy--core-uiux-principles)
- [2. Information Architecture & Hierarchy](#2-information-architecture--hierarchy)
- [3. Primary Display Layouts & ASCII Wireframes](#3-primary-display-layouts--ascii-wireframes)
- [4. Screen 1: Home / Live Operations Deck](#4-screen-1-home--live-operations-deck)
- [5. Screen 2: Order Workspace Detail](#5-screen-2-order-workspace-detail)
- [6. Screen 3: Billing & Settlement Panel](#6-screen-3-billing--settlement-panel)
- [7. Status System & Health Notifications](#7-status-system--health-notifications)
- [8. Keyboard-First Workflow & Keybindings](#8-keyboard-first-workflow--keybindings)
- [9. Responsive Behavior & Screen Adaptations](#9-responsive-behavior--screen-adaptations)
- [10. Visual Tokens: Color, Contrast & Typography](#10-visual-tokens-color-contrast--typography)
- [11. Component Specifications & Component States](#11-component-specifications--component-states)
- [12. Accessibility & Prolonged Daily Use Standards](#12-accessibility--prolonged-daily-use-standards)
- [13. Cross-References & Related Documentation](#13-cross-references--related-documentation)

---

## 1. Design Philosophy & Core UI/UX Principles

The Counter Interface v2 is designed specifically for **high-pressure, high-volume restaurant cashier terminals**. It prioritizes operational speed over decorative ornamentation, ensuring cashiers can execute peak-hour tasks with zero hesitation.

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                  CORE UI/UX PRINCIPLES                                    │
├───────────────────┬───────────────────┬───────────────────┬───────────────────────────────┤
│  MINIMAL CLICKS   │ HIGH INFORMATION  │ ZERO-LATENCY FEED │   ERROR PREVENTATIVE DESIGN   │
│                   │      DENSITY      │       BACK        │                               │
│ Max 2 actions per │ All key data visible│ Immediate visual/ │ Requires PIN for destructive  │
│ POS transaction.  │ on 1 screen view. │ audio response.   │ actions; atomic undo support. │
└───────────────────┴───────────────────┴───────────────────┴───────────────────────────────┘
```

1. **Minimal Clicks / One-Key Triggers:** Common operations (opening a table, adding items, printing bills, collecting cash) require at most **1 click or 1 function keypress**.
2. **High Information Density:** Eliminates unnecessary white space to display physical table grid states, kitchen Kanban queues, and billing itemization on a single widescreen layout without context switching.
3. **Immediate Visual & Audio Feedback:** Every action produces a distinct, high-contrast visual transition (e.g. badge color flash) and an optional physical audio chime for order alerts.
4. **Error Preventative Controls:** Destructive operations (order cancellations, price overrides, session voids) are protected by modal confirmation checks and Manager PIN constraints to eliminate cashier mistakes.
5. **Fast Operational Recovery:** System failures (printer out of paper, network drop) display actionable recovery prompts directly within the persistent status bar.
6. **Ergonomic Accessibility for 8-Hour Shifts:** Dark-mode optimized palette with high contrast text prevents eye strain during long cashier shifts.

---

## 2. Information Architecture & Hierarchy

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                PERSISTENT SYSTEM HEADER BAR                               │
│           (Tenant Name | Cashier ID | Network Status | Printer Status | System Time)       │
├───────────────────────────────┬───────────────────────────────┬───────────────────────────┤
│   PHYSICAL TABLE GRID (30%)   │   ORDER WORKSPACE (45%)       │   BILLING SIDEBAR (25%)   │
│                               │                               │                           │
│ - Filter Tabs (All/Free/Occ)  │ - Intake Mode Switcher        │ - Active Session Header   │
│ - Visual Table Cards (T1-T12) │ - Active Order Item List      │ - Itemized Price Summary  │
│ - Seat Count & Timers         │ - Menu Quick Grid / Search    │ - Tax & Discount Inputs   │
│ - Service Request Alerts      │ - Special Kitchen Notes       │ - Tender Action Buttons   │
├───────────────────────────────┴───────────────────────────────┴───────────────────────────┤
│                               PERSISTENT QUICK ACTIONS BAR                                │
│                     (Function Key Mapping: F1 - F12 | Emergency Actions)                  │
├───────────────────────────────────────────────────────────────────────────────────────────┤
│                             PERSISTENT STATUS & ACTIVITY FEED                             │
│                  (Scrolling Real-time Event Log | Sync Worker Health)                      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Primary Display Layouts & ASCII Wireframes

### 3.1 Primary Desktop Wireframe (1920×1080 Resolution)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ OrderRail POS v2 │ Cafe Central │ Cashier: Sarah M. (ID #402) │ NET: ● ONLINE (WAL LSN 14/82) │ PRINTER: ● READY (Port 9100) │ 14:32:05 │
├─────────────────────────────────────────┬──────────────────────────────────────────┬────────────────────────────────────┤
│ PHYSICAL TABLES (Alt+T)                 │ ORDER WORKSPACE (Alt+M)                  │ BILLING & CASHIER (Alt+B)          │
│ [All (12)] [Free (8)] [Occupied (4)]     │ [ MODE: Dine-In Table 4 ] [Takeaway]     │ SESSION: Table 4 (ID: #s-9821)     │
├─────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────────┤
│ ┌────────────────┐ ┌──────────────────┐ │ SEARCH MENU: [ Espresso             ] [Q]│ ITEM SUMMARY: (4 Items)            │
│ │ TABLE 1   [FREE]│ │ TABLE 2 [OCCUPIED]│ ├──────────────────────────────────────────┤ 1x Double Espresso         $4.50  │
│ │ 4 Seats        │ │ 2 Seats  14m ago │ │ CATEGORIES: [All] [Coffee] [Food] [Dess] │ 2x Artisan Club Sandwich  $24.00  │
│ └────────────────┘ └──────────────────┘ │ ┌──────────────────┐ ┌──────────────────┐ │ 1x Iced Vanilla Latte      $5.50  │
│ ┌────────────────┐ ┌──────────────────┐ │ │ Espresso   $4.50 │ │ Americano  $4.00 │ │ 1x Sparkling Water         $3.50  │
│ │ TABLE 3   [FREE]│ │ TABLE 4 [BILL REQ]│ │ [ + Add ] (Hot)  │ │ [ + Add ] (Hot)  │ ├────────────────────────────────────┤
│ │ 6 Seats        │ │ 4 Seats  32m ago │ └──────────────────┘ └──────────────────┘ │ SUBTOTAL:                 $37.50  │
│ └────────────────┘ └──────────────────┘ │ ┌──────────────────┐ ┌──────────────────┐ │ TAX (GST 8%):              $3.00  │
│ ┌────────────────┐ ┌──────────────────┐ │ │ Club Sand  $12.00│ │ Iced Latte $5.50 │ │ DISCOUNT: [ 10% ]        -$3.75  │
│ │ TABLE 5   [FREE]│ │ TABLE 6 [OCCUPIED]│ │ [ + Add ] (Food) │ │ [ + Add ] (Cold) │ ├────────────────────────────────────┤
│ │ 2 Seats        │ │ 8 Seats  05m ago │ └──────────────────┘ └──────────────────┘ │ TOTAL DUE:                $36.75  │
│ └────────────────┘ └──────────────────┘ ├──────────────────────────────────────────┼────────────────────────────────────┤
│ ┌────────────────┐ ┌──────────────────┐ │ ACTIVE ORDER ITEMS IN CART:              │ PAYMENT METHOD:                    │
│ │ TABLE 7   [FREE]│ │ TABLE 8   [FREE]│ │ - 2x Club Sandwich   @ $12.00 = $24.00  │ [ (●) CASH ]  [ ( ) CARD / UPI ]   │
│ │ 4 Seats        │ │ 4 Seats          │ │ - 1x Iced Latte      @ $5.50  = $5.50   │ CASH TENDERED: [ $40.00          ] │
│ └────────────────┘ └──────────────────┘ │ NOTES: "Extra ice in latte, crisp bacon" │ CHANGE DUE:               $3.25    │
│                                         ├──────────────────────────────────────────┼────────────────────────────────────┤
│ UNREAD SERVICE REQUESTS: (2)            │ [ CLEAR CART (Esc) ]  [ SUBMIT KOT (F5) ] │ [ F8: PRINT BILL ]                 │
│ 💧 Table 2: Water (45s ago)             │                                          │ [ F10: PAY CASH & FREE TABLE ]     │
│ 🧾 Table 4: Bill Request (12s ago)      │                                          │ [ F11: PAY CARD & FREE TABLE ]     │
├─────────────────────────────────────────┴──────────────────────────────────────────┴────────────────────────────────────┤
│ QUICK KEYS: [F1: New Takeaway] [F2: Search Menu] [F3: Service Calls (2)] [F4: Switch Mode] [F8: Print Bill] [F10: Pay Cash]  │
├────────────────────────────────────────────────────────────────────────────────────────────────-------------------------┤
│ STATUS LOG: 14:31:58 - Order #22 (Table 4) submitted to kitchen | KOT Spooler: Job #104 ACK | Supabase Sync: 100% OK    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Screen 1: Home / Live Operations Deck

### 4.1 Table Grid Component
- **Visual Presentation:** Responsive CSS grid rendering cards for all cafe tables.
- **Card States:**
  - **Free (Green Border #10B981):** Displays table label, seat count, and "+ Open Table" trigger.
  - **Occupied (Amber Border #F59E0B):** Displays active session timer, total items ordered, and order count badge.
  - **Bill Requested (Orange Border #F97316):** Flashing badge indicating customer requested bill on mobile app.
- **Micro-Interactions:** Single-click selects table and populates active order context into Center Workspace and Right Billing Sidebar.

### 4.2 Live Activity & Audit Bar
- **Position:** Anchored to bottommost 32px of the display.
- **Functionality:** Real-time single-line scrolling log of system events:
  - *"14:32:01 — Order #22 placed on Table 4 ($37.50)"*
  - *"14:31:45 — Service call: Water requested on Table 2"*
  - *"14:30:10 — KOT Printed successfully on LAN Printer (192.168.1.100)"*

---

## 5. Screen 2: Order Workspace Detail

### 5.1 Quick Item Search & Catalog Selector
- **Shortcut Trigger:** `F2` or `Alt + M` immediately focuses the search input.
- **Instant Filtering:** Sub-50ms live filtering by dish name, category, or item ID code.
- **Catalog Item Card:** Shows dish name, snapshot price, veg/non-veg indicator icon, and stock availability status. Tapping card or pressing `Enter` adds item to active cart.

### 5.2 Cart Quantity & Line Item Modifier Editor
- **Quantity Adjuster:** Inline `[-]` and `[+]` buttons, or direct numeric key entry.
- **Item Special Notes:** Text input field per line item (e.g. *"No onions"*, *"Extra spicy"*).
- **Line Item Deletion:** Trash icon button or `Del` keypress removes item (requires Manager PIN if order was already submitted to kitchen).

---

## 6. Screen 3: Billing & Settlement Panel

```
┌──────────────────────────────────────────────────┐
│ BILLING & SETTLEMENT SIDEBAR                     │
├──────────────────────────────────────────────────┤
│ Table: Table 4 (Dine-In) | Guests: 4             │
│ Session ID: #e65f374a-a8fe-4d4c-829d-d41e7e309a74│
│ Session Duration: 34 minutes                     │
├──────────────────────────────────────────────────┤
│ ITEMIZED BREAKDOWN:                              │
│   1x Double Espresso                   $4.50     │
│   2x Artisan Club Sandwich            $24.00     │
│   1x Iced Vanilla Latte                $5.50     │
│   1x Sparkling Water                   $3.50     │
├──────────────────────────────────────────────────┤
│ FINANCIAL CALCULATIONS:                          │
│   Subtotal:                           $37.50     │
│   Tax (GST 8%):                        $3.00     │
│   Discount (10% Promo):               -$3.75     │
│   ─────────────────────────────────────────────  │
│   NET AMOUNT DUE:                     $36.75     │
├──────────────────────────────────────────────────┤
│ PAYMENT TENDER:                                  │
│   Mode:  (●) Cash   ( ) Credit Card   ( ) UPI    │
│   Cash Tendered Input: [ $40.00                ] │
│   Change Due to Customer:             $3.25      │
├──────────────────────────────────────────────────┤
│ PRIMARY ACTION BUTTONS:                          │
│   [ F8: PRINT BILL INVOICE ]                     │
│   [ F10: COLLECT CASH & FREE TABLE ]             │
│   [ F11: COLLECT CARD / UPI & FREE TABLE ]       │
└──────────────────────────────────────────────────┘
```

---

## 7. Status System & Health Notifications

The persistent top header bar displays five system health indicators:

| Health Indicator | Green State | Yellow / Amber State | Red Flashing State | Action on Failure |
|------------------|-------------|----------------------|--------------------|-------------------|
| **Network Sync** | `● ONLINE` (Connected to WAL) | `▲ SYNCING (3 queued)` | `✖ OFFLINE` (No Connection) | Auto-saves writes to IndexedDB `orderQueue`. |
| **Kitchen Printer** | `● READY` (IP 192.168.1.100) | `▲ PAPER LOW` | `✖ PRINTER OFFLINE` | Retries print spooler every 5 seconds. |
| **Receipt Printer** | `● READY` (USB Port 1) | `▲ PAPER LOW` | `✖ PRINTER ERROR` | Buffers print job in local queue. |
| **Service Calls** | `● NO CALLS` | `▲ 1 CALL PENDING` | `✖ 3+ CALLS OVERDUE (>2m)` | Sounds continuous soft chime alert. |
| **Shift Status** | `● SHIFT ACTIVE` | `▲ SHIFT ENDING (15m)` | `✖ SHIFT OVERDUE` | Prompts cashier for End-of-Day closing count. |

---

## 8. Keyboard-First Workflow & Keybindings

The Counter Interface v2 supports complete mouse-free cashier navigation:

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                CASHIER KEYBINDING MAP                                     │
├───────────────────────┬───────────────────────────────┬───────────────────────────────────┤
│ KEYBINDING            │ FUNCTIONAL ACTION             │ CONTEXT / SCOPE                   │
├───────────────────────┼───────────────────────────────┼───────────────────────────────────┤
│ F1                    │ Open New Express Takeaway     │ Global POS                        │
│ F2                    │ Focus Menu Item Search        │ Order Workspace                   │
│ F3                    │ Open Service Call Drawer      │ Global POS                        │
│ F4                    │ Toggle Dine-In / Takeaway     │ Global POS                        │
│ F5                    │ Submit Order to Kitchen (KOT) │ Active Order                      │
│ F8                    │ Print Pre-Payment Bill        │ Billing Panel                     │
│ F10                   │ Collect Cash & Free Table     │ Billing Panel                     │
│ F11                   │ Collect Card/UPI & Free Table │ Billing Panel                     │
│ Alt + T               │ Jump Focus to Table Grid      │ Global POS                        │
│ Alt + M               │ Jump Focus to Menu Grid       │ Order Workspace                   │
│ Alt + B               │ Jump Focus to Billing Panel   │ Billing Panel                     │
│ Up / Down Arrows      │ Navigate Item List / Tables   │ Active Focused Region             │
│ Enter                 │ Confirm Selection / Add Item  │ Active Focused Item               │
│ Esc                   │ Cancel Selection / Close Modal│ Global Overlays                   │
└───────────────────────┴───────────────────────────────┴───────────────────────────────────┘
```

---

## 9. Responsive Behavior & Screen Adaptations

### 9.1 Primary Widescreen Layout (1920×1080 Resolution)
- **Column Split:** Left Table Grid (30%), Center Order Workspace (45%), Right Billing Panel (25%).
- All three panels render side-by-side simultaneously with zero tab switches required.

### 9.2 Secondary Compact Desktop (1366×768 Resolution)
- **Column Split:** Left Table Grid (25%), Center/Right Combined Workspace & Billing (75%).
- Billing sidebar transitions to a sticky collapsible panel triggered by `Alt + B` or `F8`.

### 9.3 Touchscreen POS Terminal Adaptations
- Increases touch button minimum dimensions to **56×56px**.
- Replaces small text inputs with an integrated on-screen numeric keypad for cash tender entry.

---

## 10. Visual Tokens: Color, Contrast & Typography

### 10.1 Color Palette
- **Background Root:** Dark Charcoal (`#0F172A` Slate-900) for reduced glare during 8-hour cashier shifts.
- **Surface Cards:** Slate Blue (`#1E293B` Slate-800) with subtle 1px border (`#334155`).
- **Primary Brand Accent:** Royal Blue (`#2563EB` Blue-600).
- **Status Green (Free / Online):** Emerald (`#10B981` Emerald-500).
- **Status Amber (Occupied / Pending):** Amber (`#F59E0B` Amber-500).
- **Status Orange (Bill Requested):** Orange (`#F97316` Orange-500).
- **Status Red (Offline / Cancelled):** Rose (`#F43F5E` Rose-500).

### 10.2 Typography Scale
- **Font Family:** `Inter`, `-apple-system`, `sans-serif` (Monospaced numbers for prices).
- **Table Numbers / Total Price:** `24px` Bold.
- **Panel Titles & Item Names:** `16px` Semi-Bold.
- **Secondary Labels & Timers:** `13px` Regular.
- **Keybinding Hints & Status Feed:** `11px` Monospace.

---

## 11. Component Specifications & Component States

### 11.1 Table Grid Card Component States
- **State `FREE`:** Background `#1E293B`, Border 1px `#334155`, Badge Green (`FREE`).
- **State `OCCUPIED`:** Background `#1E293B`, Border 2px `#F59E0B`, Badge Amber (`OCCUPIED`).
- **State `BILL_REQUESTED`:** Background `#2C1A11`, Border 2px `#F97316` (Animated pulse effect), Badge Orange (`BILL REQ`).
- **State `HOVER / FOCUSED`:** Border 2px `#2563EB` (Blue outline).

### 11.2 Tender Action Button States
- **Default State:** Background `#10B981` (Emerald), Text `#FFFFFF` Bold.
- **Hover State:** Background `#059669`.
- **Active / Clicked State:** Scale 0.98.
- **Disabled State:** Background `#334155`, Text `#94A3B8`, Cursor `not-allowed`.

---

## 12. Accessibility & Prolonged Daily Use Standards

1. **High Contrast Ratios:** All text elements adhere to WCAG AAA standards (> 7:1 contrast ratio against dark backgrounds).
2. **Monospaced Numerical Alignment:** Price subtotals, tax figures, and cash change values use monospaced fonts (`font-variant-numeric: tabular-nums`) to prevent visual jumpiness during live recalculations.
3. **No Sole-Color Information Encoding:** Every status indicator pairs a color badge with an explicit text label and icon symbol to support color-blind cashiers.

---

## 13. Cross-References & Related Documentation

- [`./COUNTER_SPEC.md`](./COUNTER_SPEC.md) — Definitive Counter Functional Specification & Operational Blueprint.
- [`./DATABASE.md`](./DATABASE.md) — Comprehensive PostgreSQL database design, RLS permissions matrix, schema specifications, and RPC contracts.
- [`./ARCHITECTURE.md`](./ARCHITECTURE.md) — System Architecture, Component Hierarchy, and Realtime Engine.
- [`./PRODUCT.md`](./PRODUCT.md) — Product Requirements & Feature Specifications.
- [`./COUNTER.md`](./COUNTER.md) — Counter Operational Architecture & Staff Governance Handbook.
- [`./CUSTOMER.md`](./CUSTOMER.md) — Customer Experience Architecture & Guest Journey Governance.
- [`./OWNER.md`](./OWNER.md) — Owner Administration & Business Governance Handbook.
