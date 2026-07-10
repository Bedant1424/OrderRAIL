# Product Regression Audit — QA Checklist

> **Purpose**: Every sprint must include this "Product Regression Audit" in addition to Build, Typecheck, and Console checks. No previously existing feature may disappear or change behaviour without explicit approval.

---

## Staff Dashboard Feature Checklist

Run this checklist after every deployment or significant refactor.

### Core Layout & Navigation
- [ ] Page header with title "Dashboard" and subtitle
- [ ] GlobalNotificationControls in header
- [ ] Mobile layout renders correctly (responsive grid collapses)
- [ ] Desktop layout renders correctly (3-column kanban grid)

### Stats Cards (Top Section)
- [ ] "Incoming" stat card — shows count of pending orders
- [ ] "In kitchen" stat card — shows count of preparing + ready orders
- [ ] "Open requests" stat card — shows count of service requests
- [ ] "Tables busy" stat card — shows count of occupied tables

### Service Requests Strip
- [ ] Horizontal scrollable strip visible when requests exist
- [ ] Each SR card shows: type icon, label, table, timestamp, optional note
- [ ] "Ack" button visible for open-status requests
- [ ] "Resolve" button visible for all requests
- [ ] Flash animation (blue) on new request arrival
- [ ] Auto-scroll to new request when staff is idle

### Search Bar
- [ ] Search input visible with placeholder "Search by table or order #..."
- [ ] Filtering works by table label (case-insensitive)
- [ ] Filtering works by order number
- [ ] Clear button (✕) appears when search text is present
- [ ] Clearing search restores full order list

### Order Kanban Columns
- [ ] "Incoming" column shows `pending` orders
- [ ] "In progress" column shows `preparing` and `ready` orders
- [ ] "Recently done" column shows `served` and `cancelled` orders (max 20)
- [ ] Each column shows order count
- [ ] Empty state message shown when column is empty

### Order Card (Inline)
- [ ] Table label + order number displayed
- [ ] Status badge (Pending/Preparing/Ready/Served/Cancelled)
- [ ] Timestamp displayed
- [ ] Total price displayed
- [ ] Item list (qty × name) displayed
- [ ] "UPDATED" badge shown for unreviewed customer modifications
- [ ] **Cancel button (✕)** visible on Incoming and In Progress cards
- [ ] Cancel button uses stopPropagation (doesn't open drawer)
- [ ] Cancel button NOT shown on Recently Done cards
- [ ] Priority indicator dot (green/yellow/red based on elapsed time)
- [ ] Priority ring styling on card border (yellow at 5min, red at 10min)
- [ ] AlertTriangle icon for red priority
- [ ] Elapsed time display (just now / X min / Xh Ym / etc.)
- [ ] Clicking card opens Order Details Drawer

### Order Details Drawer
- [ ] Drawer opens on card click
- [ ] Header: table label, status badge, order number, received time
- [ ] Priority & Age Banner with colored dot and text
- [ ] Customer modification alert (when applicable) with diff
- [ ] "Acknowledge Changes" button in modification alert
- [ ] Receipt items list with prices
- [ ] Total amount displayed
- [ ] Customer notes displayed (when present)
- [ ] Order Timeline with audit history
- [ ] **Primary action button** (Start preparing / Mark ready / Mark served)
- [ ] **Cancel Order button** (for non-terminal statuses)
- [ ] Cancel Order prompts confirmation dialog
- [ ] "Close Workspace" button
- [ ] Actions update drawer state after execution (stays open, refreshes)

### Review Changes Dialog
- [ ] Dialog opens for orders with unreviewed customer changes
- [ ] Shows diff of item quantity changes (color-coded)
- [ ] Shows customer note
- [ ] Shows full current order items list
- [ ] "Close" button works
- [ ] "Acknowledge Changes" button works

### Tables Grid
- [ ] Grid of table cards displayed
- [ ] Each table shows label and status (Occupied/Free)
- [ ] Occupied tables styled differently (accent border)
- [ ] Clicking table opens detail modal
- [ ] Modal shows "Mark Table Free" button (disabled if active orders)
- [ ] Active orders count message when button is disabled
- [ ] "Cancel" (close) button in modal

### Realtime Updates
- [ ] New orders appear without page refresh
- [ ] Order status changes reflect in real-time
- [ ] Customer-cancelled orders flash red
- [ ] Customer-modified orders flash amber
- [ ] New orders flash green
- [ ] New service requests flash blue
- [ ] Auto-scroll to new/updated items when staff is idle
- [ ] Service request status changes reflect in real-time
- [ ] Table status changes reflect in real-time

### Timers
- [ ] Age display updates every 30 seconds
- [ ] Priority escalates from green → yellow (5min) → red (10min)

### One-Tap Workflow
- [ ] Cancel order via ✕ button on card (one tap, no drawer needed)
- [ ] All drawer actions accessible via card click → drawer

---

## Audit Report Template

Use this template for each sprint's regression report:

```markdown
## Product Regression Audit — Sprint [NAME/NUMBER]

**Date**: YYYY-MM-DD
**Branch**: feature/xxx
**Auditor**: [name]

### Feature Inventory

| Feature | Before | After | Status |
|---------|--------|-------|--------|
| Primary Action Button | ✓ | ✓/✗ | OK/Regression |
| Cancel Order Button | ✓ | ✓/✗ | OK/Regression |
| Priority Indicator | ✓ | ✓/✗ | OK/Regression |
| Drawer | ✓ | ✓/✗ | OK/Regression |
| Timeline | ✓ | ✓/✗ | OK/Regression |
| Search | ✓ | ✓/✗ | OK/Regression |
| Realtime Updates | ✓ | ✓/✗ | OK/Regression |
| Service Requests | ✓ | ✓/✗ | OK/Regression |
| Tables Grid | ✓ | ✓/✗ | OK/Regression |
| Stats Cards | ✓ | ✓/✗ | OK/Regression |
| Review Changes | ✓ | ✓/✗ | OK/Regression |
| One-Tap Workflow | ✓ | ✓/✗ | OK/Regression |
| Mobile Layout | ✓ | ✓/✗ | OK/Regression |
| Desktop Layout | ✓ | ✓/✗ | OK/Regression |

### Regressions Found
- [list any regressions]

### Build Status
- [ ] `tsc --noEmit` passes
- [ ] `vite build` passes
- [ ] No console errors

### Risk Assessment
[Low/Medium/High] — [rationale]

### Files Modified
- [list files]
```
