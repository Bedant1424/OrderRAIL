# Product Overview

- **What is OrderRail?**: OrderRail is an interactive, digital menu, ordering, and service coordination platform built specifically for modern hospitality venues. It bridges the gap between customer self-service and kitchen staff efficiency.
- **What problem does it solve?**: It addresses dining friction and service delays in hospitality environments. By allowing customers to self-order and trigger service calls directly from their browsers, it minimizes wait times. For the kitchen and front-of-house teams, it replaces paper tickets and disjointed communication with a real-time, interactive Kanban dashboard.
- **Why was it built?**: OrderRail was built to empower independent cafés, coffee shops, dessert bars, bubble tea shops, and mid-sized restaurants to run lean, automated operations with zero-friction onboarding, while keeping proprietors in control of their menus, staff, branding, and customer experience.

---

# Vision

OrderRail envisions a fully integrated, hardware-light, and frictionless dining ecosystem. By turning every physical table into an interactive digital portal through simple QR codes, OrderRail aims to make premium restaurant automation accessible to every independent local establishment, enabling them to run ultra-lean operations, optimize staff efficiency, and maximize seat turnover without losing the human touch.

---

# Mission

To deliver a frictionless, real-time, and contactless ordering experience that coordinates kitchen workflows and simplifies cafe operations.

---

# Target Customers

OrderRail's Ideal Customer Profile (ICP) focuses on small-to-medium hospitality venues:
- **Independent Cafés & Bakeries**
- **Coffee Shops**
- **Dessert Cafés**
- **Bubble Tea Shops**
- **Restaurants (approximately 20–100 seats)**

*Note: Enterprise multi-location networks, large chain restaurants, and pub/bar environments are currently not part of the primary customer profile.*

---

# User Roles

### Customer
A diner seated at a physical table in the café. They interact with OrderRail using a mobile web browser on their own device, accessed by scanning a table-specific QR code.
- **Responsibilities**: Scan table QR, browse categories, filter by dietary preferences, manage a persistent shopping cart, submit orders, view kitchen progress in real-time, trigger service alerts, and leave star ratings/reviews.

### Staff
Kitchen team members or floor waiters responsible for preparing orders and resolving customer requests.
- **Responsibilities**: Monitor incoming orders, progress orders through preparation status channels (Pending $\rightarrow$ Preparing $\rightarrow$ Ready $\rightarrow$ Served), cancel invalid orders, review customer-submitted order modifications, and acknowledge/resolve table service requests.

### Owner
The business administrator who manages the establishment.
- **Responsibilities**: Configure café settings (branding tagline, contact details, currency, address, Google Review redirect URL), design menu catalogs (categories, menu items, pricing, veg/non-veg tags, images), manage table layouts, print QR codes, assign/invite staff, monitor customer feedback, and analyze sales performance metrics.

---

# Core Product Principles

- **Frictionless Onboarding**: No customer registration, authentication, or app downloads are required. Ordering is instantly available after scanning the table QR code.
- **QR-First Context**: Diners inherit their physical dining table layout (table number, seating limits) instantly upon entering the route context.
- **Real-Time Synchronicity**: Real-time notifications and instant Kanban updates keep kitchen and floor staff in perfect alignment without page reloads.
- **Operational Resilience**: Offline-first cart and order queuing ensure a spotty Wi-Fi connection doesn't drop a diner's checkout.
- **Mobile-Responsive Ergonomics**: The diner interface and staff alerts are optimized for touch target accessibility on smartphones and tablets.

---

# Product Capabilities

### Customer Experience
- **Table-Context Self-Check-in**: Automatically configures table details via QR route parameters. (**Implemented**)
- **Dietary-Filterable Menu**: Dynamic categorization with Veg, Non-Veg, and Egg indicators. (**Implemented**)
- **Local Cart Persistence**: Items and quantities survive accidental browser refreshes. (**Implemented**)
- **Service Request Portal ("Call Staff")**: Fast-action triggers to request water, waiter, or the bill. (**Implemented**)
- **Real-Time Order Tracking**: Dynamic visual timeline tracking order statuses (`pending` -> `preparing` -> `ready` -> `served`). (**Implemented**)
- **Feedback & Rating System**: Inline star rating and comments upon order completion. (**Implemented**)
- **Offline Order Resilience**: Client-side storage serialization to queue checkout requests when connection fails. (**Implemented**)

### Restaurant Operations
- **Real-Time Kanban console**: Visual columns tracking `pending`, `preparing`, and `ready` orders. (**Implemented**)
- **Service Request Banner**: Scrollable top strip flashing new alerts and letting staff acknowledge or resolve water/waiter/bill requests. (**Implemented**)
- **One-Tap Actions**: Card-level direct order cancellation and quick-resolve buttons. (**Implemented**)
- **Order Details Drawer**: Expandable workspace presenting itemized receipts, customer notes, priority meters, and historical event logs. (**Implemented**)
- **Customer Change Review Dialog**: Visual diff comparison showing customer-modified order counts, helping staff sync changes in the kitchen. (**Implemented**)
- **Table Occupancy Grid**: Visual tracker of occupied vs free tables, with manual override controls. (**Implemented**)
- **Real-Time Workspace Refresh**: Green, blue, amber, and red color-flash animations on updates. (**Implemented**)

### Owner Management
- **Menu & Category Editor**: Options to add categories, menu items, prices, veg/non-veg tags, and toggle availability. (**Implemented**)
- **Storage Thumbnails**: Direct upload of menu item photos to Supabase Storage. (**Implemented**)
- **Table QR Code Manager**: Register physical tables, set seating configurations, and export print-ready QR templates. (**Implemented**)
- **Cafe Branding Editor**: Customization dashboard for tagline, logo/images, address, phone number, currency, and Google Review redirect URL. (**Implemented**)
- **Team Management**: Staff invite mechanism using email-based role assignments. (**Implemented**)
- **Historical Sales Analytics**: Performance reports tracking sales totals, order counts, and client review scores. (**Partially Implemented** — *Note: Basic dashboard and metrics are functional, but date-range filtering options like today/7days/30days are currently not implemented.*)

### Platform Capabilities
- **Role-Based Frontend Guards**: Authorization screens restricting dashboard access to owners and staff. (**Implemented**)
- **Real-Time CDC Datachannel**: Direct PostgreSQL database sync to update front-end states. (**Implemented**)
- **PWA (Progressive Web App)**: App manifest configuration. (**Partially Implemented** — *Note: `manifest.webmanifest` exists, but there is no registered Service Worker to handle offline assets or enable standalone installation.*)
- **POS Integrations**: Linking OrderRail to third-party cash register systems. (**Planned**)
- **Digital Payment Processing**: In-app checkout payment gateways (credit card, UPI, Apple Pay). (**Planned**)
- **Stock Inventory Control**: Auto-depletion of menu items based on exact stock counts. (**Planned**)
- **Loyalty & Rewards Program**: Diner points and coupon codes. (**Planned**)

---

# Customer Journey

1. **Scanning**: The diner sits at a physical table and scans the custom QR code using their smartphone.
2. **Accessing**: The customer is directed to the table-specific menu web app (`/t/:tableId`). The table number and café context load automatically.
3. **Browsing**: The customer browses categories (e.g. Beverages, Desserts) and filters items by dietary preference.
4. **Selecting**: The customer adds items to their persistent cart, modifying quantities and adding custom preparation notes.
5. **Checking Out**: The customer submits their order. (If offline, it is queued; if online, it is instantly written to the database). The cart is cleared.
6. **Tracking**: The customer is redirected to the Live Tracking page, showing a visual timeline of their order's kitchen progress.
7. **Calling for Help**: During their meal, the customer can navigate to the "Call Staff" screen to request water, a waiter, or the bill.
8. **Feedback**: Once the order is marked served, the customer has the option to leave a star rating and feedback comment before leaving.

---

# Staff Journey

1. **Access**: Staff members log in through `/staff/login` using credentials or claim access in demo mode.
2. **Monitoring**: The staff dashboard displays a live Kanban grid of orders alongside active occupancy counters and a horizontal strip of service requests.
3. **Handling Service Calls**: As diners trigger "Call Staff" alerts, they flash in the top bar. A staff member acknowledges the request, performs the task (e.g. delivers water), and taps "Resolve".
4. **Kitchen Operations**: New orders appear in the "Incoming" column. Staff click the card to open the workspace drawer, read preparation notes, and tap "Start Preparing".
5. **Updating Orders**: Once prepared, staff tap "Mark Ready". Once delivered to the table, they tap "Mark Served".
6. **Handling Cancellations/Edits**: If a customer requests a cancellation, staff can tap the quick `✕` on the card. If a customer modifies an order, an "UPDATED" badge flashes, prompting the staff to review the item diff.
7. **Clearing Tables**: Once diners leave, staff open the Tables Grid, select the table, and click "Mark Table Free", which automatically clears any outstanding service requests.

---

# Owner Journey

1. **Account setup**: Owner logs in via `/staff/login`, claims owner status, and gains access to `/owner` routes.
2. **Branding & Settings**: The owner configures basic cafe details, contact phone, shop address, local currency, and links a Google Review URL.
3. **Catalog Creation**: Under Menu, the owner sets up category lists (e.g., "Espresso Bar") and populates them with menu items, pricing, dietary indicators, and uploads photo files.
4. **Layout Setup**: Under Tables, the owner registers physical table layouts and downloads bulk print-friendly QR cards.
5. **Staff Invites**: The owner enters staff emails to provision access roles to team members.
6. **Auditing**: The owner visits the Analytics screen to monitor total sales, check historical order logs, and review customer star ratings.

---

# Product Scope

### Included
- On-premise dine-in table QR ordering.
- Real-time orders and physical service request coordination.
- Interactive, multi-role Kanban and settings dashboards.
- Offline cart state and checkout recovery queue.
- Self-provisioned menu, table configuration, and table QR printing.
- Star ratings and customer text reviews collection.

### Not Included (or Unknown / Requires Confirmation)
- Native POS (Point-of-Sale) hardware/software replacement.
- Built-in digital payment processing (Stripe, UPI, PayPal, etc.).
- Auto-depleting ingredient inventory management.
- Diner loyalty points, coupon codes, and reward systems.
- Off-premise third-party delivery service integrations (UberEats, DoorDash).

---

# Current Product Status

OrderRail is in a pre-production/stable release-candidate phase. The core dine-in ordering lifecycle is fully operational. Front-of-house (customer order, tracking, calling staff) and back-of-house (Kanban columns, detail drawer, change-reviews, and occupancy controls) sync automatically via live database change datachannels. Owners can fully control menus, branding, and table printing. Development is focused on performance optimization, PWA service worker configuration, and date-range metrics before the first cafe deployment.

---

# Future Direction

- **PWA Service Worker integration**: Registering a service worker to enable app installation and offline static asset caching.
- **Analytics Filters**: Implementing date/time selectors (Today, Last 7 Days, Last 30 Days) to support daily cash reconciliation.
- **Global Error Handling**: Integrating top-level error boundary layouts and remote tracking (e.g. Sentry) to log production client crashes.

---

# Glossary

- **Cafe**: The business entity tenant (e.g., "OrderRail") possessing branding details, menus, tables, and staff.
- **Table**: A physical dining spot defined by a table label/number and seating capacity.
- **QR (Quick Response) Code**: A table-specific scan code linking to the customer's route context.
- **Order**: A list of selected menu items, quantities, and preparation notes submitted by a diner.
- **Service Request**: A physical floor call triggered by a customer (requesting water, a waiter, or the bill).
- **Dining Session**: The duration a customer spends at a table, starting from QR scan/browse to order checkout, service, and table clearance.
- **Menu Category**: A catalog collection (e.g. "Warm Bowls") grouping similar items together.
