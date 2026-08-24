-- ============================================================================
-- Migration: 20260824190000_p0_security_containment_hardening.sql
-- Description: P0 Security Containment — Lock down RLS on bills, bill_items, and order_events
--
-- 1. Remove permissive anonymous CRUD policies on public.bills and public.bill_items
-- 2. Add authenticated staff/counter/owner RBAC policies on public.bills and public.bill_items
-- 3. Revoke anonymous UPDATE/DELETE access on public.order_events while preserving required customer INSERT/SELECT
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Hardening public.bills
-- ----------------------------------------------------------------------------
-- Drop legacy permissive full-access policy
DROP POLICY IF EXISTS "Allow public/staff full access to bills" ON public.bills;
DROP POLICY IF EXISTS "bills_staff_counter_owner_select" ON public.bills;
DROP POLICY IF EXISTS "bills_staff_counter_owner_manage" ON public.bills;
DROP POLICY IF EXISTS "bills_staff_counter_owner_insert" ON public.bills;
DROP POLICY IF EXISTS "bills_staff_counter_owner_update" ON public.bills;
DROP POLICY IF EXISTS "bills_staff_counter_owner_delete" ON public.bills;

-- Revoke anonymous mutating permissions
REVOKE INSERT, UPDATE, DELETE ON public.bills FROM anon;

-- Policy: Select bills (Authenticated staff, counter, owner, demo admin, service_role)
CREATE POLICY "bills_staff_counter_owner_select" ON public.bills
FOR SELECT TO authenticated, service_role
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (bills.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = bills.cafe_id::uuid)
        OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = bills.cafe_id OR c.slug = bills.cafe_id))
      )
      AND ur.role IN ('owner', 'counter', 'staff')
      AND ur.is_suspended = false
  )
  OR public.is_demo_admin(auth.uid())
  OR auth.role() = 'service_role'
);

-- Policy: Insert bills (Authenticated staff, counter, owner, demo admin, service_role)
CREATE POLICY "bills_staff_counter_owner_insert" ON public.bills
FOR INSERT TO authenticated, service_role
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (bills.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = bills.cafe_id::uuid)
        OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = bills.cafe_id OR c.slug = bills.cafe_id))
      )
      AND ur.role IN ('owner', 'counter', 'staff')
      AND ur.is_suspended = false
  )
  OR public.is_demo_admin(auth.uid())
  OR auth.role() = 'service_role'
);

-- Policy: Update bills (Authenticated staff, counter, owner, demo admin, service_role)
CREATE POLICY "bills_staff_counter_owner_update" ON public.bills
FOR UPDATE TO authenticated, service_role
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (bills.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = bills.cafe_id::uuid)
        OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = bills.cafe_id OR c.slug = bills.cafe_id))
      )
      AND ur.role IN ('owner', 'counter', 'staff')
      AND ur.is_suspended = false
  )
  OR public.is_demo_admin(auth.uid())
  OR auth.role() = 'service_role'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (bills.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = bills.cafe_id::uuid)
        OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = bills.cafe_id OR c.slug = bills.cafe_id))
      )
      AND ur.role IN ('owner', 'counter', 'staff')
      AND ur.is_suspended = false
  )
  OR public.is_demo_admin(auth.uid())
  OR auth.role() = 'service_role'
);

-- Policy: Delete bills (Authenticated owner, demo admin, service_role)
CREATE POLICY "bills_staff_counter_owner_delete" ON public.bills
FOR DELETE TO authenticated, service_role
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        (bills.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = bills.cafe_id::uuid)
        OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = bills.cafe_id OR c.slug = bills.cafe_id))
      )
      AND ur.role = 'owner'
      AND ur.is_suspended = false
  )
  OR public.is_demo_admin(auth.uid())
  OR auth.role() = 'service_role'
);


-- ----------------------------------------------------------------------------
-- 2. Hardening public.bill_items
-- ----------------------------------------------------------------------------
-- Drop legacy permissive full-access policy
DROP POLICY IF EXISTS "Allow public/staff full access to bill_items" ON public.bill_items;
DROP POLICY IF EXISTS "bill_items_staff_counter_owner_select" ON public.bill_items;
DROP POLICY IF EXISTS "bill_items_staff_counter_owner_insert" ON public.bill_items;
DROP POLICY IF EXISTS "bill_items_staff_counter_owner_update" ON public.bill_items;
DROP POLICY IF EXISTS "bill_items_staff_counter_owner_delete" ON public.bill_items;

-- Revoke anonymous mutating permissions
REVOKE INSERT, UPDATE, DELETE ON public.bill_items FROM anon;

-- Policy: Select bill items (Authenticated staff, counter, owner, demo admin, service_role)
CREATE POLICY "bill_items_staff_counter_owner_select" ON public.bill_items
FOR SELECT TO authenticated, service_role
USING (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_items.bill_id
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (
              (b.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = b.cafe_id::uuid)
              OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = b.cafe_id OR c.slug = b.cafe_id))
            )
            AND ur.role IN ('owner', 'counter', 'staff')
            AND ur.is_suspended = false
        )
        OR public.is_demo_admin(auth.uid())
        OR auth.role() = 'service_role'
      )
  )
);

-- Policy: Insert bill items (Authenticated staff, counter, owner, demo admin, service_role)
CREATE POLICY "bill_items_staff_counter_owner_insert" ON public.bill_items
FOR INSERT TO authenticated, service_role
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_items.bill_id
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (
              (b.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = b.cafe_id::uuid)
              OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = b.cafe_id OR c.slug = b.cafe_id))
            )
            AND ur.role IN ('owner', 'counter', 'staff')
            AND ur.is_suspended = false
        )
        OR public.is_demo_admin(auth.uid())
        OR auth.role() = 'service_role'
      )
  )
);

-- Policy: Update bill items (Authenticated staff, counter, owner, demo admin, service_role)
CREATE POLICY "bill_items_staff_counter_owner_update" ON public.bill_items
FOR UPDATE TO authenticated, service_role
USING (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_items.bill_id
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (
              (b.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = b.cafe_id::uuid)
              OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = b.cafe_id OR c.slug = b.cafe_id))
            )
            AND ur.role IN ('owner', 'counter', 'staff')
            AND ur.is_suspended = false
        )
        OR public.is_demo_admin(auth.uid())
        OR auth.role() = 'service_role'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_items.bill_id
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (
              (b.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = b.cafe_id::uuid)
              OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = b.cafe_id OR c.slug = b.cafe_id))
            )
            AND ur.role IN ('owner', 'counter', 'staff')
            AND ur.is_suspended = false
        )
        OR public.is_demo_admin(auth.uid())
        OR auth.role() = 'service_role'
      )
  )
);

-- Policy: Delete bill items (Authenticated owner, demo admin, service_role)
CREATE POLICY "bill_items_staff_counter_owner_delete" ON public.bill_items
FOR DELETE TO authenticated, service_role
USING (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_items.bill_id
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (
              (b.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND ur.cafe_id = b.cafe_id::uuid)
              OR EXISTS (SELECT 1 FROM public.cafes c WHERE c.id = ur.cafe_id AND (c.id::text = b.cafe_id OR c.slug = b.cafe_id))
            )
            AND ur.role = 'owner'
            AND ur.is_suspended = false
        )
        OR public.is_demo_admin(auth.uid())
        OR auth.role() = 'service_role'
      )
  )
);


-- ----------------------------------------------------------------------------
-- 3. Hardening public.order_events
-- ----------------------------------------------------------------------------
-- Drop permissive public update and delete policies
DROP POLICY IF EXISTS "order_events public update" ON public.order_events;
DROP POLICY IF EXISTS "order_events public delete" ON public.order_events;
DROP POLICY IF EXISTS "order_events_staff_counter_owner_update" ON public.order_events;
DROP POLICY IF EXISTS "order_events_staff_counter_owner_delete" ON public.order_events;

-- Revoke direct mutation permissions from anon
REVOKE UPDATE, DELETE ON public.order_events FROM anon;

-- Policy: Update order events (Authenticated staff, counter, owner, demo admin, service_role)
CREATE POLICY "order_events_staff_counter_owner_update" ON public.order_events
FOR UPDATE TO authenticated, service_role
USING (
  EXISTS (
    SELECT 1 FROM public.dining_sessions ds
    JOIN public.tables t ON t.id = ds.table_id
    WHERE ds.id = order_events.dining_session_id
      AND (
        public.has_role(auth.uid(), 'owner', t.cafe_id) OR
        public.has_role(auth.uid(), 'counter', t.cafe_id) OR
        public.has_role(auth.uid(), 'staff', t.cafe_id) OR
        public.is_demo_admin(auth.uid())
      )
  ) OR auth.role() = 'service_role'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dining_sessions ds
    JOIN public.tables t ON t.id = ds.table_id
    WHERE ds.id = order_events.dining_session_id
      AND (
        public.has_role(auth.uid(), 'owner', t.cafe_id) OR
        public.has_role(auth.uid(), 'counter', t.cafe_id) OR
        public.has_role(auth.uid(), 'staff', t.cafe_id) OR
        public.is_demo_admin(auth.uid())
      )
  ) OR auth.role() = 'service_role'
);

-- Policy: Delete order events (Authenticated owner, demo admin, service_role)
CREATE POLICY "order_events_staff_counter_owner_delete" ON public.order_events
FOR DELETE TO authenticated, service_role
USING (
  EXISTS (
    SELECT 1 FROM public.dining_sessions ds
    JOIN public.tables t ON t.id = ds.table_id
    WHERE ds.id = order_events.dining_session_id
      AND (
        public.has_role(auth.uid(), 'owner', t.cafe_id) OR
        public.is_demo_admin(auth.uid())
      )
  ) OR auth.role() = 'service_role'
);
