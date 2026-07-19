# Demo Mode Permissions Foundation

This document details the architectural strategy for managing capabilities and permissions under Demo Mode vs. Production environments, including frontend permission layouts and backend database constraints.

---

## 1. Demo Detection Strategy

Demo mode is **deployment-specific**, driven by the build-time environment variable `VITE_DEMO_MODE`.

### Deployments

| Deployment | URL | `VITE_DEMO_MODE` | Supabase Project |
|---|---|---|---|
| Public Demo | `https://order-rail.vercel.app/` | `true` | Demo Supabase |
| Production | `https://orderrail-pro-main.vercel.app/` | `false` (or unset) | Production Supabase |

### Resolution Hierarchy

- **`isDemoDeployment()`**: Single source of truth. Reads `import.meta.env.VITE_DEMO_MODE`. Returns `true` only when the value is the string `"true"`. This is the **only** place in the codebase that reads the environment variable.
- **`useDemoMode()`**: React hook. Returns `true` when `isDemoDeployment()` is `true` AND the current user is NOT the Demo Administrator. On production deployments, always returns `false`.
- **`isDemoAdmin(userId)`**: Returns `true` only on demo deployments when the user ID matches `APP_CONFIG.demoAdminUuid`.

### Vercel Environment Variables

Set the following in each Vercel project's **Settings → Environment Variables**:

**Demo Vercel project** (`order-rail`):
```
VITE_DEMO_MODE=true
VITE_SUPABASE_URL=<demo-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<demo-supabase-anon-key>
```

**Production Vercel project** (`orderrail-pro-main`):
```
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=<production-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<production-supabase-anon-key>
```

### Adding Future Deployments

To create a new deployment (e.g. staging):
1. Create a new Vercel project linked to the same repository.
2. Set `VITE_DEMO_MODE=false` (or `true` to mirror the demo experience).
3. Configure the appropriate Supabase URL and key.
---

## 2. Permission Architecture

Permissions are managed by a centralized hook helper (`usePermissions()` in `src/lib/permissions.ts`):
- **Role Verification**: Integrates user authorization profiles (`roles` array matching `user_roles` database tables) with demo status.
- **Capabilities Map**: Encapsulates functional permission checks into individual capability functions:
  - `canManageMenu()`
  - `canManageCategories()`
  - `canManageTables()`
  - `canManageQrCodes()`
  - `canUploadImages()`
  - `canManageCafeSettings()`
  - `canEditBranding()`
  - `canManageUsers()`
  - `canManageRoles()`
  - `canDeleteData()`
  - `canExportData()`
- **Production Mode**: Evaluates if the current user possesses the `"owner"` role. If they do, all administrative actions are allowed.
- **Demo Mode**: Allows trials of menu editing, categories, tables, and image uploads. Blocks actions that alter global brand identities (`canManageCafeSettings`, `canEditBranding`), invite team members (`canManageUsers`), or wipe catalog databases (`canDeleteData`).

---

## 3. UI Restrictions

When operating in the public demo café, the user interface disables modifications and masks sensitive configuration details:

### Demo Banner
Displayed globally across both the `OwnerLayout` and `StaffLayout` headers:
```text
🧪 Public Demo | Configuration changes are disabled. Explore freely.
```

### Disabled Actions
Disabled actions use a consistent styled disabled state (`bg-muted border cursor-not-allowed opacity-60`) accompanied by a locked indicator label `🔒` and hover description text: *"This action is disabled in the public demo."*

- **Menu Management**:
  - Disables creating new items/categories.
  - Disables editing or saving changes inside category and item dialogs.
  - Disables deleting items/categories.
  - Disables toggling menu item availability switches.
  - Disables cropping or uploading catalog image assets.
- **Tables & QR**:
  - Disables adding new tables.
  - Disables deleting existing tables.
  - Disables bulk downloading artworks ZIP.
  - Disables downloading single QR cards or QR images.
- **Café Settings**:
  - Disables all café name, tagline, address, phone, whatsapp, website, instagram, and maps review text inputs.
  - Disables changing base currencies.
  - Disables uploading or removing café logos.
  - Disables saving settings modifications.
- **Staff Management**:
  - Disables adding or inviting teammate emails.
  - Disables removing or revoking active staff members.
  - Disables promoting/demoting teammate roles inside the edit role dialog.

### Masked Data
To prevent disclosure of user identities and internals:
- **Emails**: Masked using the pattern `l*******t@domain.com`.
- **UUIDs / Internal Identifiers**: Fallbacks are masked using `usr_xxxx***xxxx` matching the first and last segments.

---

## 4. Backend Enforcement Strategy

To secure the public demo café against direct Supabase API bypasses, database-level restrictions are enforced:
- **Helper Infrastructure**: A database function `public.is_demo_cafe(cafe_id)` identifies whether a given operation targets the demo café (`slug = 'orderrail'`).
- **Restrictive RLS Policies**: Uses PostgreSQL `AS RESTRICTIVE` policies which run as mandatory `AND` filters. If a query targets the demo café, write operations (`INSERT`, `UPDATE`, `DELETE`) are denied.
- **Function Guards**: SECURITY DEFINER database functions check demo café membership and raise explicit authorization exceptions.

### Protected Tables (Read-Only under Demo Mode)
- **`cafes`**: Blocks updating café taglines, currencies, addresses, or configurations.
- **`menu_categories`**: Prevents adding, editing, or deleting categories.
- **`menu_items`**: Prevents catalog changes or pricing updates.
- **`tables`**: Blocks table modifications or seating limit updates.
- **`user_roles`**: Disallows direct insertion, modification, or removal of user privilege rows via REST.
- **`staff_invites`**: Blocks manual user role invitations.
- **`profiles`**: Restricts updating profiles of users linked to the demo café.
- **`storage.objects`**: Prevents image uploads, asset replacements, or file deletions within the `menu-images` bucket under the demo café path.

### Protected RPCs
- **`public.assign_role_by_email`**: Raises an exception (`'This action is disabled in the public demo.'`) when executing against the demo café, preventing owner assignments or staff invitations.

### Allowed Operational Behavior
To maintain interactive demo cycles, the database allows full access to the following operations:
- **`orders` / `order_items`**: Customer checkouts and cart submissions remain enabled.
- **`service_requests`**: Call-staff triggers (water, waiter, bill) and resolutions remain enabled.
- **`reviews`**: Diner feedback submissions are permitted.
- **`dining_sessions` / `daily_order_counters` / `order_events`**: Live state logging and status rollups remain operational.

---

## 5. Intentional Limitations

To preserve realistic testing environments while locking configuration settings, the following limitations are intentionally left active:
- **Visual UI bypasses**: Technologically savvy users can modify browser HTML to enable buttons locally, but the database RLS policies will reject all write submissions.
- **Live workflow paging**: Dine-in order checkouts, service requests, and notifications remain active in the UI to allow trial staff workflows.
- **Session tracking**: Active dining sessions and order metrics log live events but do not persist changes to the catalog items.

---

## 6. Demo Administrator Support

To support administrative validation and seed setup of the public demo without exposing vulnerabilities to public users:
* **UUID Isolation**: The UUID `c261a4be-a1eb-42d4-8623-a81ef0100921` is defined in a single configuration property (`APP_CONFIG.demoAdminUuid`) inside `src/config/app.ts`.
* **Centralized Helpers**: Resolved via `isDemoAdmin(user)` and `useDemoAdmin()` helpers in `src/lib/permissions.ts`.
* **Full Bypass Permissions**: 
  * If the active user matches the Demo Admin UUID, `useDemoMode()` returns `false`, bypassing all frontend warning banners, read-only disabled inputs, and masked display values.
  * In `usePermissions()`, the Demo Admin is automatically granted complete `isOwner` and `isStaff` capabilities, unlocking form configurations and deletions.
* **Database RLS Exemption**:
  * PostgreSQL restrictive policies query the `public.is_demo_admin(auth.uid())` helper and bypass the demo write restriction if true.
  * RPC guards allow the Demo Admin to invite, revoke, or promote teammate roles directly.

---

## 7. Extension Points

- **Adding Capabilities**: Add a new capability property under `usePermissions()` in `src/lib/permissions.ts`.
- **Custom Demo Slugs**: Update the target slug value `cafeSlug` inside `src/config/app.ts` to switch demo instances.
- **Database Locks**: To lock additional tables under the demo café, add a new `AS RESTRICTIVE` policy calling `is_demo_cafe(cafe_id)`.
