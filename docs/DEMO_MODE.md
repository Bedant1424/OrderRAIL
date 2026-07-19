# Demo Mode Permissions Foundation

This document details the architectural strategy for managing capabilities and permissions under Demo Mode vs. Production environments.

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

## 3. Database RLS Infrastructure

To support demo mode logic at the database level:
- A database function `public.is_demo_cafe(cafe_id)` checks if a café matches the `"orderrail"` slug.
- This helper can be integrated into custom Row-Level Security (RLS) policies to allow or deny modifications depending on the café's demo status.

---

## 4. Extension Points

- **Adding Capabilities**: Add a new capability property under `usePermissions()` in `src/lib/permissions.ts`.
- **Custom Demo Slugs**: Update the target slug value `cafeSlug` inside `src/config/app.ts` to switch demo instances.
- **Database Locks**: Inject `NOT is_demo_cafe(cafe_id)` in database RLS policies to restrict write operations to non-demo cafés.
