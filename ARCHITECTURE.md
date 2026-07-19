# System Overview

OrderRail is built as a client-first, multi-role web application designed to coordinate café and restaurant operations. The system is split into three primary user-facing subsystems backed by a single Serverless/Backend-as-a-Service (BaaS) layout:
1. **Diner Interface (Customer)**: A zero-login, mobile-responsive web portal accessed via table-specific QR codes, allowing patrons to browse menus, manage shopping carts, submit orders, track order states, and request physical table service (water, waiter, bill).
2. **Staff Console (Operations)**: A real-time, interactive Kanban dashboard where service and kitchen teams progress incoming orders, handle change reviews, and resolve table service requests.
3. **Owner Dashboard (Administration)**: A management portal for proprietors to configure café branding, edit menu items and categories, upload images, manage tables, provision staff credentials, and view sales performance metrics.
4. **Backend-as-a-Service (Supabase)**: Provides authentication services, PostgreSQL database storage, object asset storage, and Change Data Capture (CDC) PostgreSQL Realtime channel triggers.

---

# Architecture Principles

The design of OrderRail is guided by the following verified architectural principles:
- **Client-First SPA**: The entire application compiles into a single static bundle, executing routing, view composition, local state management, and api request building in the client browser.
- **Backend-as-a-Service (BaaS)**: Direct client-to-backend communication via the Supabase client SDK. The database layer handles authorization, row protection, and triggers directly, reducing middle-tier complexity.
- **QR-First Context**: Diners scan a QR code to resolve their physical location. The application matches route parameters to table UUIDs and session contexts dynamically, establishing boundaries without authentication blocks.
- **Mobile-Responsive Ergonomics**: Visual components are optimized for single-hand touch operations, collapsing layouts and drawers naturally across mobile, tablet, and desktop screens.
- **Offline Resilience**: State preservation protocols protect shopper carts and checkouts, queueing actions locally during network losses and syncing them upon restoration.
- **Realtime Synchronization**: Real-time event channels sync order states and table calls between customer browsers and the staff dashboard instantly.

---

# High-Level Architecture

The flow of data and execution layers is structured as follows:

```
[ Customer / Staff / Owner Browsers ] (Client React SPA)
                 ↓
                 ↓ (REST HTTPS / WebSocket Realtime CDC)
                 ↓
    [ Supabase Client SDK Wrapper ]
                 ↓
                 ├─→ [ Auth Engine ] (Session persist, signup, claiming)
                 ├─→ [ Storage Buckets ] (`menu-images` public files)
                 └─→ [ Database Gateway (PostgreSQL API) ]
                                 ↓
                 ┌───────────────┴───────────────┐
                 ↓                               ↓
       [ Row-Level Security ]            [ Postgres Triggers ]
                 ↓                               ↓
       [ PostgreSQL Tables ]             [ Realtime CDC Channels ]
```

### Layer Responsibilities
- **Browser (React SPA)**: Executes page routing, local cart calculations, offline queue serialization, UI transitions, and Realtime event handling.
- **Supabase SDK**: Wraps authentication tokens, negotiates WebSockets, resolves cache queries, and processes database operations over HTTPS REST.
- **PostgreSQL Database**: Serves as the single source of truth, enforcing data integrity, executing RPC operations, and evaluating Row-Level Security (RLS) configurations to secure multi-tenant data.
- **Supabase Storage**: Hosts uploaded menu thumbnail images under strict public read and authenticated owner write permissions.
- **Realtime CDC**: Monitors PostgreSQL write logs (`INSERT`, `UPDATE`, `DELETE`) on target tables, pushing structural diffs directly to connected clients via active WebSockets.

---

# Repository Structure

The primary directory layout is organized as follows:
- **`docs/`**: Holds developer guides, audit reports, and regression checklist documents (e.g. `INSTALLATION.md`, `PRODUCT_REGRESSION_AUDIT.md`).
- **`public/`**: Static browser assets including `favicon.svg` and the PWA config `manifest.webmanifest`.
- **`src/`**: React application code.
  - **`components/`**: Modular layout sections. Split into role contexts (e.g. `customer/`) and shadcn-based UI primitives (e.g. `ui/`).
  - **`config/`**: Shared variables including default café slugs, currencies, and cooldown timers (`app.ts`).
  - **`integrations/`**: API adapters, primarily containing the Supabase client initialization wrapper and generated database TypeScript definitions.
  - **`layouts/`**: Role-based routing shells that guard access and inject state providers (`TableLayout`, `StaffLayout`, `OwnerLayout`).
  - **`lib/`**: Business logic helpers. Houses global Auth, Cart, and Cafe Context providers, mathematical utilities, and the offline queue module.
  - **`pages/`**: Primary page views categorized by role folders (`owner/`, `staff/`, `table/`).
  - **`App.tsx`**: Main entry route configuration mapping paths to nested layouts and elements.
- **`supabase/`**: Local database codebase.
  - **`migrations/`**: Version-controlled PostgreSQL schemas, table definitions, RLS rules, and DB triggers.
  - **`seed.sql`**: Automated query scripts setup to provision the default café context and tables.

---

# Application Layers

OrderRail is structured into five distinct operational layers:
1. **Presentation Layer**: React components and pages. Pages consume layout boundaries (e.g. `OwnerLayout`) and trigger child components (e.g. `CartView`). Styling is handled via Tailwind CSS utility classes and Radix UI primitives.
2. **Business Logic Layer**: React Context providers (`auth.tsx`, `cart.tsx`, `cafe.tsx`) managing shared application states, session life cycles, and cart item calculations.
3. **Data Access Layer**: Supabase Client wrapper (`client.ts`) and database helper definitions (`db.ts`). Connects client operations to backend endpoints and parses database responses.
4. **Infrastructure Layer**: Vercel (static web hosting and client routing rewrites) and Supabase BaaS (database, auth, realtime channels, storage buckets).
5. **Shared Utilities**: Common format helpers (e.g. `formatMoney` for pricing conversions) and DOM class merge utilities (`cn`).

---

# Routing Architecture

Application routing is driven by React Router DOM. It maps hierarchical URLs to nested layout shells:

```
                  [ BrowserRouter ]
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
     [ / ] (Public)   [ /staff/login ]   [ /owner ] (OwnerLayout)
                          │                ├── index.tsx (Analytics)
                          │                ├── menu.tsx
                          │                └── settings.tsx
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
   [ /t/:tableId ] (TableLayout)     [ /staff ] (StaffLayout)
         ├── index.tsx (Menu)              └── index.tsx (Kanban)
         ├── cart.tsx
         └── order/:orderId
```

### Route Protections & Roles
- **Public Routes**: Pages like the Landing Page (`/`) and Staff Login (`/staff/login`) require no authentication.
- **Customer Routes (`/t/:tableId/*`)**: Wrapped by `TableLayout` which resolves table validity and provisions the specific `CartProvider` context based on the `:tableId` parameter.
- **Staff Dashboard (`/staff/*`)**: Protected by `StaffLayout`. Validates that an active user holds either the `"staff"` or `"owner"` role.
- **Owner Dashboard (`/owner/*`)**: Protected by `OwnerLayout`. Restricts entry exclusively to users possessing the `"owner"` role.

---

# Authentication & Authorization

Authentication is managed via Supabase Auth:
- **Staff/Owner Login**: Managed through custom email/password authentication (`signInWithPassword`, `signUp`) or OAuth provider integrations (Google).
- **Session Handling**: Authentication sessions are stored in browser storage (`localStorage`) and automatically refreshed using Supabase's auto-refresh tokens.
- **Authorization & Role Verification**: Roles are read from the database table `public.user_roles` linking user IDs to cafe IDs and roles (`owner` or `staff`). The frontend evaluates these roles using the `hasRole()` utility, while the backend database enforces access using Row-Level Security (RLS) policies.
- **Customer Access**: Customers do not authenticate. Instead, they check into table routes (`/t/:tableId`) which verify the active table UUID. Checkouts link orders to a unique client-side `session_id` to establish dining boundaries.
- **Demo Mode Authentication**: Users can register an account on the login page and trigger the PostgreSQL RPC `claim_demo_role()`, which writes a staff or owner privilege record for the user under the default demo café slug (`"orderrail"`).

---

# State Management

State in OrderRail is split by lifecycle and caching scopes:
- **React Context Providers**: Used for long-term global state.
  - `AuthProvider`: Stores active user sessions and loaded security roles.
  - `CafeContext`: Resolves and stores café branding properties on initialization.
  - `CartProvider`: Manages the line items, quantities, and preparation notes for a customer's cart, persisting state to `localStorage` key names configured per table ID.
- **TanStack React Query**: Used for server cache management. Handles data synchronization, stale caching windows (defaulting to 30 seconds), loading states, and page queries for menus, tables, and analytics.
- **Component State**: Handles temporary UI state (e.g. active tabs, modal openings, search filter strings, and color-flash triggers).
- **Persistence Layer**: Serializes checkout payloads to `localStorage` under `orderrail.order_queue` when network connectivity is lost.

---

# Data Flow

### Customer Order Flow
1. Customer enters table menu and adds items to the persistent `useCart` state.
2. Customer submits cart checkout. The system checks browser connectivity.
3. If online, the payload is pushed directly to Supabase (`orders` and `order_items` tables). If offline, the payload is appended to the local storage queue.
4. On success, the frontend clears the cart and redirects the diner to the live tracking page.

### Realtime Operational Updates
- **Staff Dashboard**: Opens a persistent WebSocket CDC channel (`staff-<cafeId>`) filtered by `cafe_id`. The dashboard listens for write events on `orders`, `order_items`, `service_requests`, and `tables`.
- **UI Interaction**: Upon receiving database updates, the dashboard triggers React Query cache invalidations, pulling fresh data, flashing changed order cards, and automatically scrolling alerts for staff.

### Offline Synchronization Flow
```
[ Device Disconnected ] ─→ Submit Order ─→ Save to Local Queue (localStorage)
                                              │
                                              ▼ (Wait for 'online' event)
[ Device Reconnected ]  ─→ flushQueue()  ─→ DB Insert (Ignores 23505 duplicate errors)
                                              │
                                              ▼ (Success)
                                          Clear Queue
```

---

# Database Integration

- **Supabase Client SDK**: Loaded in `@/integrations/supabase/client.ts`. It acts as the database gateway, passing JWT headers automatically on every query.
- **Queries & Mutations**: Executed directly against database views and tables via REST filters (e.g. `.select()`, `.eq()`, `.insert()`).
- **Object Storage**: The `menu-images` storage bucket holds uploaded menu thumbnails. Uploads are placed under folder paths named after the café ID.
- **Row-Level Security (RLS)**:
  - Customers hold read-only permissions for menus, categories, and tables. They hold insert-only access for orders and service requests.
  - Owners and Staff hold read-write access to table states, orders, and service requests matching their café ID.
  - Owners hold absolute read-write access to menus, settings, and role directories matching their café ID.

---

# Offline Architecture

- **Offline Queue**: Serializes complete order objects (including UUIDs, café IDs, table references, notes, and nested item arrays) into the `localStorage` key `orderrail.order_queue`.
- **Reconnect Behavior**: The app adds an event listener on the window `online` event. When triggered, it fires `flushQueue()`, pushing queued transactions sequentially.
- **Conflict Handling**: The database push checks if an order or items already exist before attempting insertions. If insertion returns database duplicate code `23505`, it resolves as successful and removes the item from the queue, preventing duplicate checkouts.
- **Limitations**: The queue uses browser `localStorage` which is subject to a 5MB storage limit and operates synchronously on the UI thread.

---

# Demo vs Production Architecture

- **Demo Mode**:
  - Automatically targets a single default café record with slug `"orderrail"`.
  - Integrates an RPC-based claiming mechanism (`claim_demo_role()`) allowing anyone signed in to assign themselves staff or owner privileges.
  - Security policies are open enough to allow user-driven role provisioning.
- **Production Mode**:
  - Resolves café identities using unique slugs or custom domain configurations.
  - Roles must be explicitly invited by owners through email registration hooks, preventing unauthorized privilege escalation.
  - Strict RLS policies restrict operations strictly to team members registered for that specific cafe ID.

---

# Security Architecture

- **Role Protection**: Nested route layouts (guards) check active role arrays. Unauthorized route hits trigger immediate redirects (e.g. back to `/staff/login`).
- **Database RLS Policies**: Configured in migrations (e.g., `20260712163000_staff_menu_permissions.sql`). Enforces data authorization rules at the SQL engine level:
  - Checks user tokens against the `user_roles` directory to confirm permissions before returning table contents.
  - Resolves cafe-to-user mappings to ensure staff members cannot read or write data belonging to another café tenant.

---

# Deployment Architecture

- **Frontend Hosting**: Deployed on **Vercel** as a static single-page application. Rewrites map all sub-routes back to `index.html` to support client-side browser routing.
- **Backend & Database**: Hosted on the **Supabase Cloud** platform. Database structures, RLS policies, and triggers are managed via local migrations pushed using the Supabase CLI.
- **Object Storage**: Images are stored in Supabase Storage.
- **Environment Variables**:
  - `VITE_SUPABASE_URL`: Public endpoint for the Supabase backend.
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: Anon API key for client authentication.

---

# Scalability Considerations

- **Single-Tenant Database**: While the schema uses `cafe_id` fields, the client application queries a single hardcoded slug (`"orderrail"`) on load, limiting immediate out-of-the-box multi-tenant routing without code modifications.
- **Realtime Channel Limits**: Multi-page operations establish separate WebSocket channels. High-frequency café traffic could trigger connection bottlenecks on free-tier Supabase plans.
- **Local Storage Limitations**: Storing carts and queues locally operates on a 5MB maximum threshold. Highly complex catalog selections or bulk orders could exceed storage allotments on edge devices.

---

# Architectural Decisions

- **Single-Page Application (SPA)**: Chosen for rapid page transitions, fluid mobile animations, and the ability to package the static shell for direct deployment or local device caching.
- **Supabase BaaS**: Selected to reduce backend engineering overhead, using built-in authentication, storage buckets, and PostgreSQL CDC channels out-of-the-box.
- **TanStack React Query**: Utilized to manage client data caches, coordinate refetches, handle stale cache intervals, and invalidate outdated server states.
- **Realtime CDC Channels**: Integrated to replace expensive HTTP polling architectures with low-latency WebSockets, ensuring staff dashboards update immediately.
- **Offline Storage Queue**: Implemented to safeguard café revenue against unstable customer network connections.

---

# Known Limitations

- **Hardcoded Default Tenant**: The database configuration is multi-tenant, but the frontend context is hardcoded to load the café matching the `"orderrail"` slug.
- **Synchronous Queue storage**: Using `localStorage` blocks the main UI thread during serialization and is subject to strict 5MB browser limits.
- **No Global Error Isolation**: The application lacks global React Error Boundaries, meaning an unhandled runtime error can crash the client UI into a blank white screen.

---

# Future Architectural Evolution

- **Dynamic Multi-Tenant Domain Mapping**: Transitioning the café context resolver from a hardcoded config slug to dynamic hostname or URL slug mapping, enabling true multi-venue hosting on a single codebase.
- **Service Worker (PWA) Integration**: Registering a background service worker to pre-cache application static shells, enabling full standalone device installations and caching.
- **IndexedDB Queue Migration**: Replacing `localStorage` with `IndexedDB` for order queuing to support asynchronous execution and remove size boundaries.
- **Global Error Boundaries**: Wrapping route layouts in boundary handlers to isolate crashes and show interactive recovery views.

---

# Evidence

The primary implementation files used to analyze and verify this system design:
- [src/App.tsx](src/App.tsx)
- [src/config/app.ts](src/config/app.ts)
- [src/lib/auth.tsx](src/lib/auth.tsx)
- [src/lib/cart.tsx](src/lib/cart.tsx)
- [src/lib/cafe.tsx](src/lib/cafe.tsx)
- [src/lib/orderQueue.ts](src/lib/orderQueue.ts)
- [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts)
- [src/pages/staff/StaffLoginPage.tsx](src/pages/staff/StaffLoginPage.tsx)
- [src/pages/staff/StaffDashboardPage.tsx](src/pages/staff/StaffDashboardPage.tsx)
- [supabase/migrations/20260703170026_f12a71f4-c6d4-4301-beff-c0c1ead30bfb.sql](supabase/migrations/20260703170026_f12a71f4-c6d4-4301-beff-c0c1ead30bfb.sql)
- [supabase/migrations/20260712163000_staff_menu_permissions.sql](supabase/migrations/20260712163000_staff_menu_permissions.sql)
- [vercel.json](vercel.json)
