# Application Configuration Centralization Report

This report documents the implementation of the centralized configuration module for the **OrderRail** application.

---

## 1. File Modification Log

### Files Created
* **[src/config/app.ts](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/config/app.ts)**: Declares the centralized global configuration:
  ```typescript
  export const APP_CONFIG = {
    appName: "OrderRail",
    cafeSlug: "orderrail",
    defaultCurrency: "INR",
  };
  ```

### Files Modified
* **[src/lib/cafe.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/lib/cafe.tsx#L24)**: Imported `APP_CONFIG` and updated the query function to resolve the cafe dynamically:
  ```typescript
  .eq("slug", APP_CONFIG.cafeSlug)
  ```

---

## 2. Remaining Runtime References to "orderrail"

A code audit of the runtime codebase (`src`) confirms that the `"orderrail"` slug string has been successfully centralized:
* **[src/config/app.ts](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/config/app.ts#L3)**: `cafeSlug: "orderrail"` is the **only** remaining runtime occurrence of the hardcoded database lookup slug string in the entire frontend source codebase.
* Other references to the string `"orderrail"` (or `"OrderRail"`) remain strictly limited to:
  * **Branding and Logos:** UI headers/sidebars rendering "OrderRail" text.
  * **LocalStorage namespaces:** `orderrail.cart.<tableId>`, `orderrail.order_queue`, and `orderrail.session_id`.
  * **Database scripts:** `supabase/seed.sql` and the initial SQL migrations.
  * **Documentation:** `docs/INSTALLATION.md`, `README.md`, etc.

---

## 3. Verification & Validation

* **Build Status:** **Success**. `npm run build` executed successfully with no compilation errors or type warnings.
* **Development Server:** **Success**. Started Vite on `http://localhost:8080/`.
* **Behavior Integrity:** Since `APP_CONFIG.cafeSlug` resolves to `"orderrail"` at runtime, the application behavior is 100% unchanged, ensuring compatibility with all existing database installations.
* **Git status:** Committed as `"Centralize application configuration in src/config/app.ts"` (commit `f4ba200`).
