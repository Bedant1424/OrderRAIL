# Cafe Slug Reference Analysis

This document analyzes references to the hardcoded slug `"orderrail"` (and `"OrderRail"` branding strings) throughout the project, validating that database query resolution has been consolidated to the `CafeContext` and classifying the remaining occurrences.

---

## 1. Context Resolution

### 1.1 Where is the cafe slug currently resolved?
The database query to resolve the default cafe is executed exactly once inside **[src/lib/cafe.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/lib/cafe.tsx#L24)**:
```typescript
const { data, error: err } = await supabase
  .from("cafes")
  .select("*")
  .eq("slug", "orderrail")
  .maybeSingle();
```

### 1.2 Consolidation Check
* **Is `"orderrail"` now referenced only inside `CafeContext` for database lookups?**
  **Yes.** No other page, component, or layout in the React codebase queries the `cafes` table with `.eq("slug", "orderrail")`.
* **Are there any other remaining query-based lookups?**
  **No.** All other React files pull the cafe state and UUID context directly from the `useCafe()` hook.

---

## 2. Occurrence Log & Classification

Below is a complete classification of the remaining occurrences of the `"orderrail"` / `"OrderRail"` strings outside of `node_modules` and lock files:

### 2.1 Configuration
* **[src/lib/cafe.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/lib/cafe.tsx#L24)**: `.eq("slug", "orderrail")`
  * *Role:* Resolves the default global cafe context.
* **[package.json](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/package.json#L2)**: `"name": "orderrail"`
  * *Role:* Identifies the npm package name.
* **[public/manifest.webmanifest](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/public/manifest.webmanifest#L2)**: `"name": "OrderRail"`, `"short_name": "OrderRail"`
  * *Role:* Controls metadata for Progressive Web App (PWA) installation.
* **[index.html](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/index.html#L16)**: `<title>OrderRail — QR ordering for cafes</title>` (and og/description tags)
  * *Role:* Browser window title and OpenGraph metadata.
* **[supabase/.temp/linked-project.json](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/supabase/.temp/linked-project.json#L1)**: `"name": "OrderRAIL"`
  * *Role:* Holds local linking settings for the Supabase CLI.
* **LocalStorage Keys:**
  * **[src/lib/cart.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/lib/cart.tsx#L23)**: `orderrail.cart.`
  * **[src/lib/orderQueue.ts](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/lib/orderQueue.ts#L22)**: `orderrail.order_queue`
  * **[src/lib/session.ts](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/lib/session.ts#L2)**: `orderrail.session_id`
  * *Role:* Prevents namespace collisions in browser `localStorage`.

### 2.2 Seed / Bootstrap
* **[supabase/seed.sql](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/supabase/seed.sql#L6)**: `WHERE slug = 'orderrail'`, `VALUES ('OrderRail', 'orderrail', 'INR')`
  * *Role:* Seeds the initial cafe record so the application runs correctly on a fresh install.

### 2.3 Test / Demo
* **[supabase/migrations/20260703170026_f12a71f4-c6d4-4301-beff-c0c1ead30bfb.sql](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/supabase/migrations/20260703170026_f12a71f4-c6d4-4301-beff-c0c1ead30bfb.sql#L18)**: `WHERE slug = 'orderrail'`
  * *Role:* Used in `claim_demo_role` to assign roles to staff in the default demo cafe.
* **UI Logo / Brand Strings:**
  * **[Index.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/pages/Index.tsx#L53)**
  * **[StaffLoginPage.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/pages/staff/StaffLoginPage.tsx#L87)**
  * **[OwnerLayout.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/layouts/OwnerLayout.tsx#L32)**
  * **[StaffLayout.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/layouts/StaffLayout.tsx#L29)**
  * *Role:* Renders the static title "OrderRail" in the headers and layout sidebars.

### 2.4 Documentation
* **[README.md](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/README.md)**
* **[docs/INSTALLATION.md](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/docs/INSTALLATION.md)**
* **[architecture_documentation.md](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/architecture_documentation.md)**
* **[auth_migration_plan.md](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/auth_migration_plan.md)**
  * *Role:* References the project name in descriptions, route definitions, and setups.
