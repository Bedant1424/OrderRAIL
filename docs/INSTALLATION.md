# OrderRail Installation & Setup Guide

This document outlines the complete step-by-step process for setting up and running **OrderRail** on a fresh installation.

---

## Prerequisites

Before setting up the project, make sure you have the following software installed on your machine:
1. **Node.js** (v18 or higher is recommended)
2. **npm** (comes packaged with Node.js)
3. **Supabase CLI** (used to manage database schemas and migrations)

---

## Installation & Setup Steps

Follow these steps to initialize the project and link it to your Supabase project backend:

### Step 1: Install Node Dependencies
Open your terminal in the project root directory and run:
```bash
npm install
```

### Step 2: Log in to Supabase CLI
Authenticate your local Supabase command-line tool:
```bash
supabase login
```
*This command will open a browser window to authenticate. Alternatively, you can supply your Personal Access Token when prompted.*

### Step 3: Link your Project
Link your local repository to your remote Supabase project:
```bash
supabase link --project-ref <your-project-ref>
```
*Replace `<your-project-ref>` with the reference ID of your Supabase project (found in your Supabase dashboard settings). You will be prompted to enter your database password.*

### Step 4: Push the Database Schema
Apply all the PostgreSQL migrations to configure the remote database schemas, RLS policies, triggers, and functions:
```bash
supabase db push
```

### Step 5: Execute the Bootstrap Seed Script
To allow the application to function immediately, run the idempotent bootstrap script to initialize the default cafe record:
```bash
supabase db query --linked -f supabase/seed.sql
```

### Step 6: Start the Development Server
Run the local Vite development server:
```bash
npm run dev
```

### Step 7: Open the Application
Navigate to the local address displayed in your console (usually `http://localhost:8080/` or `http://localhost:8081/`) to view the application.

---

## System Initialization States

### Fresh Installation State
* **Database:** The database schema is fully created (tables, functions, RLS, triggers).
* **Default Cafe:** A single default cafe record is initialized with:
  * `name`: `"OrderRail"`
  * `slug`: `"orderrail"`
  * `currency`: `"INR"`
  * Seeding also automatically provisions **10 default tables** (labeled "1" to "10") with 4 seats each.
* **Users:** No users exist initially in the database.
* **Onboarding Owner/Staff:** The first user to access the application must sign up via the `/staff/login` page and click **Claim Owner** or **Claim Staff** to assign themselves control over the newly created cafe.

### Existing Installation State
* The bootstrap script is **idempotent**. Running the seed command again will detect that a cafe with the slug `"orderrail"` already exists, and that tables "1" through "10" exist, exiting safely without making any duplicate entries or database updates.
