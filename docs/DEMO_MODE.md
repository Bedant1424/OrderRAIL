# Demo Mode Permissions Foundation

This document details the architectural strategy for managing capabilities and permissions under Demo Mode vs. Production environments, including frontend permission layouts and backend database constraints.

---

## 1. Demo Detection Strategy

The system uses a single source of truth to detect if the application is running against the public demo café:
- **Identifier Match**: Every café possesses a unique string-based URL identifier (`slug`).
- **Configuration Boundary**: The global application configuration (`src/config/app.ts`) defines the default demo identifier slug under `APP_CONFIG.cafeSlug` (currently `"orderrail"`).
- **Resolution**:
  - `isDemoMode(slug)`: Utility function comparing case-insensitively.
  - `useDemoMode()`: React hook checking the loaded café slug context against the configuration value.

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

## 5. Extension Points

- **Adding Capabilities**: Add a new capability property under `usePermissions()` in `src/lib/permissions.ts`.
- **Custom Demo Slugs**: Update the target slug value `cafeSlug` inside `src/config/app.ts` to switch demo instances.
- **Database Locks**: To lock additional tables under the demo café, add a new `AS RESTRICTIVE` policy calling `is_demo_cafe(cafe_id)`.
