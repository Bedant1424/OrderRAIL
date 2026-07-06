# Landing Page Actions Investigation Report

This report documents the root-cause analysis of why the "Try the customer app" (Customer Interface) button and Demo QR codes section disappeared from the landing page, and details the recommended resolution.

---

## 1. Comparative Analysis (`src/pages/Index.tsx`)

A line-by-line comparison of [src/pages/Index.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/pages/Index.tsx) before and after the `CafeContext` refactoring shows:
* **No code was deleted or removed.** The JSX and conditionally rendered blocks for the `"Try the customer app"` button, `"Show demo QR codes"` button, and `"Staff sign in"` header links are still fully intact.
* **Refactoring changes:** The only changes made were replacing the direct query:
  ```typescript
  const { data: cafe } = await supabase.from("cafes").select("*").eq("slug", "orderrail").maybeSingle();
  ```
  with the global hook:
  ```typescript
  const { cafe, cafeId } = useCafe();
  ```
  This is a clean mapping of variables.

---

## 2. Root Cause of Disappearance

At runtime, the `"Try the customer app"` button and Demo QR codes block are conditionally rendered based on the presence of rows inside the `tables` table:

```typescript
// 1. firstTable is checked:
const firstTable = tables[0];

{firstTable && (
  <Link to={`/t/${firstTable.id}`}>Try the customer app</Link>
)}

// 2. tables.length is checked:
{showQRs && tables.length ? (
  // Render QR Codes
) : null}
```

### Database Audit
A direct query on the linked remote Supabase database (`tgmjetcvwkjjtxgtcamn`) reveals that **the `public.tables` table is completely empty (`rows: []`)**. 

Because this is a completely fresh database deployment:
1. `tables` resolves to `[]`.
2. `firstTable` is `undefined`.
3. Consequently, the `"Try the customer app"` button is omitted from the DOM, and clicking the `"Show demo QR codes"` button has no visible effect because `tables.length` is `0`.

---

## 3. Disappearance Timeline

* **Timeline:** The actions disappeared when the backend was transitioned to the fresh Supabase project (`tgmjetcvwkjjtxgtcamn`).
* **Intentionality:** The removal was **not** intentional, and was not caused by code deletion. It is an accidental side effect of running the app in a fresh environment that has no mock/seed data for tables.

---

## 4. Current Availability of Routes and Actions

All corresponding routes and actions are still implemented and fully configured in the application router:
* **Customer Table Route (`/t/:tableId`):** Active in [src/App.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/App.tsx#L45).
* **Staff Sign In (`/staff/login`):** Active in [src/App.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/App.tsx#L52).
* **Owner Sign In:** Managed via `/staff/login` (owners and staff share the unified auth layout and obtain roles via `public.user_roles` records).

---

## 5. Recommendation

To restore the buttons on the landing page immediately upon seeding/installation without modifying any code or affecting the centralized `CafeContext`:

### Database-Level Seeding (Recommended)
Add a default table record to the idempotent **[supabase/seed.sql](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/supabase/seed.sql)** script. 

Add the following inside the `DO` block's insert sequence:
```sql
-- Seed default Table 1 for the seeded Cafe
INSERT INTO public.tables (id, cafe_id, label, seats)
VALUES (
  '11111111-1111-1111-1111-111111111111', 
  '8c418a5a-7cd4-4054-8a88-f412c1762f7d', 
  '1', 
  4
) ON CONFLICT (id) DO NOTHING;
```

This ensures that any fresh deployment automatically has at least one table configured, making the `"Try the customer app"` and `"Show demo QR codes"` actions functional out-of-the-box.
