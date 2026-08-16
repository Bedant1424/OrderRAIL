-- Migration: Cafe Receipt Settings JSONB Persistence
-- Adds receipt_settings JSONB column to public.cafes table to persist receipt configuration across devices and sessions.

ALTER TABLE public.cafes ADD COLUMN IF NOT EXISTS receipt_settings JSONB DEFAULT '{
  "showLogo": true,
  "showAddress": true,
  "showPhone": true,
  "showGst": true,
  "showInvoiceNum": true,
  "receiptHeader": "Welcome to Cheese Corner",
  "thankYouMessage": "Thank you for visiting Cheese Corner!\nPlease visit again soon.",
  "footerInfo": "FSSAI LIC NO: 10020022000123\nFollow us on Instagram @cheesecorner",
  "invoicePrefix": "INV-",
  "receiptWidth": "58mm",
  "autoPrint": false,
  "printCopies": 1,
  "gstNumber": "27AAAAA0000A1Z5",
  "fssaiNumber": "10020022000123",
  "businessRegNumber": "CIN-12345678",
  "supportEmail": "support@cheesecorner.com",
  "website": "www.cheesecorner.com"
}'::jsonb;
