# Vercel Deployment Blank Page Investigation Report

This report documents the root-cause analysis of the deployed Vercel application rendering a blank page despite a successful build.

---

## 1. Evaluation of Potential Causes

### 1.1 CafeProvider Perpetual Loading State
* **Status:** **No**. 
* **Details:** `CafeProvider` does not block rendering or conditionalize its children. It immediately returns the context provider wrapping the children:
  ```typescript
  return <CafeCtx.Provider value={value}>{children}</CafeCtx.Provider>;
  ```
  Therefore, the React component tree mounts immediately, and the page is not kept blank by a loading gate.

### 1.2 App.tsx or CafeProvider Returning Null
* **Status:** **No**. 
* **Details:** Neither `App.tsx` nor `CafeProvider` returns `null` or contains rendering gates that output empty elements during mounting.

### 1.3 Vercel SPA Rewrite Rules
* **Status:** **Yes (required for deep routing, but not the cause of root blank page)**.
* **Details:** When accessing subroutes directly (e.g. `/staff/login`), Vercel will return a 404 page unless a `vercel.json` file with rewriting rules is configured:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```
  However, this issue causes a styled Vercel 404 page, not a blank page. The root URL `/` naturally resolves to `index.html` without requiring rewrites, yet remains blank.

### 1.4 Required VITE_* Environment Variables
* **Status:** **Yes (Exact Root Cause)**.
* **Details:** Vite environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`) are injected statically at **build time**.
  * If these environment variables are missing from the Vercel Dashboard project settings during the build process, they compile as `undefined`.
  * During page load, the browser evaluates the bundle scripts. When importing `@/integrations/supabase/client`, it executes the following module-level statement:
    ```typescript
    export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { ... });
    ```
  * Because these parameters are `undefined`, the Supabase SDK throws an initialization error (`supabaseUrl is required`). 
  * This evaluation crash halts the JavaScript runtime thread before `main.tsx` can call `createRoot` to mount React, leaving the `<div id="root"></div>` completely empty (blank page).

### 1.5 React Mount Success
* **Status:** **No**.
* **Details:** The evaluation crash in the module import chain halts JavaScript execution in the browser. As a result, the mounting code in `main.tsx` is never reached.

### 1.6 Dependence on Cafe Record Presence
* **Status:** **No**.
* **Details:** The landing page `Index.tsx` uses safe optional chaining (`cafe?.name`) and conditional querying (`enabled: !!cafeId`), so it renders correctly even if the database has zero records or slug lookups resolve to `null`.

---

## 2. Exact Root Cause Summary

The Vercel application displays a blank page because **the required environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`) were not configured in the Vercel project settings prior to building**. 

This causes the Supabase client initialization to crash during script evaluation at page load, halting browser execution before React is mounted. Since Vite builds are static compilation steps, the build process completes without warnings despite the missing variables.

---

## 3. Recommended Remediation

To resolve the blank page on your deployed Vercel site:
1. Go to your **Vercel Project Dashboard** $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**.
2. Add the following keys with their corresponding values from your Supabase console:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Trigger a **new deployment** on Vercel to rebuild the project with the variables injected.
