# Authentication Analysis & Supabase Migration Plan

This document analyzes the current authentication setup for the **OrderRail** project and details how it can be migrated completely to native **Supabase Auth**.

---

## 1. Current Authentication Analysis

### 1.1 Why `@lovable.dev/cloud-auth-js` is used
The `@lovable.dev/cloud-auth-js` library acts as a **federated OAuth proxy**. Because Lovable projects share a managed Supabase database instance, individual projects do not initially have direct Google/Apple OAuth credentials configured on the Supabase dashboard. 
* Lovable provides a shared proxy where users authenticate via Lovable's OAuth client.
* Once OAuth completes, the proxy returns JWT session tokens (`access_token`, `refresh_token`, etc.).
* The wrapper code calls `supabase.auth.setSession(result.tokens)`, logging the user directly into the Supabase project database instance.

### 1.2 Pages using Lovable authentication
* [StaffLoginPage.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/pages/staff/StaffLoginPage.tsx) is the only page utilizing Lovable Auth. It is specifically used for the "Continue with Google" sign-in flow.

### 1.3 Files that import `src/integrations/lovable`
* [StaffLoginPage.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/pages/staff/StaffLoginPage.tsx#L6) is the only file importing the integration:
  ```typescript
  import { lovable } from "@/integrations/lovable";
  ```

### 1.4 How sessions are managed
Sessions are managed entirely by the **native Supabase Client SDK**:
* Email/Password sign-up and sign-in are performed directly via `supabase.auth.signUp` and `supabase.auth.signInWithPassword`.
* The [auth.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/lib/auth.tsx) provider listens to auth state changes using `supabase.auth.onAuthStateChange` and fetches session state via `supabase.auth.getSession()`.
* Logouts are executed using `supabase.auth.signOut()`.
* Setting a session via the Google OAuth proxy is done by calling `supabase.auth.setSession(tokens)`.

### 1.5 Feasibility of Migration to Supabase Auth
**Yes, authentication can be migrated 100% to native Supabase Auth.** Since the app already uses Supabase for email/password auth and session persistence, removing the Lovable proxy layer only requires configuring the Google OAuth provider directly on your own Supabase project.

---

## 2. Migration Plan

Follow these steps to migrate completely from Lovable Auth to native Supabase Auth.

### Step 1: Configure Google OAuth in Supabase
1. Create a Google Cloud Project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Set up the OAuth consent screen and create an **OAuth Client ID** for Web Applications.
3. Add the Supabase Redirect URI (copied from your Supabase Dashboard under *Authentication > Providers > Google*) as an authorized redirect URI in Google.
4. Go to your **Supabase Dashboard** > **Authentication** > **Providers** > **Google**.
5. Enable the Google provider, paste the Google Client ID and Client Secret, and save.

### Step 2: Update Login Code
In `src/pages/staff/StaffLoginPage.tsx`:
* Remove the `lovable` import:
  ```diff
  - import { lovable } from "@/integrations/lovable";
  ```
* Update the `signInGoogle` function to use `supabase.auth.signInWithOAuth`:
  ```diff
    const signInGoogle = async () => {
      setBusy(true);
      try {
-       const result = await lovable.auth.signInWithOAuth("google", {
-         redirect_uri: `${window.location.origin}/staff/login`,
-       });
-       if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
-       if (result.redirected) return;
+       const { error } = await supabase.auth.signInWithOAuth({
+         provider: "google",
+         options: {
+           redirectTo: `${window.location.origin}/staff/login`,
+         },
+       });
+       if (error) throw error;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Google sign-in failed";
        toast.error(msg);
      } finally {
        setBusy(false);
      }
    };
  ```

### Step 3: Remove Lovable Integration Files
* Delete the `src/integrations/lovable` directory and `src/integrations/lovable/index.ts`.

### Step 4: Uninstall the Package
* Remove the dependency from `package.json`:
  ```bash
  npm uninstall @lovable.dev/cloud-auth-js
  ```
* Run `npm install` to update `package-lock.json`.
