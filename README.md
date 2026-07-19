# OrderRail
### The contactless ordering and service workflow platform for modern cafes and restaurants.

---

## 🚀 Live Demo
Access the live production instance at: **[order-rail.vercel.app](https://order-rail.vercel.app)**  
*Demo QR codes for testing customer flows are available directly on the landing page.*

---

## 📸 Screenshots
*(Placeholders for future UI screenshots)*
- **Customer Menu Interface**: `[Customer Menu Screenshot Placeholder]`
- **Staff Kanban Board**: `[Staff Kanban Board Screenshot Placeholder]`
- **Owner Analytics Dashboard**: `[Owner Analytics Screenshot Placeholder]`

---

## 🎯 Project Goals
OrderRail aims to optimize the dining experience and simplify hospitality workflows. The project focuses on:
- **Reducing Customer Friction**: Letting diners scan, browse, order, and pay/request help instantly without waiting.
- **Improving Service Coordination**: Dispatching real-time notifications to staff and structuring kitchen workflows on a live Kanban console.
- **Empowering Proprietors**: Providing independent cafe owners with simple tools to manage menus, print table QRs, and audit business performance.

---

## 📋 Features

### Ordering & Checkout
- **QR-Code Table Context**: Table-specific QR codes route customers directly to their active table menu.
- **Frictionless Shopping Cart**: Local cart persistence keeps orders safe across browser reloads.
- **Offline Resilience**: Automatically queues checkouts if network connection is lost, syncing them once online.

### Menu & Catalog Cataloging
- **Interactive Menu Browser**: Easy filtering of catalog items by category and dietary flags (Veg, Non-veg, Egg).
- **Comprehensive Menu Editor**: Owner options to add/edit/delete categories and menu items, toggle availability, set prices, and upload image thumbnails.

### Real-Time Operations & Tracking
- **Live Kanban Console**: Interactive kitchen board for staff to track order progress (Pending, Preparing, Ready, Served).
- **Service Request Hub**: One-tap customer requests (water, waiter, or bill) delivered instantly to staff dashboard.
- **Customer Tracking Timeline**: Real-time customer order updates showing kitchen progress from submission to service.

### Administration & Analytics
- **Table & QR Generator**: Simple UI to register tables, set seating limits, and print print-friendly QR layouts.
- **Branding & Cafe Configuration**: Customizable shop settings including cafe details, contacts, and currency.
- **Staff Management**: Owner capabilities to invite, view, or delegate roles to staff members.
- **Diner Feedback Loop**: Rating and comment system for customers with an owner dashboard to view historical reviews.
- **Business Performance Analytics**: High-level reporting on total sales revenue, order counts, and overall customer satisfaction.

---

## 🛠️ Technology Stack

### Core
- **React 18** (TypeScript)
- **Vite** (Build Tool and Development Server)

### Frontend
- **Routing**: React Router DOM (v6)
- **Styling**: Tailwind CSS
- **Components**: Radix UI Primitives, Framer Motion (Animations), Lucide React (Icons)
- **Client Caching**: TanStack React Query

### Backend
- **Platform**: Supabase
- **Database**: PostgreSQL (with Row-Level Security policies)
- **File Storage**: Supabase Storage
- **Subscription Services**: Supabase Realtime Channels

### Infrastructure
- **Hosting**: Vercel

### Developer Tools
- **CLI**: Supabase CLI (database migrations, local seeding)
- **Testing**: Vitest, React Testing Library
- **Linting**: ESLint, TypeScript `tsc`

---

## 📁 Project Structure

```
orderrail/
├── docs/                     # Documentation and audit logs
│   ├── INSTALLATION.md       # Onboarding instructions
│   ├── NOTIFICATION_AUDIT.md # Service alert design reviews
│   └── *_REGRESSION_AUDIT.md # Sprint regression checklists
├── public/                   # Static public assets and web manifest
├── src/                      # Source React application
│   ├── components/           # Component library (customer flow, UI elements)
│   ├── hooks/                # Global React hooks
│   ├── integrations/         # API clients (Supabase configuration)
│   ├── layouts/              # Route layouts (Table, Staff, Owner)
│   ├── lib/                  # Application contexts and helper modules
│   └── pages/                # App pages (categorized by role)
├── supabase/                 # Database configurations
│   ├── migrations/           # PostgreSQL migrations
│   └── seed.sql              # Core database seeding query
├── vercel.json               # SPA routing rewrite configurations
└── package.json              # Script and package dependencies
```

---

## 📖 Documentation
- **[Installation Guide](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/docs/INSTALLATION.md)** (Available)
- **[Development Workflow](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/DEVELOPMENT_WORKFLOW.md)** (Available)
- **[Architecture Guide](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/architecture_documentation.md)** (Available)
- **[Production Readiness Audit](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/production_readiness_audit.md)** (Available)
- **System Architecture (ARCHITECTURE.md)** (Planned)
- **Deployment Process (DEPLOYMENT.md)** (Planned)
- **Project Roadmap (ROADMAP.md)** (Planned)
- **Database Schema (DATABASE.md)** (Planned)

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm
- Supabase CLI

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

### Environment Setup
1. Create a `.env` file in the root:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   ```
2. Link your local project to Supabase:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
3. Push migrations and seed data:
   ```bash
   supabase db push
   supabase db query --linked -f supabase/seed.sql
   ```

### Running Locally
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

---

## ⚙️ Environment Variables

- `VITE_SUPABASE_URL`: The Supabase API endpoint.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: The public API token for Supabase client interactions.

---

## 📐 Architecture Overview

OrderRail is built as a client-side Single Page Application (SPA) that communicates directly with a Supabase Backend-as-a-Service. Real-time updates on the staff Kanban board and customer notifications are powered by Supabase Realtime Channels. User state is persisted across pages using React Context Providers, and client-side data queries are cached via TanStack React Query.

*For detailed data flow maps and database structure designs, please refer to the [Architecture Guide](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/architecture_documentation.md) or the planned `ARCHITECTURE.md`.*

---

## 🚢 Deployment

The application frontend is hosted on **Vercel** with continuous deployment (CD) integrated with the main branch. Re-routing rewrite rules are configured in `vercel.json` to map all sub-routes to `index.html`. Database schemas are updated remotely using the Supabase CLI.

*For a step-by-step deployment guide, please refer to the planned `DEPLOYMENT.md`.*

---

## 📈 Current Status

OrderRail is in active pre-production development. The core customer ordering, staff Kanban workflow, and owner settings dashboards are fully functional and verified. Work is currently focused on enhancing network performance, offline queue reliability, and real-time service alert synchronization in preparation for the initial restaurant launch.

---

## 🗺️ Roadmap

Milestones and upcoming feature additions are tracked in the planned `ROADMAP.md`.

---

## 📄 License

Copyright (c) 2026 OrderRail. All rights reserved.  
Licensed under the MIT License (or custom license placeholder).
