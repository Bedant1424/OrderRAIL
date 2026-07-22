# OrderRail — Counter Interface V3 Layouts & ASCII Wireframes (COUNTER_V3_LAYOUTS.md)

> **Definitive Layout Blueprint & Responsive Wireframes** for OrderRail Counter Interface v3. Details the 2-Pane Primary Deck architecture, Contextual Billing Slide-Over Sheet, responsive viewport behaviors, and ASCII layout models.

---

## 1. Layout Architecture & Panel Sizing

Counter V3 replaces the rigid 3-column layout with a **Dynamic 2-Pane Primary Deck** combined with a **Contextual Slide-Over Billing Sheet**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                COUNTER V3 LAYOUT GRID                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ PERSISTENT TOP HEADER BAR (56px)                                                        │
├─────────────────────────────────────────┬───────────────────────────────────────────────┤
│ PANE 1: TABLES DECK (35% Width)         │ PANE 2: ACTIVE OPERATIONAL WORKSPACE (65%)    │
│                                         │                                               │
│ • Filter Pills [All] [Free] [Active]    │ • Table Session Header                        │
│ • Minimalist Table Cards Grid           │ • Menu Search & Category Selector             │
│ • Clean vertical scroll                 │ • Menu Catalog Grid                           │
│                                         │ • Active Cart Line Items                      │
│                                         │ • Primary Action Bar [Submit KOT] [Collect]   │
├─────────────────────────────────────────┴───────────────────────────────────────────────┤
│ PERSISTENT BOTTOM SYSTEM STATUS BAR (32px)                                              │
└─────────────────────────────────────────────────────────────────────────────────────────┘
  ▲
  │ (Contextual Slide-Over Drawer: 420px width slides over Pane 2 when Billing is active)
```

---

## 2. ASCII Wireframes

### 2.1 Wireframe 1: Default View (Tables Deck + Operational Workspace)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ OrderRail POS │ Cafe Central │ Cashier: Sarah M. │ 🔔 2 Calls │ NET: ● ONLINE │ PRINTER: ● READY │ 14:32:05           │
├──────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────┤
│ PHYSICAL TABLES (35%)                    │ ACTIVE WORKSPACE: Table 4 (Dine-In • 4 Guests • 34m) (65%)                   │
│ [ All (12) ] [ Free (8) ] [ Active (4) ] │ [ SEARCH MENU: Coffee, Sandwich, Pizza... (F2)                             ] │
├──────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐│ CATEGORIES: [All] [Coffee] [Food] [Beverages] [Desserts]                     │
│ │ TABLE 1    [FREE]│ │ TABLE 2 [OCCUPIED]│├──────────────────────────────────────────────────────────────────────────────┤
│ │ 4 Seats          │ │ 14m ago          ││ MENU CATALOG:                                                                │
│ └──────────────────┘ └──────────────────┘│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│ ┌──────────────────┐ ┌──────────────────┐│ │ Double Espresso  │ │ Club Sandwich    │ │ Iced Latte       │ │ Truffle Fries│ │
│ │ TABLE 3    [FREE]│ │ TABLE 4 [BILL REQ]│ │ $4.50     [+Add] │ │ $12.00    [+Add] │ │ $5.50     [+Add] │ │ $8.00  [+Add]│ │
│ │ 6 Seats          │ │ 32m ago          ││ └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────┘ │
│ └──────────────────┘ └──────────────────┘├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐│ ACTIVE CART (4 Items):                                      Subtotal: $37.50│
│ │ TABLE 5  [CLEAN] │ │ TABLE 6 [OCCUPIED]││ • 1x Double Espresso                              @ $4.50  = $4.50         │
│ │ Mark Available   │ │ 05m ago          ││ • 2x Artisan Club Sandwich                        @ $12.00 = $24.00        │
│ └──────────────────┘ └──────────────────┘│ • 1x Iced Latte (Extra ice)                       @ $5.50  = $5.50         │
│ ┌──────────────────┐ ┌──────────────────┐│ • 1x Sparkling Water                              @ $3.50  = $3.50         │
│ │ TABLE 7  [RESERV]│ │ TABLE 8    [FREE]│├──────────────────────────────────────────────────────────────────────────────┤
│ │ 19:30 Booking    │ │ 4 Seats          ││ [ CLEAR CART (Esc) ]      [ SUBMIT KOT (F5) ]      [ COLLECT PAYMENT (F10) ➔ ]   │
│ └──────────────────┘ └──────────────────┘│                                                                              │
├──────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────┤
│ QUICK KEYS: [F1: Takeaway] [F2: Search] [F3: Calls (2)] [F5: KOT] [F8: Print Bill] [F10: Collect Payment] │ STATUS: 100% OK │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Wireframe 2: Contextual Billing Drawer Active (Slide-Over Sheet)

When the cashier presses `F8` (Print Bill) or `F10` (Collect Payment), the **Billing Drawer** slides over Pane 2:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ OrderRail POS │ Cafe Central │ Cashier: Sarah M. │ 🔔 2 Calls │ NET: ● ONLINE │ PRINTER: ● READY │ 14:32:05           │
├──────────────────────────────────────────┬─────────────────────────────────────────────────┬────────────────────────────┤
│ PHYSICAL TABLES (35%)                    │ WORKSPACE (Blurred Background)                  │ BILLING DRAWER (Slide-Over)│
│ [ All (12) ] [ Free (8) ] [ Active (4) ] │                                                 │ Table 4 (Session #s-9821)  │
├──────────────────────────────────────────┤                                                 ├────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐│                                                 │ ITEMIZED SUMMARY:          │
│ │ TABLE 1    [FREE]│ │ TABLE 2 [OCCUPIED]││                                                 │ 1x Double Espresso   $4.50 │
│ └──────────────────┘ └──────────────────┘│                                                 │ 2x Club Sandwich    $24.00 │
│ ┌──────────────────┐ ┌──────────────────┐│                                                 │ 1x Iced Latte        $5.50 │
│ │ TABLE 3    [FREE]│ │ TABLE 4 [BILL REQ]││                                                 │ 1x Sparkling Water   $3.50 │
│ └──────────────────┘ └──────────────────┘│                                                 ├────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐│                                                 │ Subtotal:           $37.50 │
│ │ TABLE 5  [CLEAN] │ │ TABLE 6 [OCCUPIED]││                                                 │ Tax (GST 8%):        $3.00 │
│ └──────────────────┘ └──────────────────┘│                                                 │ Discount (10%):     -$3.75 │
│ ┌──────────────────┐ ┌──────────────────┐│                                                 │ NET TOTAL:          $36.75 │
│ │ TABLE 7  [RESERV]│ │ TABLE 8    [FREE]││                                                 ├────────────────────────────┤
│ └──────────────────┘ └──────────────────┘│                                                 │ TENDER: (●)Cash ( )Card/UPI│
│                                          │                                                 │ Cash Tendered:  [ $40.00 ] │
│                                          │                                                 │ Change Due:          $3.25 │
│                                          │                                                 ├────────────────────────────┤
│                                          │                                                 │ [ F8: PRINT INVOICE ]      │
│                                          │                                                 │ [ F10: PAY & FREE TABLE ➔ ]│
├──────────────────────────────────────────┴─────────────────────────────────────────────────┴────────────────────────────┤
│ QUICK KEYS: [F8: Print Bill] [F10: Pay Cash] [F11: Pay Card] [Esc: Close Drawer] │ STATUS: 14:32:01 — Bill Printed      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Wireframe 3: Tablet & Mobile POS Adaptations

#### Tablet View (1024×768)
On tablets, Pane 1 (Tables Deck) collapses into a sleek left sidebar toggle or top sheet tab, giving 100% screen width to the active order catalog.

#### Mobile POS Touch View (375px–480px Handheld)
On handheld waiter terminals, the interface operates as a 3-tab bottom navigation stack:
`[ 🪑 Tables ]  [ 🛒 Active Order ]  [ 💳 Settlement ]`

---

## 3. Viewport Breakpoints & Responsive Rules

| Device Class | Viewport Width | Layout Strategy | Billing Presentation |
|--------------|----------------|-----------------|----------------------|
| **Widescreen Desktop** | `>= 1280px` | 2-Pane Side-by-Side Deck (35% / 65%) | 420px Contextual Slide-Over Drawer |
| **Standard Desktop** | `1024px – 1279px` | 2-Pane Compact Deck (30% / 70%) | Full-height Slide-Over Drawer |
| **Tablet POS** | `768px – 1023px` | Collapsible Left Sidebar / Top Tab Switcher | Bottom Sheet Modal Overlay |
| **Mobile POS Handheld** | `< 768px` | Full-Screen Tab Stack | Full-Screen Settlement Deck |
