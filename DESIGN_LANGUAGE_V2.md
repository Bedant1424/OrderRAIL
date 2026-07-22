# OrderRail Design Language V2.0 (DESIGN_LANGUAGE_V2.md)

> **Definitive Visual Identity Specification & Industrial Design Guide** for OrderRail. Establishes a warm, crafted, memorable hospitality visual language (Espresso, Copper, Caramel, Forest, Cream) with soft glass material depth, ambient light highlights, and tabular numeric typography.

---

## Executive Overview

OrderRail Design Language V2.0 transforms OrderRail from a generic flat Tailwind administrative dashboard into a **warm, crafted, operational hospitality platform**.

Every screenshot of OrderRail should feel instantly recognizable:
- **Warm Hospitality Palette:** Espresso, Copper, Caramel, Cream, Forest Emerald, Slate, Stone, Mist.
- **Material Depth & Ambient Lighting:** Soft glass backdrop blurs (`backdrop-blur-md bg-card/70`), ambient top border highlights (`border-white/10`), soft contact shadows (`shadow-soft`, `shadow-float`).
- **Tabular Numeric Typography:** Tabular monospace numbers (`font-mono tracking-tight font-extrabold`) for subsecond cashier scanning of monetary revenue and table timers.

---

## 1. Brand Identity & Material Philosophy

OrderRail V2.0 balances four distinct aesthetic attributes:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                ORDERRAIL V2.0 AESTHETICS                                │
├──────────────────────────┬──────────────────────────┬───────────────────────────────────┤
│ WARM & INVITING          │ CRAFTED MATERIAL DEPTH   │ TABULAR OPERATIONAL SPEED         │
├──────────────────────────┼──────────────────────────┼───────────────────────────────────┤
│ Inspired by roasted coffee│ Layered frosted glass   │ Subsecond readability with        │
│ beans, copper espresso   │ depth with ambient top   │ tabular numbers and high-contrast │
│ machines, and ceramic    │ border lighting highlights│ keyboard focus indicators         │
│ hospitality interiors.   │ and contact shadows.     │ for high-volume cashiers.         │
└──────────────────────────┴──────────────────────────┴───────────────────────────────────┘
```

---

## 2. Color Palette & HSL Tokens Matrix

| Semantic Token | HSL / Hex Code | Role in Interface |
|----------------|----------------|-------------------|
| **Espresso Surface** | `hsl(28 45% 8%)` | Primary background depth layer |
| **Copper Accent** | `hsl(28 75% 52%)` | Primary brand accent & active focus glow |
| **Caramel Warm** | `hsl(20 80% 50%)` | Secondary warm CTA buttons & warnings |
| **Cream Text** | `hsl(35 30% 95%)` | High-contrast readable typography |
| **Forest Emerald** | `hsl(155 60% 45%)` | Available tables & success status badges |
| **Slate Base** | `hsl(25 15% 14%)` | Layered workspace base panel |
| **Stone Surface** | `hsl(25 12% 20%)` | Card surface & dialog background |
| **Mist Subtext** | `hsl(35 15% 88%)` | Secondary captions & muted icons |

---

## 3. Refined Component Primitives (`src/components/ui/ds/`)

- **`DsButton`:** Pill & rounded-2xl buttons featuring warm copper glows, glass border highlights, and active press scale feedback.
- **`DsCard`:** Soft glass surfaces (`bg-card/80 backdrop-blur-md border-white/10`) with ambient lighting highlights.
- **`DsBadge`:** Ceramic status pills with rich warm HSL fills (`bg-emerald-500/15 text-emerald-400 border-emerald-500/25`).
- **`DsInput`:** Frosted glass input fields with warm copper ambient focus rings.
- **`DsPanel`:** Layered glass workspace containers with subtle depth separation.
- **`DsTable`:** High-density operational data tables with sticky frosted headers and smooth row hover transitions.

---

## 4. Living Showcase Product Website

Exposed live at **`http://localhost:5173/design-system`**. Demonstrates the warm hospitality palette, material layer depth, button states, metric cards, and operational tables in a portfolio-grade presentation.
