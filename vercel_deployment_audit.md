# Vercel Production Deployment Audit Report

This report evaluates Vercel's production deployment configuration for **OrderRail**.

---

## 1. Verification of Deployment Items

### 1.1 Existence of vercel.json
* **Status:** **Missing**.
* **Details:** There is no `vercel.json` configuration file in the project root directory.

### 1.2 BrowserRouter Rewrite Requirements
* **Status:** **Required**.
* **Details:** React Router’s `BrowserRouter` relies on client-side routing. Without a Vercel rewrite configuration mapping all requests to `/index.html`, direct URL entry or page refreshing on any route other than `/` will fail with a Vercel 404 error page.

### 1.3 dist/index.html JS Bundle Reference
* **Status:** **Correct**.
* **Details:** Vite's build step correctly compiles assets and injects the hashed JS script path directly into `<script type="module" crossorigin src="/assets/index-*.js"></script>` at the bottom of the `dist/index.html` body.

### 1.4 Project Root Directory Deployment
* **Status:** **Correct**.
* **Details:** Vercel should build from the workspace project root containing `package.json`, `vite.config.ts`, and `index.html`.

### 1.5 Build Output Directory Configuration
* **Status:** **Correct**.
* **Details:** Vite outputs static assets to the `dist` directory by default. In Vercel, if the project Preset is set to **Vite**, Vercel automatically looks for the `dist` folder. If set to **Other**, it must be manually overridden to `dist`.

### 1.6 Vercel Project Settings Override
* **Status:** **Correct (unless overridden)**.
* **Details:** Normal Vite presets on Vercel naturally map output to `dist`. No overrides should be set unless the project framework preset was mistakenly configured as another system.

### 1.7 Production index.html Script Inclusions
* **Status:** **Correct**.
* **Details:** The production build compiles index.html with the exact generated assets. Once the environment variables are injected at build time, index.html loads and runs the referenced `/assets/index-*.js` file.

---

## 2. Exact Root Causes & Minimal Fixes

### Issue A: Missing Environment Variables (Blank Page)
* **Root Cause:** Vite injects `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` during compilation. Since these are not configured in Vercel's environment variables, they are evaluated as `undefined`, causing the Supabase SDK module import to throw a fatal initialization error that halts script execution before React mounts.
* **Minimal Fix:** Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` inside Vercel Dashboard Settings $\rightarrow$ Environment Variables, and rebuild.

### Issue B: Missing SPA Rewrite Configuration (404 Page on Reload)
* **Root Cause:** No `vercel.json` exists to route sub-page requests back to `/index.html` for client-side React routing.
* **Minimal Fix:** Create `vercel.json` in the project root with the following contents:
  ```json
  {
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```
