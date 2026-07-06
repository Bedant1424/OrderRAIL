# Database Tables Seeding & Verification Report

This report summarizes the implementation of the verified database seed updates in `supabase/seed.sql` to provision default tables and restore the frontend UI actions on the landing page.

---

## 1. File Modification Log

### Files Modified
* **[supabase/seed.sql](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/supabase/seed.sql)**: Added variable declaration and a loops structure to dynamically retrieve the seeded cafe's ID and insert Tables 1 through 10.
* **[docs/INSTALLATION.md](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/docs/INSTALLATION.md)**: Updated documentation to reflect the automatic creation of 10 default tables during installation and seeding.

---

## 2. SQL Seeding Verification

The updated SQL bootstrap block inside **[supabase/seed.sql](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/supabase/seed.sql)** was successfully executed:

```sql
DO $$
DECLARE
  _cafe_id UUID;
BEGIN
  -- Insert cafe if not exists
  IF NOT EXISTS (SELECT 1 FROM public.cafes WHERE slug = 'orderrail') THEN
    INSERT INTO public.cafes (name, slug, currency)
    VALUES ('OrderRail', 'orderrail', 'INR');
  END IF;

  -- Get the cafe ID
  SELECT id INTO _cafe_id FROM public.cafes WHERE slug = 'orderrail' LIMIT 1;

  -- Seed tables 1 through 10
  FOR i IN 1..10 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.tables WHERE cafe_id = _cafe_id AND label = i::text) THEN
      INSERT INTO public.tables (cafe_id, label, seats)
      VALUES (_cafe_id, i::text, 4);
    END IF;
  END LOOP;
END $$;
```

### Execution Details:
* **Command Executed:** `supabase db query --linked -f supabase/seed.sql`
* **Status:** **Success**.
* **Tables Created:** `10` tables (labeled "1" through "10" with 4 seats each) were successfully written to the database.

---

## 3. Duplicate Prevention & Idempotency Strategy

* **Strategy:** The script uses a `FOR i IN 1..10` loop in PL/pgSQL and queries the `public.tables` table using `IF NOT EXISTS (SELECT 1 FROM public.tables WHERE cafe_id = _cafe_id AND label = i::text)` before inserting the record.
* **Idempotent:** **Yes**. Running the seed script multiple times is completely safe. If the cafe and tables are already present, no changes are made and no duplicate rows are inserted.

---

## 4. UI Verification Results

Seeding the default tables successfully resolved the conditional gates in the landing page [Index.tsx](file:///C:/Users/17042/Downloads/orderrail-pro-main%20old/orderrail-pro-main/src/pages/Index.tsx):
* **"Try the customer app" Button:** **Restored**. Since the query resolves the newly seeded table 1 as `firstTable`, the DOM renders the link.
* **Demo QR codes Section:** **Restored**. Since `tables.length` resolves to `10` (which is $> 0$), clicking the "Show demo QR codes" button displays the QR codes for all 10 tables.
* **Navigation check:** Clicking the customer app link successfully routes to the customer layout at `/t/<table1_uuid>`, opening the interactive customer menu interface.

---

## 5. Git status
All changes have been successfully committed to the repository:
* **Commit message:** `"Auto-seed 10 default tables in bootstrap process"`
* **Commit hash:** `152b01e`
