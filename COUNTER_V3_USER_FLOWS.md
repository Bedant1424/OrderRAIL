# OrderRail — Counter Interface V3 User Flows & Interaction Manual (COUNTER_V3_USER_FLOWS.md)

> **Definitive Interaction Manual & Workflow Map** for OrderRail Counter Interface v3. Details cashier user journeys, hotkey bindings, focus management, touch gestures, and accessibility standards.

---

## 1. Primary Cashier Interaction Workflows

Counter V3 optimizes the five core restaurant cashier journeys into streamlined, low-friction task flows.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CORE CASHIER WORKFLOWS                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  WORKFLOW 1: DINE-IN ORDER INTAKE                                                       │
│  Select Free Table ──► Add Menu Items ──► Input Item Notes ──► Press F5 (Submit KOT)    │
│                                                                                         │
│  WORKFLOW 2: PRINT PRE-CHECK BILL                                                       │
│  Select Occupied Table ──► Review Active Cart ──► Press F8 (Print Bill / Open Drawer)  │
│                                                                                         │
│  WORKFLOW 3: PAYMENT SETTLEMENT & CLEAR TABLE                                           │
│  Press F10/F11 ──► Input Cash Tendered ──► Press Enter (Collect & Free Table)          │
│                                                                                         │
│  WORKFLOW 4: EXPRESS TAKEAWAY ORDER INTAKE                                              │
│  Press F1 (Takeaway) ──► Add Items ──► Settle Immediately ──► Dispense Takeaway Receipt │
│                                                                                         │
│  WORKFLOW 5: SERVICE REQUEST FULFILLMENT                                                │
│  Click Header Bell Badge ──► Acknowledge Call ──► Fulfill Request ──► Dismiss Badge     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Step-by-Step Workflow Maps

### 2.1 Workflow 1: Dine-In Table Order Intake
1. **Cashier Action:** Cashier taps Table Card `T4` (or uses Arrow Keys + `Enter`).
2. **System Response:** Pane 2 (Workspace) highlights `Table 4` session. Focus jumps automatically to Menu Search input.
3. **Cashier Action:** Types `"Espresso"` or taps `"Coffee"` category pill. Taps item card to add to active cart.
4. **Cashier Action:** Press `F5` (or tap `[ SUBMIT KOT ]`).
5. **System Response:** Spools ESC/POS KOT print ticket to kitchen, sends WebSocket update to KDS, and flashes green success badge.

---

### 2.2 Workflow 2: Print Pre-Check Invoice
1. **Cashier Action:** Customer requests bill. Cashier selects Table `T4`.
2. **Cashier Action:** Press `F8` (or tap `[ PRINT BILL ]`).
3. **System Response:** Contextual **Billing Drawer** slides in from the right edge. ESC/POS thermal invoice prints. Table `T4` status updates to `BILL_REQUESTED` (flashing orange badge).

---

### 2.3 Workflow 3: Payment Settlement & Session Closure
1. **Cashier Action:** Customer hands cash/card to cashier. Cashier presses `F10` (Cash) or `F11` (Card).
2. **System Response:** Billing Drawer opens with focus on `Cash Tendered` input field.
3. **Cashier Action:** Inputs `$40.00` cash. System computes `$3.25` change due.
4. **Cashier Action:** Press `Enter` (or tap `[ COLLECT & FREE TABLE ]`).
5. **System Response:** Triggers cash drawer pulse, prints customer receipt, executes `free_table` RPC, sets Table `T4` status to `CLEANING`, and closes Billing Drawer.

---

### 2.4 Workflow 4: Express Takeaway Order Intake
1. **Cashier Action:** Walk-in customer arrives. Cashier presses `F1` (New Takeaway).
2. **System Response:** Workspace switches mode to `Express Takeaway` (no physical table binding).
3. **Cashier Action:** Adds items, takes payment, presses `Enter`.
4. **System Response:** Spools KOT + Customer Receipt simultaneously.

---

## 3. Keyboard Hotkeys & Keyboard Navigation Matrix

Counter V3 supports 100% mouse-free cashier operation:

| Function Key / Combo | Action Description | UI Response |
|----------------------|--------------------|-------------|
| `F1` | New Takeaway Order | Switches workspace to Express Takeaway mode. |
| `F2` or `Alt + M` | Search Menu | Focuses Menu Search input field instantly. |
| `F3` | Open Service Calls | Opens floating Service Request Notification popover. |
| `F4` or `Alt + T` | Focus Table Grid | Focuses physical table grid for arrow key navigation. |
| `F5` | Submit KOT | Dispatches kitchen ticket and clears cart draft. |
| `F8` | Print Bill Invoice | Opens Billing Drawer and spools pre-check print. |
| `F10` | Pay Cash & Free Table | Opens Billing Drawer in Cash Tender mode. |
| `F11` | Pay Card / UPI & Free Table | Opens Billing Drawer in Card Tender mode. |
| `F12` | Shift Actions | Opens Shift Close / Z-Report menu. |
| `Esc` | Clear / Close | Clears search input, closes Billing Drawer, or cancels draft. |
| `Enter` | Primary Action Confirm | Confirms active cart submission or payment collection. |
| `Arrow Keys` | Grid Navigation | Moves focus up/down/left/right across table cards. |

---

## 4. Touch Gestures & Accessibility Standards

- **Touch Targets:** All buttons, table cards, category pills, and line item adjusters are minimum **44×44px** with 8px touch spacing.
- **Focus Management:** Opening the Billing Drawer traps keyboard focus inside the drawer until dismissed via `Esc` or completion.
- **Screen Reader ARIA:** `aria-expanded` attributes on the Billing Drawer, `role="region"` for Table Deck and Workspace, and `aria-live="polite"` for status log messages.
