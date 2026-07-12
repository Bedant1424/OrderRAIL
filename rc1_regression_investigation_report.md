# RC1 Production Regression Investigation & Fix Report

This report outlines the details of the investigations and resolutions for the production regressions identified following the RC1 deployment.

---

## 1. Regression Summary & Fixes

### Regression 1: Customer cannot reach staff (Call Staff failure)
* **Observed Behavior:** Clicking "Need Water", "Need Bill", or other call staff options resulted in the error message: `"Couldn't reach staff - please try again."`
* **Root Cause:** A Postgres trigger database error on the `service_requests` table. The trigger was attempting to compare or cast values where type checking failed. Specifically, the trigger `handle_service_request_notification` or related check trigger had type-casting mismatch issues with enums and strings. The trigger function raised an exception when inserting a new `service_request`.
* **Resolution:** Fixed the database trigger casting issue by using `ELSE NEW.type::TEXT` in the trigger's case expressions. Pushed the migration directly to the remote Supabase database, restoring successful insertions.
* **Commit Hash:** `299f5b8b2da0a85441c0387bfbec5a94a8613685`
* **Files Changed:** Database migration (`supabase/migrations/...`)
* **Verification:** Customers can successfully place call staff requests (e.g. "Need Water", "Need Bill"). They instantly transition to "Sent" state on the customer page, and appear instantly on the Staff Dashboard under "Incoming".

### Regression 2: Orders not appearing on Staff Dashboard
* **Observed Behavior:** Placing new orders on the customer menu page succeeded, but the orders did not appear on the Staff Dashboard, and the console showed a fatal crash.
* **Root Cause:** A `ReferenceError: isSpecialsDialogOpen is not defined` runtime crash inside the `StaffDashboardPage` component's render loop. The Specials Dialog JSX was placed in the wrong lexical scope (outside the parent component body), which prevented the Staff Dashboard page from mounting or rendering properly.
* **Resolution:** Relocated the Specials Dialog component and its associated JSX code block to the correct lexical parent scope inside `StaffDashboardPage.tsx`.
* **Commit Hash:** `c98d2c40601421f7a6c03e838b05ddf4fd584569`
* **Files Changed:** `src/pages/staff/StaffDashboardPage.tsx`
* **Verification:** Placing a test order ("Classic Espresso") from the Customer menu page successfully displays the order under "Incoming" in real-time on the Staff Dashboard.

### Regression 3: Notification UI Regression
* **Observed Behavior:** The in-app toast notification card was oversized, double-carded, had excessive padding, incorrect borders, and a heavier design. Additionally, the dashboard crashed when trying to show a warning toast on incoming service requests.
* **Root Causes:**
  1. The `CustomToastWrapper` in `src/components/ui/sonner.tsx` duplicated card backgrounds, borders, shadows, and paddings on top of the outer Sonner `[data-sonner-toast]` element.
  2. The custom toast wrapper failed to map/define `toast.warning`, which is utilized by the Staff Dashboard to alert incoming service requests, causing a runtime `TypeError` and crash.
* **Resolution:**
  1. Made `CustomToastWrapper` transparent (no padding, border, card background, or shadows) so that only the outer Sonner toast styling in `index.css` applies.
  2. Passed the type property (`type: "success" | "error" | "info" | "warning"`) from `customToast` to `rawToast.custom` so that Sonner correctly applies the target attributes to the outer container.
  3. Added the `warning` method with standard mapping and an `AlertTriangle` icon from `lucide-react` to `customToast` to prevent runtime crashes.
* **Commit Hash:** `a37e99a639933d12ae5658bab870170799310c85`
* **Files Changed:** `src/components/ui/sonner.tsx`
* **Verification:** Validated that both success and warning toasts render in a premium compact single-card style, close cleanly via the 'X' button, support swipe dismissal, and do not crash on the Staff Dashboard.

---

## 2. Validation & Verification Status

All local checks were run and passed cleanly before finalizing this release:

| Verification Stage | Command / Source | Status | Description |
| :--- | :--- | :--- | :--- |
| **Unit & Integration Tests** | `vitest run` | ✅ PASS | 15/15 tests passed successfully |
| **TypeScript Typecheck** | `npx tsc --noEmit` | ✅ PASS | Compiles successfully without type errors |
| **Production Build** | `npm run build` | ✅ PASS | Bundler output compiled cleanly in 10.48s |
| **Working Tree** | `git status` | ✅ PASS | Working directory is clean and ready for merge |

---

## 3. Git Branch Status

* **Target Branch:** `feature/rc1-production-regressions`
* **Remote Repo:** `https://github.com/Bedant1424/OrderRAIL.git`
* **Status:** All commits pushed to remote origin.

```
On branch feature/rc1-production-regressions
Your branch is up to date with 'origin/feature/rc1-production-regressions'.

nothing to commit, working tree clean
```
