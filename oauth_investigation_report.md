# Google OAuth Exchange Failure Investigation Report

This report documents the root-cause analysis of the Google OAuth exchange failure.

---

## 1. Analysis of Callback & Verification

### 1.1 Redirection parameters (`signInWithOAuth`)
* **File:** **[src/pages/staff/StaffLoginPage.tsx:50-55](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/pages/staff/StaffLoginPage.tsx#L50-L55)**
* **Code:**
  ```typescript
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/staff/login`,
    },
  });
  ```
* **Status:** **Correct**. It directs the auth server to redirect the user back to the staff login screen after completing the handshake.

### 1.2 Manual `exchangeCodeForSession` Calls
* **Status:** **None**. There are no manual calls to `exchangeCodeForSession` in any of the application source files.

### 1.3 Missing manual code exchange check
* **Status:** **Not missing**. Because the Supabase JS SDK handles URL parameters (`?code=...`) automatically on initialization, the developer does not need to call `exchangeCodeForSession()` manually.

### 1.4 URL Detection (`detectSessionInUrl`)
* **File:** **[src/integrations/supabase/client.ts:36-45](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/integrations/supabase/client.ts#L36-L45)**
* **Status:** **Omitted (Defaults to True)**. The `detectSessionInUrl` configuration option is not declared or overridden inside the Supabase client settings, meaning it remains active by default.

---

## 2. Exact Root Cause

The error message **`"Unable to exchange external code"`** is returned directly by the **Supabase GoTrue Auth server** when it fails to exchange the Google authorization code for access tokens.

This failure points to one of two external server-side configuration issues on the active Supabase project **`tgmjetcvwkjjtxgtcamn`**:

1. **Missing or Mismatched Redirect URI in Google Cloud Console:**
   * Google Cloud Console requires the Supabase project's specific callback URL to be registered in the **Authorized redirect URIs** list.
   * *Correct Callback URI:* `https://tgmjetcvwkjjtxgtcamn.supabase.co/auth/v1/callback`
   * If this URI is missing or typed incorrectly, Google will reject the token exchange request.
2. **Invalid Client ID / Client Secret in Supabase Console:**
   * If the Google Client ID or Client Secret configured in the Supabase Dashboard under **Auth > Providers > Google** is invalid, mismatched, or expired, the Supabase Auth server cannot authenticate with Google's API to perform the exchange.

---

## 3. Recommended Remediation

Since the application codebase is configured correctly, the administrator must resolve this in the Google and Supabase web consoles:

1. **Retrieve Google Credentials:** Create an OAuth Web Application credential in the [Google Cloud Console](https://console.cloud.google.com/).
2. **Add Redirect URI:** Under Google Console credentials, add the following to **Authorized redirect URIs**:
   `https://tgmjetcvwkjjtxgtcamn.supabase.co/auth/v1/callback`
3. **Configure Supabase Console:** Go to your [Supabase Dashboard](https://supabase.com/dashboard), navigate to **Auth > Providers > Google**, toggle it on, and input the Client ID and Client Secret.
