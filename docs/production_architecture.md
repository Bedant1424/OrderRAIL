# OrderRail Production Architecture & Design

This document details the architectural layout, technical strategy, and implementation roadmap for transitioning the Production deployment of OrderRail (`https://orderrail-pro-main.vercel.app`) into a proper B2B SaaS application.

---

## 1. Production Landing Page Structure

The current landing page (`src/pages/Index.tsx`) is designed for public B2C demo exploration. For production, we will replace this with a high-conversion SaaS landing page focused on restaurant owners.

### Visual Sections
1. **Header/Navigation Bar**
   - Brand Logo & Title (`OrderRail`)
   - Product Features, Pricing, and FAQ anchor links
   - Primary CTAs: **Sign In** (redirects to `/login`) and **Request Demo** (scrolls to lead form)
2. **Hero Section**
   - Headline: *"The ordering system your café deserves."*
   - Subheadline: *"Streamline table ordering, coordinate your kitchen, and boost table turnover — without changing how you run your floor."*
   - High-contrast CTAs: `Request a Demo` (Primary) and `Sign In` (Secondary)
   - Product mockup: Showing a customer ordering on a phone next to a tablet displaying the staff console.
3. **Value Proposition / Core Workflows**
   - **QR Table Ordering**: Customers scan, browse, and place orders directly to the kitchen.
   - **Kitchen Display System (KDS)**: Chef-optimized dashboard showing live tickets, times, and order statuses.
   - **Counter Billing**: Clean dashboard for cashiers to process bills, accept payments, and manage tables.
   - **Manager & Owner Analytics**: Real-time sales summaries, item performance, and staff resolution metrics.
4. **How It Works (4-step visual flow)**
   - *Step 1: Scan & Browse* (No app download required).
   - *Step 2: Instant Order* (Sent straight to kitchen).
   - *Step 3: Serve & Alert* (Floor staff notified).
   - *Step 4: Unified Bill* (Seamless checkout at the counter).
5. **Pricing Tiers (Placeholder)**
   - Standard monthly pricing structure with key features comparison.
6. **Lead Generation Form (Request Demo)**
   - Capture form fields (Restaurant Name, Owner/Contact Name, Email, Phone, City, current POS, size, etc.) to trigger sales onboarding.
7. **FAQ Accordion**
   - Clean dropdown answers to common questions (e.g., hardware requirements, payment setup, internet downtime handling).
8. **Footer**
   - Copyright, contact details, links to Privacy Policy and Terms of Service.

### Removals from Production
- ❌ **Remove** the "Try Customer App" CTA link.
- ❌ **Remove** the "Show demo QR codes" toggle and the QR canvas rendering grid.
- ❌ **Remove** the "Claim demo access" button from the login pages.
- ❌ **Remove** any direct mentions of "demo cafe" or "Lovable Cloud placeholder".

---

## 2. Customer Access Routing & Session Architecture

To prevent unauthorized public checkouts or catalog browsing, customers must be restricted to context-specific QR entry.

### Access Flow
1. Customers access the application **only** by scanning a physical QR code placed at a table.
2. The QR codes encode the absolute table URL: `https://orderrail-pro-main.vercel.app/t/:tableId`.
3. There are no navigational links pointing to `/t/:tableId` anywhere on the B2B landing page.
4. Search engine crawlers are explicitly blocked from indexing customer table routes by placing a `<meta name="robots" content="noindex, nofollow">` inside `TableLayout.tsx`.

### Validation & Session Lifecycle
```
                 [Customer scans QR code]
                            │
                            ▼
               GET /t/:tableId Route Hit
                            │
                            ▼
              [TableLayout checks tableId]
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
     [tableId Invalid]             [tableId Valid]
             │                             │
             ▼                             ▼
    Show "Table Not Found"          Retrieve Cafe details
     or Redirect to 404             & initialize Dining Session
                                           │
                                           ▼
                                    TableMenuPage
```

- When a valid `tableId` is scanned, the `TableLayout` retrieves the associated `cafe_id` from the database.
- It checks if a local session ID exists in `localStorage`. If not, or if the table is marked as reset, a new `dining_session` is initialized in the database with status `browsing`.
- The customer's localStorage cart is cleared if it contains items from a different table, protecting guest privacy across table transitions.

---

## 3. Invitation-Based Authentication Flow

Self-service signups are disabled in B2B production mode. Access is restricted to users who have been explicitly invited by a restaurant Owner.

### Invitation Process
```
[Owner sends invite via email]
             │
             ▼
[Record written to staff_invites] ──▶ (Generates unique, secure Token)
             │
             ▼
[User receives acceptance email]
             │
             ▼
[User clicks invitation link] ──▶ GET /accept-invite?token=xxx
                                            │
                                            ▼
                               [Verify Token & Email]
                                            │
                             ┌──────────────┴──────────────┐
                             ▼                             ▼
                      [Google Auth]                [Email + Password]
                             │                             │
                             └──────────────┬──────────────┘
                                            ▼
                           [Supabase auth.users entry created]
                                            │
                                            ▼
                           [DB Trigger: handle_new_user()]
                                            │
                                            ▼
                        - Match email against staff_invites
                        - Populate user_roles (Grant Role)
                        - Delete/Mark used in staff_invites
                        - Redirect to /owner or /staff
```

---

## 4. Authentication Methods & Email Matching

We will support **Email/Password** and **Continue with Google** (OAuth).

### Security Constraint
To prevent unauthorized users from hijacking pending invites:
1. When a user accepts an invitation, they must authenticate.
2. The trigger `handle_new_user` matches the newly registered user's authenticated email (retrieved via `NEW.email` from `auth.users`) to the `staff_invites` table.
3. If they sign up with a different Google account or type a different email during registration, no matching invitation will be found.
4. The transaction succeeds in creating a base Supabase account, but **no role is granted**, and their `profiles` row is not linked to any café. The UI will catch this state and redirect them to a "No Access / Awaiting Invitation" screen.

---

## 5. User Management & Lifecycle

Owners manage their restaurant's staff via a dedicated **People** page (replacing the current staff page inside `/owner`).

### Database Model: `staff_invites` (Enhanced)
```sql
CREATE TABLE public.staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  revoked_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cafe_id, email, role)
);
```

### Invitation Statuses
- **Pending**: Invite exists, `accepted_at` is NULL, `revoked_at` is NULL, and `expires_at > now()`.
- **Accepted**: `accepted_at` is NOT NULL.
- **Expired**: `accepted_at` is NULL, `revoked_at` is NULL, and `expires_at <= now()`.
- **Revoked**: `revoked_at` is NOT NULL.

### Owner Capabilities
Owners can trigger the following actions from the People dashboard:
- **Invite User**: Invokes `assign_role_by_email(_cafe_id, _email, _role)` RPC, creating a new invite and generating the token.
- **Change Role**: Updates the `role` field on the user's `user_roles` record.
- **Disable Account**: We will introduce an `is_active` boolean column to the `user_roles` table. Toggling this to `false` blocks all RLS read/write access immediately without deleting the user's history.
- **Remove Account**: Deletes the row from `user_roles`. Cascade rules clean up associated permissions.
- **Resend Invitation**: Resets `expires_at = now() + interval '7 days'`, clears `revoked_at`, generates a fresh token, and triggers a new invitation email.
- **Revoke Invitation**: Sets `revoked_at = now()`.

---

## 6. Roles & Permissions System

We will expand the existing roles to accommodate typical restaurant organizational hierarchies.

### Expanded Roles Matrix
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'kitchen';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'waiter';
```

| Capabilities | Owner | Manager | Cashier | Kitchen | Waiter |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Full Settings & Billing Control | ✅ | ❌ | ❌ | ❌ | ❌ |
| Team & User Management | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit Menu Catalog & Pricing | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Tables & QR generation | ✅ | ✅ | ❌ | ❌ | ❌ |
| Handle Counter POS & Billing | ✅ | ✅ | ✅ | ❌ | ❌ |
| Monitor/Resolve Service Requests | ✅ | ✅ | ✅ | ❌ | ✅ |
| View Kitchen Order Display (KDS) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit Item Live Availability (Specials) | ✅ | ✅ | ❌ | ✅ | ❌ |

---

## 7. Lead-Generation & Request Demo Flow

Rather than routing production prospects directly into the public demo, the landing page will feature a structured B2B lead capture funnel.

### Data Capture Fields
Prospects requesting a demo will submit a form capturing:
- **Restaurant Name** (Text, Required)
- **Contact Name** (Text, Required)
- **Email** (Email, Required)
- **Phone** (Tel, Required)
- **City** (Text, Required)
- **Restaurant Size / Table Count** (Select, Required)
- **Current POS System** (Text, Optional)
- **Preferred Contact Time** (Select: Morning / Afternoon / Evening, Optional)
- **Special Requirements** (Textarea, Optional)

### Lead Storage Schema
```sql
CREATE TABLE public.demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  table_count TEXT NOT NULL,
  current_pos TEXT,
  preferred_time TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'scheduled', 'completed', 'cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Public write-only, Admin read-only
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert demo requests" ON public.demo_requests FOR INSERT WITH CHECK (true);
```

### Post-Submission Workflow
1. Prospect submits the form.
2. The UI renders a success state: *"Thank you! Our onboarding team will contact you in the next 24 hours."*
3. A Database webhook fires to trigger a notification email to the OrderRail sales team (via Supabase Edge Functions or a Zapier hook).
4. The system presents a link to explore the B2C sandbox public **Demo Site** (`https://order-rail.vercel.app`) to play with self-service flows while their live environment is prepared.

---

## 8. Multi-Tenant Scalability & Franchise Support

Currently, `CafeProvider` is tied to a hardcoded config slug (`APP_CONFIG.cafeSlug = "orderrail"`). To scale to hundreds of cafes, the application must resolve tenants dynamically.

### Dynamic Resolution Path
1. **Customer Side**: Resolved via URL parameter (`/t/:tableId`). `TableLayout` queries the table record, finds its `cafe_id`, and loads the correct branding and menu automatically.
2. **Staff/Owner Side**: Resolved via authenticated user credentials. Upon login, the `AuthProvider` queries the user's role records:
   ```sql
   SELECT cafe_id, role FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true;
   ```
   The `CafeProvider` loads the context matching the user's assigned `cafe_id`. If a user is registered under multiple locations (e.g., a franchise manager), they are presented with a tenant selection dashboard.

### Schema Hierarchy for Franchise/Multi-Branch Scalability
To support chain operators in the future, we will transition the schema to:
```
Organizations (Enterprise Account)
    └── Cafes / Branches (Unique locations, menus, tables)
           ├── user_roles (Scoped roles per location)
           └── menus / tables / orders (Partitioned by cafe_id)
```
Since every transaction, order, and configuration table already references `cafe_id` directly, the database structure is fully prepared for B2B multi-tenancy.

---

## 9. Security & Vulnerability Audit

We have identified the following vectors and established direct mitigations:

| Attack Vector | Vulnerability | Architectural Resolution |
| :--- | :--- | :--- |
| **Direct Signup Bypass** | Bad actors signup via `/login` and assign themselves roles. | Signups are disabled on `/login`. The auth client only allows registration through valid `/accept-invite?token=...` routes. |
| **RPC Escalation** | `claim_demo_role` executed via REST API on production. | SQL function `claim_demo_role` is updated to check `is_demo_cafe(cafe_id)`. If the target café is not the public demo café, the function aborts. |
| **Disabled Account Leak** | Terminated employees access system via cached JWTs. | All RLS policies are updated to join on `user_roles` and enforce `is_active = true`. |
| **Token Hijacking** | Users register under a different email than the invited email. | The trigger `handle_new_user` matches the account's primary email. If `auth.users.email` does not match `staff_invites.email`, role granting is skipped. |

---

## 10. Recommended Implementation Roadmap

We propose a B2B SaaS implementation timeline divided into four logical milestones.

### Milestone 1: Landing Page & Auth Lockdown (P0)
- Build static, B2B-optimized landing page layout.
- Disable custom sign-up toggles on `/login`.
- Add token validation and invite acceptance routing on `/accept-invite`.
- Restrict self-claim RPCs to the `orderrail` cafe slug.

### Milestone 2: Team Lifecycle & People Dashboard (P1)
- Build dashboard user interface to manage, resend, and revoke invites.
- Enforce the new `is_active` boolean on all RLS verification hooks.
- Create email-matching hooks inside the `on_auth_user_created` trigger.

### Milestone 3: Dynamic Multi-Tenant Provider (P1)
- Remove hardcoded B2C parameters from `CafeProvider`.
- Set routing boundaries using tenant cookies or context lookups.

### Milestone 4: Multi-Role Schema Expansion & KDS (P2)
- Migrate DB constraints with expanded roles.
- Create new dashboard view configurations for KDS and Counter Cashier systems.
