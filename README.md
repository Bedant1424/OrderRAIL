# OrderRail

OrderRail is an interactive digital menu, ordering, and service coordination platform built for cafes and restaurants. It streamlines operations by enabling customers to scan table-specific QR codes, browse menus, order items, and request staff assistance directly from their mobile web browsers.

---

## Project Overview

- **What is OrderRail?**: OrderRail is an all-in-one digital ordering and workflow management platform for hospitality venues.
- **What problem does it solve?**: It removes friction from dining room operations by reducing table service delays, automating customer request dispatching, and providing a real-time order-tracking pipeline for staff and analytics for owners.
- **Who is it built for?**:
  - **Customers**: Diners scan QR codes to browse, order, and request help immediately without waiting for a waiter.
  - **Staff**: Waiters and kitchen staff track orders on a real-time Kanban board and handle service requests instantly.
  - **Owners**: Cafe owners manage menu items, print table QRs, assign staff, view client reviews, and audit sales performance.

---

## Features

### Customer Flow
- **QR-Code Table Context**: Table-specific QR routes automatically set the table number and seats without requiring login.
- **Interactive Menu Browser**: Category-based menu filtering with search and dietary flags (Veg/Non-Veg/Egg).
- **Persistent Local Cart**: Custom cart state saved in `localStorage` to keep items safe across accidental page reloads.
- **Real-Time Order Tracking**: Dynamic timeline showing status transitions from `pending` -> `preparing` -> `ready` -> `served`.
- **"Call Staff" Service Request**: Direct alerts for water, waiter, or the bill.
- **Diner Feedback**: Integrated review drawer to submit star ratings and comments on completed orders.
- **Offline Resilient Queue**: Safely serializes checkouts offline to `localStorage` and automatically syncs them when connection returns.

### Staff Dashboard
- **Kanban Order Console**: Real-time column boards to accept and progress order states.
- **Service Request Banner**: Dynamic notifications panel for immediate water/waiter/bill table alerts.
- **One-Tap Actions**: Single-tap options to resolve customer calls and advance kitchen orders.

### Owner Administration
- **Menu Editor**: Manage categories, prices (stored in cents), availability status, and upload thumbnail photos.
- **Table Configuration**: Add tables, set capacity limits, and print table-specific QR sheets.
- **Branding & Settings**: Customize cafe profile configurations (name, phone, currency, address, and Google Review URL).
- **Team Management**: Add, view, or invite new staff members and owners via email.
- **Review Log**: Direct dashboard to monitor user feedback and historical ratings.
- **Sales Analytics**: High-level charts showing total revenue, order count, and customer satisfaction rating.

---

## Technology Stack

- **Frontend**:
  - **Framework**: React 18 + TypeScript (Vite bundler)
  - **Routing**: React Router DOM (v6)
  - **Styling**: Tailwind CSS, Radix UI primitives, Framer Motion (animations), Lucide React (icons)
  - **State & Data Caching**: TanStack React Query (@tanstack/react-query)
- **Backend / Database**:
  - **Platform**: Supabase
  - **Database**: PostgreSQL with Row-Level Security (RLS) policies
  - **Storage**: Supabase Storage (`menu-images` bucket)
  - **Realtime**: PostgreSQL Realtime CDC (Change Data Capture) channels
- **Tooling**:
  - **Database CLI**: Supabase CLI (schema migrations, local seeds)
  - **Testing**: Vitest + Testing Library
  - **Linting**: ESLint + TypeScript `tsc`

---

## Project Structure

```
orderrail/
├── docs/                     # Setup, regression reports, and audit logs
│   ├── INSTALLATION.md       # Local onboarding guidelines
│   ├── NOTIFICATION_AUDIT.md # Service request alert audits
│   └── *_REGRESSION_AUDIT.md # System regression check logs
├── public/                   # Static browser assets and manifest config
│   └── manifest.webmanifest  # Web app configurations
├── src/                      # Source React application
│   ├── components/           # Component libraries (customer views, UI primitives)
│   ├── hooks/                # Global React hooks
│   ├── integrations/         # Backend integrations
│   │   └── supabase/         # Supabase client initialize and types
│   ├── layouts/              # Multi-role route layouts (Table, Staff, Owner)
│   ├── lib/                  # App contexts (Auth, Cart, Cafe), offline queue, API modules
│   └── pages/                # App pages categorized by role (owner, staff, table)
│       └── Index.tsx         # Main landing demo page
├── supabase/                 # Supabase configuration files
│   ├── migrations/           # Database schema migrations
│   └── seed.sql              # Database setup seeding data
├── vercel.json               # SPA route rewrite definitions
└── package.json              # Build scripts and dependency configurations
```

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (bundled with Node.js)
- Supabase CLI

### Installation
1. Clone the repository and install npm packages:
   ```bash
   npm install
   ```

### Environment Setup
1. Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-publishable-key>
   ```

2. Link your local project to Supabase:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

3. Push the PostgreSQL migrations to your Supabase database:
   ```bash
   supabase db push
   ```

4. Run the seed script to initialize the `"orderrail"` cafe context:
   ```bash
   supabase db query --linked -f supabase/seed.sql
   ```

### Running Locally
1. Start the local Vite development server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:8080` in your web browser.

### Build and Production
To build the application for production, compile the static bundle:
```bash
npm run build
```
This generates optimized static files in the `/dist` directory, ready to be served.

---

## Environment Variables

- `VITE_SUPABASE_URL`: The API URL of your Supabase project (used by the client to query database endpoints).
- `VITE_SUPABASE_PUBLISHABLE_KEY`: The public anon API key of your Supabase project (authenticates public read/write queries from the client browser).

---

## Architecture Overview

OrderRail utilizes a client-side Single Page Application (SPA) model built on React and Vite. It connects directly to Supabase as its backend-as-a-service. 

Global states are managed by React Context Providers (for Authentication, Cart persistence, and Cafe details), while API data is fetched and cached using TanStack React Query. Realtime staff notifications and Kanban updates are established via PostgreSQL CDC channels using Supabase's Realtime SDK. 

Detailed system designs and flowcharts can be found in `architecture_documentation.md`. For structural updates, full configurations belong in `ARCHITECTURE.md` (which is planned but not currently in the repository).

---

## Deployment

The application is deployed continuously to **Vercel** with builds triggered automatically from the main git branch. 

Vercel deployment properties require a `vercel.json` rewrite configuration to route all client-side URL requests back to `/index.html` to prevent route reload 404 errors. Database structures are updated remotely through the Supabase CLI using `supabase db push`.

Full pipeline instructions belong in `DEPLOYMENT.md` (which is planned but not currently in the repository).

---

## Current Status

Based on the latest production audit:
- **Production Ready**: Core customer order flow, staff Kanban board, database RLS protection, offline sync queue, and table QR printing features.
- **Partially Implemented**:
  - *PWA Integration*: Predefined `manifest.webmanifest` exists, but there is no Service Worker registered to handle offline caching or native device installs.
  - *Analytics Filters*: Owner analytics charts render correctly, but date-range filters (e.g. today vs last 30 days) are not yet integrated.
- **Needs Improvement**:
  - *Accessibility*: Custom controls (like rating stars) need keyboard navigation support.
  - *Error Handling*: Missing a global React Error Boundary and central logging monitoring tool (like Sentry).

---

## Roadmap

Future feature milestones and launch tasks are tracked in `ROADMAP.md` (which is planned but not currently in the repository; milestone tasks are currently listed under `production_readiness_audit.md`).

---

## License

Copyright (c) 2026 OrderRail. All rights reserved.  
Licensed under the MIT License (or custom license placeholder).
