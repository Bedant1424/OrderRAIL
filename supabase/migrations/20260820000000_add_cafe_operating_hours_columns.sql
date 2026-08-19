-- Migration: 20260820000000_add_cafe_operating_hours_columns.sql
-- Description: Add public customer-facing operating state columns (operating_status, weekly_schedule, dine_in_enabled) to public.cafes table.

ALTER TABLE public.cafes
  ADD COLUMN IF NOT EXISTS operating_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS weekly_schedule JSONB NOT NULL DEFAULT '{"0":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"},"1":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"},"2":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"},"3":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"},"4":{"isOpen":true,"openTime":"08:00","closeTime":"23:00"},"5":{"isOpen":true,"openTime":"09:00","closeTime":"23:00"},"6":{"isOpen":true,"openTime":"08:00","closeTime":"22:00"}}'::jsonb,
  ADD COLUMN IF NOT EXISTS dine_in_enabled BOOLEAN NOT NULL DEFAULT true;
