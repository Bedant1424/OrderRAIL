-- ============================================================================
-- Migration: 20260822180000_atomic_dining_sessions_and_rls_hardening.sql
-- Description: Milestone 3B.2 - Atomic Dining Session Concurrency & RLS Hardening
--
-- 1. Create partial unique index on public.dining_sessions(table_id) for open sessions
-- 2. Create atomic public.get_or_create_table_session RPC with advisory lock
-- 3. Create scoped public.touch_guest_session RPC for heartbeat updates
-- 4. Create atomic public.activate_dining_session_on_order RPC
-- 5. Harden RLS policies on tables, dining_sessions, and guest_sessions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Database Invariant: Partial Unique Index on Open Dining Sessions
-- ----------------------------------------------------------------------------
-- Guarantees at database engine level: exactly ONE open (browsing or active)
-- dining session per physical table.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_dining_session
ON public.dining_sessions (table_id)
WHERE status IN ('browsing', 'active');

-- ----------------------------------------------------------------------------
-- 2. Atomic Session RPC: public.get_or_create_table_session
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_table_session(
    p_table_id UUID,
    p_cafe_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_table RECORD;
    v_session RECORD;
    v_lock_key BIGINT;
BEGIN
    IF p_table_id IS NULL OR p_cafe_id IS NULL THEN
        RAISE EXCEPTION 'Table ID and Cafe ID are required.';
    END IF;

    -- Derive deterministic 64-bit advisory lock key from table UUID
    v_lock_key := ('x' || substr(md5(p_table_id::TEXT), 1, 16))::bit(64)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Lock and verify table existence and cafe tenancy
    SELECT id, cafe_id, label, status, active_session_id INTO v_table
    FROM public.tables
    WHERE id = p_table_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Table not found: %', p_table_id;
    END IF;

    IF v_table.cafe_id != p_cafe_id THEN
        RAISE EXCEPTION 'Table % does not belong to cafe %', p_table_id, p_cafe_id;
    END IF;

    -- Check for existing open dining session (browsing or active)
    SELECT id, table_id, status, opened_at, created_at INTO v_session
    FROM public.dining_sessions
    WHERE table_id = p_table_id
      AND status IN ('browsing', 'active')
    ORDER BY opened_at DESC
    LIMIT 1
    FOR UPDATE;

    -- If an open session exists, ensure table active_session_id pointer is synchronized
    IF FOUND THEN
        IF v_table.active_session_id IS DISTINCT FROM v_session.id THEN
            UPDATE public.tables
            SET active_session_id = v_session.id
            WHERE id = p_table_id;
        END IF;

        RETURN jsonb_build_object(
            'id', v_session.id,
            'table_id', v_session.table_id,
            'status', v_session.status,
            'opened_at', v_session.opened_at,
            'created_at', v_session.created_at,
            'is_new', false
        );
    END IF;

    -- If no open session exists, insert exactly one browsing session
    INSERT INTO public.dining_sessions (
        table_id,
        status,
        opened_at,
        created_at
    ) VALUES (
        p_table_id,
        'browsing',
        now(),
        now()
    )
    RETURNING id, table_id, status, opened_at, created_at INTO v_session;

    -- Link table's active_session_id to browsing session without setting status = 'occupied'
    UPDATE public.tables
    SET active_session_id = v_session.id
    WHERE id = p_table_id;

    RETURN jsonb_build_object(
        'id', v_session.id,
        'table_id', v_session.table_id,
        'status', v_session.status,
        'opened_at', v_session.opened_at,
        'created_at', v_session.created_at,
        'is_new', true
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Scoped Heartbeat RPC: public.touch_guest_session
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_guest_session(
    p_guest_session_id UUID,
    p_dining_session_id UUID,
    p_table_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_rows INT;
BEGIN
    IF p_guest_session_id IS NULL OR p_dining_session_id IS NULL OR p_table_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.guest_sessions
    SET last_seen_at = now(),
        updated_at = now()
    WHERE id = p_guest_session_id
      AND dining_session_id = p_dining_session_id
      AND table_id = p_table_id
      AND status = 'ACTIVE';

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    RETURN v_updated_rows > 0;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Atomic Order Session Activation: public.activate_dining_session_on_order
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_dining_session_on_order(
    p_dining_session_id UUID,
    p_table_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_dining_session_id IS NULL OR p_table_id IS NULL THEN
        RETURN;
    END IF;

    -- Promote session from browsing to active
    UPDATE public.dining_sessions
    SET status = 'active',
        updated_at = now()
    WHERE id = p_dining_session_id
      AND table_id = p_table_id
      AND status = 'browsing';

    -- Mark table occupied and synchronize active_session_id
    UPDATE public.tables
    SET status = 'occupied',
        active_session_id = p_dining_session_id
    WHERE id = p_table_id;
END;
$$;

-- Grant execution permissions on RPCs
GRANT EXECUTE ON FUNCTION public.get_or_create_table_session(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.touch_guest_session(UUID, UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_dining_session_on_order(UUID, UUID) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. RLS Hardening on public.tables
-- ----------------------------------------------------------------------------
-- Drop permissive public UPDATE policies
DROP POLICY IF EXISTS "tables_runtime_update" ON public.tables;
DROP POLICY IF EXISTS "tables public update" ON public.tables;
DROP POLICY IF EXISTS "tables_staff_counter_owner_update" ON public.tables;

-- Create authenticated RBAC policy for table updates
CREATE POLICY "tables_staff_counter_owner_update" ON public.tables
FOR UPDATE TO authenticated, service_role
USING (
    public.has_role(auth.uid(), 'owner', cafe_id) OR
    public.has_role(auth.uid(), 'counter', cafe_id) OR
    public.has_role(auth.uid(), 'staff', cafe_id) OR
    public.is_demo_admin(auth.uid()) OR
    auth.role() = 'service_role'
);

-- ----------------------------------------------------------------------------
-- 6. RLS Hardening on public.dining_sessions
-- ----------------------------------------------------------------------------
-- Drop permissive public UPDATE and INSERT policies
DROP POLICY IF EXISTS "dining_sessions public update" ON public.dining_sessions;
DROP POLICY IF EXISTS "dining_sessions public insert" ON public.dining_sessions;
DROP POLICY IF EXISTS "dining_sessions_staff_counter_owner_update" ON public.dining_sessions;
DROP POLICY IF EXISTS "dining_sessions_staff_counter_owner_insert" ON public.dining_sessions;

-- Create authenticated RBAC policies for dining sessions
CREATE POLICY "dining_sessions_staff_counter_owner_update" ON public.dining_sessions
FOR UPDATE TO authenticated, service_role
USING (
    EXISTS (
        SELECT 1 FROM public.tables t
        WHERE t.id = dining_sessions.table_id
          AND (
              public.has_role(auth.uid(), 'owner', t.cafe_id) OR
              public.has_role(auth.uid(), 'counter', t.cafe_id) OR
              public.has_role(auth.uid(), 'staff', t.cafe_id) OR
              public.is_demo_admin(auth.uid())
          )
    ) OR auth.role() = 'service_role'
);

CREATE POLICY "dining_sessions_staff_counter_owner_insert" ON public.dining_sessions
FOR INSERT TO authenticated, service_role
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tables t
        WHERE t.id = dining_sessions.table_id
          AND (
              public.has_role(auth.uid(), 'owner', t.cafe_id) OR
              public.has_role(auth.uid(), 'counter', t.cafe_id) OR
              public.has_role(auth.uid(), 'staff', t.cafe_id) OR
              public.is_demo_admin(auth.uid())
          )
    ) OR auth.role() = 'service_role'
);

-- ----------------------------------------------------------------------------
-- 7. RLS Hardening on public.guest_sessions
-- ----------------------------------------------------------------------------
-- Drop permissive public UPDATE policy
DROP POLICY IF EXISTS "guest_sessions public update" ON public.guest_sessions;
DROP POLICY IF EXISTS "guest_sessions_staff_update" ON public.guest_sessions;

-- Create authenticated RBAC policy for guest session administrative updates
CREATE POLICY "guest_sessions_staff_update" ON public.guest_sessions
FOR UPDATE TO authenticated, service_role
USING (
    EXISTS (
        SELECT 1 FROM public.tables t
        WHERE t.id = guest_sessions.table_id
          AND (
              public.has_role(auth.uid(), 'owner', t.cafe_id) OR
              public.has_role(auth.uid(), 'counter', t.cafe_id) OR
              public.has_role(auth.uid(), 'staff', t.cafe_id) OR
              public.is_demo_admin(auth.uid())
          )
    ) OR auth.role() = 'service_role'
);
