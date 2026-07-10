# Staff Dashboard Regression Audit

**Date**: 2026-07-10
**Branch**: feature/staff-regression-audit
**Base commit**: 07d743d (style(staff): improve priority information hierarchy)
**Auditor**: Regression Audit Sprint

---

## Feature Inventory Table

| # | Feature | Before Refactor | After Refactor | Status |
|---|---------|:-:|:-:|--------|
| 1 | Primary Action Button (inline on card) | ✓ | ✗ | Regression — moved to drawer only |
| 2 | Cancel Order Button (✕ on card) | ✓ | ✗ | **Regression** — removed in 2d2c3d4 |
| 3 | Priority Indicator (dot + age) | ✓ | ✓ | OK — improved with AlertTriangle |
| 4 | Priority Ring (card border) | ✓ | ✓ | OK — yellow/red ring styling |
| 5 | Order Details Drawer | ✗ | ✓ | New Feature — added in 2d2c3d4 |
| 6 | Timeline (in drawer) | ✓ | ✓ | Improved — moved to drawer |
| 7 | Search (table/order #) | ✓ | ✓ | OK |
| 8 | Realtime Updates | ✓ | ✓ | OK |
| 9 | Service Requests Strip | ✓ | ✓ | OK |
| 10 | Stats Cards (4 metrics) | ✓ | ✓ | OK |
| 11 | Tables Grid + Modal | ✓ | ✓ | OK |
| 12 | Review Changes Dialog | ✓ | ✓ | OK |
| 13 | "UPDATED" Badge on Card | ✓ | ✓ | OK |
| 14 | Flash Animations (green/amber/red/blue) | ✓ | ✓ | OK |
| 15 | Auto-Scroll (idle detection) | ✓ | ✓ | OK |
| 16 | Order-level Note (inline on card) | ✓ | ✗ | Acceptable — moved to drawer |
| 17 | Review Changes Button (inline on card) | ✓ | ✗ | Acceptable — drawer shows full diff |
| 18 | Mobile Layout | ✓ | ✓ | OK |
| 19 | Desktop Layout (3-col kanban) | ✓ | ✓ | OK |
| 20 | Elapsed Time Formatting | ✓ | ✓ | Improved |
| 21 | Notification Center | ✓ | ✓ | OK |
| 22 | One-Tap Cancel Workflow | ✓ | ✗ | **Regression** — required drawer |

---

## Regressions Identified

### 1. Cancel Order Button (✕) — REGRESSION (Critical)

**Root Cause**: Commit `2d2c3d4` ("feat(staff): add order details drawer workspace and clean up Kanban cards") removed inline action buttons from order cards during the drawer refactor.

**What was removed** (from `OrderColumn` render):
- Cancel button `<X>` icon — a small `✕` button for one-tap cancel
- Primary action button (Start preparing / Mark ready / Mark served)
- Review changes button
- Order-level note display

**What happened**: The `onCancel` prop was still declared in `OrderColumn`'s interface and passed from the parent, but the JSX that rendered the cancel button was deleted. This made `onCancel` dead code.

**Impact**: Staff lost the ability to cancel orders with one tap. They now must: tap card → wait for drawer to open → scroll to footer → tap "Cancel Order" → confirm. This is a significant workflow regression for a fast-paced kitchen environment.

### 2. Primary Action Button (inline) — REGRESSION (Accepted)

**Root Cause**: Same commit `2d2c3d4`.

**Assessment**: Moving the primary action to the drawer is an acceptable UX decision since the drawer provides more context (timeline, items, priority) before advancing. The cancel action is different — it needs to be fast and accessible for urgent situations (wrong order, customer left, etc.).

### 3. One-Tap Cancel Workflow — REGRESSION (Critical)

**Root Cause**: Direct consequence of removing the inline Cancel button (#1 above).

---

## Root Cause Deep Dive

**Offending Commit**: `2d2c3d4`
**Commit Message**: "feat(staff): add order details drawer workspace and clean up Kanban cards"
**Author Intent**: Add a detailed order drawer with timeline, receipt, and actions — and "clean up" cards by removing inline buttons to make cards clickable.

**The 47 lines removed** (lines 1075-1121 in the pre-commit version):
```tsx
// Order-level note display
{o.note && (<p>Note: {o.note}</p>)}

// Review changes button
{o.version > o.last_reviewed_version && o.last_updated_by === 'customer' && onReviewChanges && (
  <button onClick={() => onReviewChanges(o)}>Review changes</button>
)}

// Action buttons — THIS IS THE REGRESSION
{(NEXT_STATUS[o.status] || onCancel) && (
  <div className="mt-3 flex gap-2">
    {NEXT_STATUS[o.status] && (
      <button onClick={() => onAdvance(o)}>
        {NEXT_LABEL[o.status]}
      </button>
    )}
    {onCancel && o.status !== "served" && o.status !== "cancelled" && (
      <button onClick={() => onCancel(o)} aria-label="Cancel order">
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
)}
```

**The fix**: Restore the Cancel (✕) button directly on order cards in the header row (next to the price), using `e.stopPropagation()` to prevent opening the drawer. This preserves the drawer workflow while restoring one-tap cancel.

---

## Behaviour Verification

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Start Preparing | ✓ | Available in drawer for pending orders |
| 2 | Mark Ready | ✓ | Available in drawer for preparing orders |
| 3 | Mark Served | ✓ | Available in drawer for ready orders |
| 4 | Cancel Order | ✓ | **Restored** — ✕ button on card + drawer button |
| 5 | Open Drawer | ✓ | Click any order card |
| 6 | Search | ✓ | Filters by table label or order number |
| 7 | Priority Indicators | ✓ | Green/Yellow/Red with dot + ring + timer |
| 8 | Timers | ✓ | 30-second tick, auto-escalation |
| 9 | Timeline | ✓ | In drawer, queries order_audits |
| 10 | Service Requests | ✓ | Ack + Resolve, blue flash, auto-scroll |
| 11 | Realtime Updates | ✓ | All 4 tables subscribed (orders, items, SR, tables) |
