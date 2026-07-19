# Product Overview

- **What is OrderRail?**: OrderRail is an interactive, digital menu, ordering, and service coordination platform built specifically for modern hospitality venues. It bridges the gap between customer self-service and kitchen staff efficiency.
- **What problem does it solve?**: It addresses dining friction and service delays in hospitality environments. By allowing customers to self-order and trigger service calls directly from their browsers, it minimizes wait times. For the kitchen and front-of-house teams, it replaces paper tickets and disjointed communication with a real-time, interactive Kanban dashboard.
- **Why was it built?**: OrderRail was built to empower independent cafés, coffee shops, dessert bars, bubble tea shops, and mid-sized restaurants to run lean, automated operations with zero-friction onboarding, while keeping proprietors in control of their menus, staff, branding, and customer experience.

---

# Vision

OrderRail envisions a modern, data-driven, and highly coordinated restaurant operation environment. By transforming tables and service touchpoints into integrated nodes, the platform seeks to establish an operational standard for independent dining establishments—empowering floor staff, kitchen teams, and management with real-time workflow coordination, sales analytics, and service automation that eliminates bottlenecks and maximizes floor throughput.

---

# Mission

To synchronize diner experience and kitchen workflows into a single operational interface, accelerating table turnover, reducing staff stress, and elevating service quality.

---

# Why OrderRail?

OrderRail bridges the operational gap between diner self-service and back-of-house kitchen coordination. The product delivers value through its core, enduring design principles:
- **QR-First Customer Experience**: Every table is transformed into an interactive digital endpoint, providing instant diner check-in without manual staff setup.
- **Customer-First Simplicity**: Direct scanning bypasses sign-up screens, providing immediate menu interaction.
- **Real-Time Restaurant Operations**: Multi-role channels sync customer cart edits, order status tracking, and floor service requests directly to kitchen Kanban boards and staff notification counters.
- **Unified Workflows**: Connects diners, waitstaff, and kitchen cooks on a single, synchronized data loop to eliminate miscommunication.
- **Mobile-First Interface**: Optimized for touch-targets and mobile viewports, ensuring floor staff can manage orders on-the-go.
- **Independent Branding & Ownership**: Cafe owners preserve their branding identity, menu structures, and direct client review channels without intermediary aggregators.

---

# Product Pillars

The guiding principles that influence long-term product decisions:
- **Customer-First Simplicity**:
  - No app installation or downloads required.
  - No customer account creation or registration steps.
  - Direct QR scan takes the user straight to active ordering menus.
  - Minimal navigation hierarchy with clean layout structures.
  - Fast checkout process requiring minimal user taps.
  - Predictable, intuitive dining and user interface patterns.
- **Operational Synchronization**: All roles (Customer, Staff, Owner) must operate on unified, real-time data to prevent delays or mismatching information.
- **Frictionless Engagement**: User interactions—whether checking out a cart or resolving service tickets—must require minimal steps and no overhead setup.
- **Workforce Ergonomics**: Staff workflows must be optimized for fast-paced, high-stress kitchen environments with quick touch targets and actionable priorities.
- **Proprietor Empowerment**: Provide independent venues with enterprise-grade operational controls and analytics without complex enterprise IT setups.

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

# Product Capabilities

### Customer Experience
- **[Implemented]** **Table-Context Self-Check-in**: Automatically configures table details via QR route parameters.
- **[Implemented]** **Dietary-Filterable Menu**: Dynamic categorization with Veg, Non-Veg, and Egg indicators.
- **[Implemented]** **Local Cart Persistence**: Cart items survive accidental page reloads.
- **[Implemented]** **Service Request Portal ("Call Staff")**: Fast-action triggers to request water, waiter, or the bill.
- **[Implemented]** **Real-Time Order Tracking**: Dynamic visual timeline tracking order statuses (`pending` -> `preparing` -> `ready` -> `served`).
- **[Implemented]** **Feedback & Rating System**: Inline star rating and comments upon order completion.
- **[Implemented]** **Offline Order Resilience**: Client-side storage serialization to queue checkout requests when connection fails.

### Staff Operations
- **[Implemented]** **Real-Time Kanban console**: Visual columns tracking `pending`, `preparing`, and `ready` orders.
- **[Implemented]** **Service Request Banner**: Scrollable top strip flashing new alerts and letting staff acknowledge or resolve water/waiter/bill requests.
- **[Implemented]** **One-Tap Actions**: Card-level direct order cancellation and quick-resolve buttons.
- **[Implemented]** **Order Details Drawer**: Expandable workspace presenting itemized receipts, customer notes, priority meters, and historical event logs.
- **[Implemented]** **Customer Change Review Dialog**: Visual diff comparison showing customer-modified order counts, helping staff sync changes in the kitchen.
- **[Implemented]** **Table Occupancy Grid**: Visual tracker of occupied vs free tables, with manual override controls.
- **[Implemented]** **Real-Time Workspace Refresh**: Green, blue, amber, and red color-flash animations on updates.

### Owner Management
- **[Implemented]** **Menu & Category Editor**: Options to add categories, menu items, prices, veg/non-veg tags, and toggle availability.
- **[Implemented]** **Storage Thumbnails**: Direct upload of menu item photos to Supabase Storage.
- **[Implemented]** **Table QR Code Manager**: Register physical tables, set seating configurations, and export print-ready QR templates.
- **[Implemented]** **Cafe Branding Editor**: Customization dashboard for tagline, logo/images, address, phone number, currency, and Google Review redirect URL.
- **[Implemented]** **Team Management**: Staff invite mechanism using email-based role assignments.
- **[Partially Implemented]** **Historical Sales Analytics**: Performance reports tracking sales totals, order counts, and client review scores (basic metrics are functional, but date-range filtering is not yet implemented).

### Platform Capabilities
- **[Implemented]** **Role-Based Frontend Guards**: Authorization screens restricting dashboard access to owners and staff.
- **[Implemented]** **Real-Time CDC Datachannel**: Direct PostgreSQL database sync to update front-end states.

### Planned Platform Evolution
- **[Partially Implemented]** **Progressive Web App (PWA)**: App manifest is configured, but active local static asset caching is not yet implemented.
- **[Planned]** **POS Integrations**: Linking OrderRail to third-party cash register systems.
- **[Planned]** **Digital Payment Processing**: In-app checkout payment gateways (credit card, UPI, Apple Pay).
- **[Planned]** **Stock Inventory Control**: Auto-depletion of menu items based on exact stock counts.
- **[Planned]** **Loyalty & Rewards Program**: Diner points and coupon codes.

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

### In Scope
- Table-context routing and diner check-in.
- Real-time orders and physical service request coordination.
- Interactive multi-role Kanban dashboard and workflow tracking.
- Local cart state persistence and offline queue resilience.
- Self-provisioned menu items, category control, and table setup.
- Dining review collections and basic performance analytics.

### Out of Scope / Currently Excluded
- Serving as a full legacy POS (Point-of-Sale) cash-register replacement (currently designed to complement existing restaurant workflows, though future integrations or expanded operational capabilities remain possible).
- Built-in digital payment gateways (payments are processed offline/in-person today).
- Ingredient-level inventory tracking and automatic raw stock replenishment.
- Guest loyalty points, customer profile database logs, and discount coupon codes.
- Off-premise third-party delivery service aggregations (UberEats, DoorDash) or takeout flows.
- Managing vendor procurement, payroll tracking, or employee shift scheduling.

---

# Current Product Status

OrderRail is in a pre-production/stable release-candidate phase. The core dine-in ordering lifecycle is fully operational. Front-of-house (customer order, tracking, calling staff) and back-of-house (Kanban columns, detail drawer, change-reviews, and occupancy controls) sync automatically via live database change datachannels. Owners can fully control menus, branding, and table printing. Development is focused on performance optimization and preparing for initial on-site café testing.

---

# Future Direction

### Near-Term Evolution
- **Extended Offline Synchronization**: Enhancements to the local cart and sync queue to handle persistent, multi-order recovery loops during long Wi-Fi disconnects.
- **Time-Filterable Auditing**: Adding dashboard filters to analytics charts to calculate revenues and orders for specific operational shifts (e.g. today vs this week).
- **Static App Shell Caching**: Registering background caching procedures to enable standalone PWA installs for staff tablets and customer shortcuts.

### Long-Term Evolution
- **Legacy POS Integrations**: Developing adapters to connect OrderRail with existing restaurant registers, sync checkouts, and align kitchen printer logs.
- **Built-in Digital Payments**: Integrating localized payment gateway platforms to support instant, contactless card or mobile wallet settlements at the table.
- **Ingredient Inventory Tracking**: Building automated menu toggles that disable specific items dynamically as kitchen stock levels deplete.

---

# Success Criteria

OrderRail evaluates product maturity and rollout success based on target business and operational outcomes:
- **Reduce Customer Waiting Time**: Minimize the elapsed time between table seating, menu retrieval, and checkout submission.
- **Reduce Waiter Interruptions**: Deflect routine service calls (asking for menus, water, bills) away from physical waiter checks, freeing floor staff for high-touch tasks.
- **Improve Kitchen Coordination**: Streamline the preparation lifecycle through clear Kanban transitions, reducing double-preparation or missed orders.
- **Improve Table Turnover**: Accelerate order-taking and bill resolution to increase dining floor throughput.
- **Improve Owner Visibility**: Deliver direct performance data regarding best-selling categories, active staff members, and real-time client feedback.
- **Deliver Predictable Dining Experiences**: Provide a uniform, reliable digital portal that operates consistently across visits.

---

# Glossary

- **Cafe**: The business entity tenant (e.g., "OrderRail") possessing branding details, menus, tables, and staff.
- **Table**: A physical dining spot defined by a table label/number and seating capacity.
- **QR (Quick Response) Code**: A table-specific scan code linking to the customer's route context.
- **Order**: A list of selected menu items, quantities, and preparation notes submitted by a diner.
- **Service Request**: A physical floor call triggered by a customer (requesting water, a waiter, or the bill).
- **Dining Session**: The duration a customer spends at a table, starting from QR scan/browse to order checkout, service, and table clearance.
- **Menu Category**: A catalog collection (e.g. "Warm Bowls") grouping similar items together.
