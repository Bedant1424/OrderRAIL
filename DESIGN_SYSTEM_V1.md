# OrderRail Design System v1.0 (DESIGN_SYSTEM_V1.md)

> **Definitive Foundational UI Architecture & Component Reference** for the entire OrderRail platform (Counter POS, Owner Portal, Staff Console, Kitchen Display System, Analytics, and Authentication). Establishes reusable tokens, UI primitives, typography scales, layout engines, and accessibility guidelines inspired by Apple, Linear, Square POS, and Notion.

---

## Executive Summary

OrderRail Design System v1.0 creates a unified, scalable, and high-performance UI foundation across all web applications and dedicated device POS terminals.

By enforcing an **8-point spacing system**, standardized HSL color tokens, progressive disclosure rules, and accessible component primitives, the design system ensures consistent user experience while eliminating one-off UI patterns.

---

## 1. Design Philosophy & Core Principles

1. **One Primary Task:** Every screen, panel, and modal has a single obvious objective.
2. **Progressive Disclosure:** Expose complex options only when required by user workflow.
3. **Calm Interfaces:** Use layer depth (`bg-card/70 backdrop-blur-md shadow-soft`) and generous whitespace instead of heavy black border outlines.
4. **Operational Speed:** Engineered for sub-second cashier hotkey execution (`F1`–`F12`, `Esc`, `Enter`) and 44×44px touchscreen targets.

---

## 2. Design Tokens Matrix

### 2.1 Colors (`src/lib/design-system/tokens/colors.ts`)
- **Primary Brand:** `hsl(var(--brand))` (Emerald #10B981)
- **Background Layer:** `hsl(var(--background))` (Obsidian Dark #0A0D14)
- **Card Surface:** `hsl(var(--card))` (Obsidian Surface #111622)
- **Success:** `#10B981` (Subtle bg: `rgba(16, 185, 129, 0.15)`)
- **Warning:** `#F59E0B` (Subtle bg: `rgba(245, 158, 11, 0.15)`)
- **Danger:** `#EF4444` (Subtle bg: `rgba(239, 68, 68, 0.15)`)
- **Info:** `#3B82F6` (Subtle bg: `rgba(59, 130, 246, 0.15)`)

### 2.2 Typography Scale (`src/lib/design-system/tokens/typography.ts`)
- **Display Header:** `font-display text-3xl font-extrabold tracking-tight`
- **Page Title:** `font-display text-xl font-bold tracking-tight`
- **Section Title:** `font-display text-base font-bold tracking-tight`
- **Card Title:** `font-display text-sm font-semibold`
- **Body Text:** `font-sans text-xs sm:text-sm font-normal`
- **Caption / Subtext:** `font-sans text-[11px] font-medium text-muted-foreground`
- **Label:** `font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground`
- **Numeric Data:** `font-mono text-xs sm:text-sm font-bold tracking-tight`

### 2.3 Spacing Scale (8-Point Grid System)
`4px` (spacing-1), `8px` (spacing-2), `12px` (spacing-3), `16px` (spacing-4), `24px` (spacing-6), `32px` (spacing-8), `48px` (spacing-12), `64px` (spacing-16).

---

## 3. Shared UI Primitives (`src/components/ui/ds/`)

| Primitive Component | Module Path | Supported Variants & Features |
|---------------------|-------------|-------------------------------|
| **`DsButton`** | `src/components/ui/ds/DsButton.tsx` | `primary`, `secondary`, `ghost`, `danger`, `icon`, `isLoading` |
| **`DsInput`** | `src/components/ui/ds/DsInput.tsx` | `text`, `search`, `number`, `error`, `leftElement` |
| **`DsCard`** | `src/components/ui/ds/DsCard.tsx` | `info`, `interactive`, `metric`, `selectable` |
| **`DsBadge`** | `src/components/ui/ds/DsBadge.tsx` | `success`, `warning`, `danger`, `info`, `brand`, `neutral` |
| **`DsPanel`** | `src/components/ui/ds/DsPanel.tsx` | `workspace`, `secondary`, `floating`, `drawer` |
| **`DsTable`** | `src/components/ui/ds/DsTable.tsx` | Sticky headers, custom cell rendering, row clicks |

---

## 4. Accessibility & Touch Standards

- **Touch Targets:** All interactive elements maintain a minimum **44×44px** active touch target.
- **Focus Traps & Rings:** High-contrast 2px focus ring (`focus-visible:ring-2 focus-visible:ring-brand`).
- **Keyboard Parity:** 100% mouse-free workflow support across hotkey mappings.

---

## 5. Living Showcase Page

Exposed at **`http://localhost:5173/design-system`**. Serves as the interactive living specification for engineering teams.
