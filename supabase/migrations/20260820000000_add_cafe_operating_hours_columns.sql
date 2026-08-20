-- Migration: 20260820000000_add_cafe_operating_hours_columns.sql
-- Description: Add public customer-facing operating state columns (operating_status, weekly_schedule, dine_in_enabled) to public.cafes table, publish to Realtime, and backfill tenant operating schedules.

-- 1. Add operations state columns to public.cafes with safe default fallback values
ALTER TABLE public.cafes
  ADD COLUMN IF NOT EXISTS operating_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS weekly_schedule JSONB NOT NULL DEFAULT '{"0":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"},"1":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"},"2":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"},"3":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"},"4":{"isOpen":true,"openTime":"08:00","closeTime":"23:00"},"5":{"isOpen":true,"openTime":"09:00","closeTime":"23:00"},"6":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"}}'::jsonb,
  ADD COLUMN IF NOT EXISTS dine_in_enabled BOOLEAN NOT NULL DEFAULT true;

-- 2. Register public.cafes in supabase_realtime publication for live UPDATE synchronization (idempotent check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cafes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cafes;
  END IF;
END $$;

-- 3. Backfill Cheese Corner Production tenant schedule ("10AM - 11PM" -> 10:00 to 23:00 daily)
UPDATE public.cafes
SET
  operating_status = 'open',
  weekly_schedule = '{"0":{"isOpen":true,"openTime":"10:00","closeTime":"23:00"},"1":{"isOpen":true,"openTime":"10:00","closeTime":"23:00"},"2":{"isOpen":true,"openTime":"10:00","closeTime":"23:00"},"3":{"isOpen":true,"openTime":"10:00","closeTime":"23:00"},"4":{"isOpen":true,"openTime":"10:00","closeTime":"23:00"},"5":{"isOpen":true,"openTime":"10:00","closeTime":"23:00"},"6":{"isOpen":true,"openTime":"10:00","closeTime":"23:00"}}'::jsonb,
  dine_in_enabled = true
WHERE slug = 'cheesecorner';

-- 4. Backfill Public Demo tenant schedule ("Mon-Fri: 7 AM - 6 PM; Sat-Sun: 8 AM - 8 PM" -> Mon-Fri 07:00-18:00, Sat-Sun 08:00-20:00)
UPDATE public.cafes
SET
  operating_status = 'open',
  weekly_schedule = '{"0":{"isOpen":true,"openTime":"07:00","closeTime":"18:00"},"1":{"isOpen":true,"openTime":"07:00","closeTime":"18:00"},"2":{"isOpen":true,"openTime":"07:00","closeTime":"18:00"},"3":{"isOpen":true,"openTime":"07:00","closeTime":"18:00"},"4":{"isOpen":true,"openTime":"07:00","closeTime":"18:00"},"5":{"isOpen":true,"openTime":"08:00","closeTime":"20:00"},"6":{"isOpen":true,"openTime":"08:00","closeTime":"20:00"}}'::jsonb,
  dine_in_enabled = true
WHERE slug = 'orderrail';
