-- Migration: 20260820233500_counter_rbac_orders_update_fix.sql
-- Goal: Permit authenticated users with the 'counter' role to update order statuses and service requests for their cafe.

-- 1. Update public.orders FOR UPDATE policy to include 'counter' role
DROP POLICY IF EXISTS "orders staff update" ON public.orders;

CREATE POLICY "orders staff update" ON public.orders FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff', cafe_id) OR
    public.has_role(auth.uid(), 'owner', cafe_id) OR
    public.has_role(auth.uid(), 'counter', cafe_id)
  );

-- 2. Update public.service_requests FOR UPDATE policy to include 'counter' role
DROP POLICY IF EXISTS "sr staff update" ON public.service_requests;

CREATE POLICY "sr staff update" ON public.service_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff', cafe_id) OR
    public.has_role(auth.uid(), 'owner', cafe_id) OR
    public.has_role(auth.uid(), 'counter', cafe_id)
  );
