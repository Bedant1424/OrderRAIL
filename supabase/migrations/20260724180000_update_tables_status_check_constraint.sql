-- Update public.tables status check constraint to accept canonical status values
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_status_check;
ALTER TABLE public.tables ADD CONSTRAINT tables_status_check CHECK (status IN ('free', 'occupied', 'cleaning_required', 'out_of_service'));
