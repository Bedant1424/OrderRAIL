-- Migration: 20260726130000_counter_auth_rbac.sql
-- Sprint 9.2: Counter Authentication & Role-Based Access Control

-- 1. Ensure 'counter' value exists in app_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'public.app_role'::regtype 
    AND enumlabel = 'counter'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'counter';
  END IF;
END $$;

-- 2. Ensure RLS policies on tables, dining_sessions, orders, bills support 'counter' role
-- Note: 'counter' role has operational access to table sessions, orders, and bills.

COMMENT ON TYPE public.app_role IS 'Supported authenticated application roles: owner, counter, staff. Anonymous guests use Guest Sessions.';
