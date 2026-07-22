# OrderRail — Counter Interface V3 UX Redesign Specification (COUNTER_V3_UX_REDESIGN.md)

> **Definitive UI/UX Redesign Specification & Visual Blueprint** for the next-generation OrderRail Counter Interface v3. Re-architects the operational cashier workspace from first principles to reduce visual noise by 45%, eliminate cognitive overload, introduce contextual billing drawers, and deliver a premium, cashier-first POS experience inspired by Linear, Stripe Dashboard, Square POS, and Apple Wallet.

---

## Executive Summary

While Counter V2 successfully demonstrated functional table engine mechanics and state machine validation, its 3-column layout suffers from **information density overload**. Exposing physical tables, menu catalog, active cart, financial breakdowns, cash tender inputs, service request lists, status logs, and 7 shortcut pills simultaneously creates competing visual priorities and eye fatigue during 8-hour cashier shifts.

Counter V3 fundamentally solves this by adopting **Progressive Disclosure** and **One Primary Task at a Time**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                COUNTER V2 vs COUNTER V3                                 │
├─────────────────────────────────────────┬───────────────────────────────────────────────┤
│           COUNTER V2 (Legacy)           │             COUNTER V3 (Redesigned)           │
│                                         │                                               │
│ • Rigid 3-Column Simultaneous Layout    │ • Dynamic 2-Pane Primary Deck + Slide Drawer  │
│ • Permanent Billing & Cash Tender Panel │ • Contextual Billing Drawer (Pops up on F8/F10)│
│ • Overcrowded Table Cards (Seats, $s)   │ • Minimalist Table Cards (Label, Status, Time)│
│ • Permanent Service Calls List Box      │ • Unobtrusive Floating Notification Badge     │
│ • 100% Information Exposure             │ • Progressive Disclosure (45% Noise Reduction)│
└─────────────────────────────────────────┴───────────────────────────────────────────────┘
```

---

## Table of Contents

- [1. UX Audit of Counter V2](#1-ux-audit-of-counter-v2)
- [2. Design Philosophy & Core Principles](#2-design-philosophy--core-principles)
- [3. Redesign Goals & Metrics](#3-redesign-goals--metrics)
- [4. Component Redesign Specifications](#4-component-redesign-specifications)
- [5. Visual Tokens, Typography & Color System](#5-visual-tokens-typography--color-system)
- [6. Interaction & Motion System](#6-interaction--motion-system)

---

## 1. UX Audit of Counter V2

An audit of the Counter V2 layout revealed several cognitive friction points:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                             COUNTER V2 FRICTION AUDIT                                   │
├──────────────────────────┬──────────────────────────────────────────────────────────────┤
│ ISSUES IDENTIFIED        │ OPERATIONAL IMPACT                                           │
├──────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 1. Permanent Billing     │ Consumes 25% of screen width constantly, even when taking    │
│    Sidebar               │ initial orders or browsing tables.                           │
│ 2. Overcrowded Table     │ Cards display label, seats, status, elapsed timer, item     │
│    Cards                 │ count, and dollar total simultaneously, creating wall-of-text│
│                          │ visual clutter in table grid.                                │
│ 3. Permanent Service     │ Consumes vertical space in table column with redundant       │
│    Request Panel         │ list items when no urgent action is required.                │
│ 4. Double Action Bar     │ Quick Keys Bar and Status Bar stack vertically at the        │
│    Stacking              │ bottom, stealing 65px of vertical layout height.             │
│ 5. Competing Primary     │ "Submit KOT", "Print Bill", "Pay Cash", and "Pay Card"       │
│    Action Buttons        │ buttons compete with equal visual weight simultaneously.     │
└──────────────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 2. Design Philosophy & Core Principles

Counter V3 is engineered around seven core UX principles:

1. **One Primary Task At A Time:** The interface guides the cashier through the active stage of the order lifecycle (Selecting Table → Building Cart → Submitting KOT → Settling Payment) rather than exposing every control at once.
2. **Reduce Cognitive Load:** Reduces visible screen elements by **~45%**. Information appears only when relevant to the cashier's immediate action.
3. **Whitespace Is A Feature:** Generous padding (16px–24px), subtle borders (`border-border/40`), and clear card grouping create a calm, readable environment that eliminates eye strain.
4. **Progressive Disclosure:** Complex settlement calculations, tender mode inputs, and historical audit logs slide in contextually via drawers or expandable overlays.
5. **Touch First:** Touch targets are at least **44×44px** with rounded corners (`rounded-2xl`), enabling seamless operation on touchscreen POS terminals and Microsoft Surface displays.
6. **Keyboard First:** Every workflow preserves sub-second hotkey navigation (`F1`–`F12`, `Esc`, `Enter`, Arrow Keys).
7. **Premium Product Aesthetics:** Clean typography scales (Inter/Outfit), HSL dark-mode tailwind tokens, micro-animations (framer-motion 150ms transitions), and subtle glassmorphism (`backdrop-blur-md`).

---

## 3. Redesign Goals & Metrics

| UX Metric | Counter V2 (Current) | Counter V3 (Target) | Improvement |
|-----------|----------------------|---------------------|-------------|
| **Visible UI Elements on Default View** | ~68 items | ~32 items | **53% reduction in visual noise** |
| **Permanent Screen Columns** | 3 Columns (Rigid) | 2 Panes + Contextual Drawer | **35% increase in active workspace area** |
| **Table Card Information Density** | 6 Data points | 3 Data points (Label, Status, Time) | **50% faster table grid scanning** |
| **Average Cashier Click-to-Complete** | 4 clicks | 2 clicks / 1 hotkey | **50% faster transaction execution** |
| **Touch Target Minimum Size** | 28px–36px | 44px minimum | **100% touch accessibility compliance** |

---

## 4. Component Redesign Specifications

### 4.1 Minimalist Table Cards
- **Displayed Data:** Table Label (e.g. `T4`), Status Badge (`FREE`, `OCCUPIED`, `BILL REQ`, `CLEANING`), and Elapsed Session Timer (`14m`).
- **Removed from Card:** Seat count, subtotal dollar amount, item count, session UUID code (moved to active workspace header upon selection).
- **Visual Styling:** Elevated cards with 1px status-tailored borders (`emerald-500/30`, `amber-500/40`, `orange-500/60`, `blue-500/40`).

### 4.2 Active Operational Workspace (Primary Focal Point)
- Occupies 65% of screen width.
- Houses Menu Search, Category Filter Pills, Menu Catalog Grid, and Active Cart items.
- Features a clean **Session Status Header** showing currently selected table metadata and guest count.

### 4.3 Contextual Billing Drawer (Slide-Over Sheet)
- Replaces the permanent Billing Sidebar.
- Remains hidden until the cashier triggers billing (`F8`, `F10`, `F11`, or clicking `Collect Payment`).
- Slides in smoothly from the right edge (width: 420px) with itemized breakdown, tax/discount sliders, cash tender inputs, and high-contrast completion buttons.

### 4.4 Unobtrusive Service Request Notification Pill
- Replaces the permanent bottom-left Service Request list box.
- Renders as a sleek bell icon badge in the top header: `🔔 2 Calls`.
- Clicking the badge opens a quick floating popover card instead of taking up permanent floor plan grid space.

### 4.5 Streamlined Header & Status Bar
- Combined top system bar displaying Cafe Name, Cashier Identity, Online Indicator (`● ONLINE`), Printer Health, and live system clock.
- Bottom status log collapsed into a single expandable 24px bar at the bottom.

---

## 5. Visual Tokens, Typography & Color System

### 5.1 Color Palette Tokens (Tailwind HSL)

```css
/* Counter V3 Modern Palette */
--background: 224 71% 4%;        /* Sleek Obsidian Dark Background */
--card: 224 71% 7%;              /* Subtle Card Container */
--border: 220 13% 18%;           /* Soft Low-Contrast Border */
--brand: 142 76% 45%;            /* Emerald POS Primary Accent */
--brand-foreground: 0 0% 100%;

/* Status Color Tokens */
--status-free: 142 76% 45%;      /* Emerald #10B981 */
--status-occupied: 38 92% 50%;   /* Amber #F59E0B */
--status-billreq: 24 95% 53%;    /* Orange #F97316 */
--status-cleaning: 217 91% 60%;  /* Blue #3B82F6 */
--status-reserved: 262 83% 58%;  /* Purple #8B5CF6 */
--status-out: 220 9% 46%;        /* Slate Gray #6B7280 */
```

### 5.2 Typography Scale
- **Display Header:** `font-display text-lg font-bold tracking-tight` (Table labels, total due).
- **Section Titles:** `text-xs font-bold uppercase tracking-wider text-muted-foreground`.
- **Cart Line Items:** `text-sm font-semibold text-foreground`.
- **Financial Numbers:** `font-mono text-sm font-bold`.

---

## 6. Interaction & Motion System

Counter V3 incorporates smooth 150ms CSS transitions and `framer-motion` layout animations:
- **Table Card Selection:** 150ms spring scale (`scale(1.02)`) with ring glow (`ring-2 ring-brand`).
- **Billing Drawer Slide:** 200ms ease-out transform (`translateX(0)`).
- **Cart Line Item Addition:** Subtle flash highlight (`bg-brand/10` fade to transparent).
