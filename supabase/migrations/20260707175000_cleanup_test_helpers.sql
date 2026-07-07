-- Drop helper RPCs used in automated tests
DROP FUNCTION IF EXISTS public.test_update_order_status(UUID, TEXT);
DROP FUNCTION IF EXISTS public.test_simulate_staff_edit(UUID, JSONB, INT);
