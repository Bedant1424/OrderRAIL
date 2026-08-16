-- Migration: Cafe Tax Settings JSONB Persistence
-- Adds tax_settings JSONB column to public.cafes table to persist tax & pricing configuration across devices and sessions.

ALTER TABLE public.cafes ADD COLUMN IF NOT EXISTS tax_settings JSONB DEFAULT '{
  "gstEnabled": true,
  "gstNumber": "27AAAAA0000A1Z5",
  "gstPercentage": 5,
  "serviceChargeEnabled": false,
  "serviceChargePercentage": 5,
  "pricingMode": "exclusive",
  "roundingMode": "none",
  "showTaxBreakdown": true,
  "showServiceCharge": true,
  "mergeTaxesInTotal": false
}'::jsonb;
