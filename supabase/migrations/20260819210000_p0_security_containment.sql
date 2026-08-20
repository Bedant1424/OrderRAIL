-- Migration: 20260819210000_p0_security_containment.sql
-- Description: P0 Security Containment Milestone — Restore role assignment authorization, restrict privileged RPC execution, and enable Row Level Security on counter tables.

-- ============================================================================
-- 1. RESTORE COUNTER-AWARE ROLE ASSIGNMENT AUTHORIZATION RPC
-- ============================================================================
-- Redefine assign_role_by_email combining older security checks (authentication, owner authorization, demo protection, role validation) with current counter-aware behavior.

CREATE OR REPLACE FUNCTION public.assign_role_by_email(
  _cafe_id uuid,
  _email text,
  _role public.app_role
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
  v_invite_id uuid;
  v_email_norm text := lower(trim(_email));
BEGIN
  -- 1. Authenticate actor
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Enforce Demo mode restrictions
  IF public.is_demo_cafe(_cafe_id) AND NOT public.is_demo_admin(auth.uid()) THEN
    RAISE EXCEPTION 'This action is disabled in the public demo.';
  END IF;

  -- 3. Owner Authorization Check
  IF NOT public.has_role(auth.uid(), 'owner', _cafe_id) THEN
    RAISE EXCEPTION 'Only cafe owners can assign roles';
  END IF;

  -- 4. Role Validation (must be staff, owner, or counter)
  IF _role NOT IN ('staff', 'owner', 'counter') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- 5. Resolve target user if registered
  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(email) = v_email_norm
  LIMIT 1;

  IF v_target_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, cafe_id, role, is_suspended)
    VALUES (v_target_user_id, _cafe_id, _role, false)
    ON CONFLICT (user_id, cafe_id) 
    DO UPDATE SET role = EXCLUDED.role, is_suspended = false;

    RETURN 'assigned';
  ELSE
    SELECT id INTO v_invite_id
    FROM public.staff_invites
    WHERE lower(email) = v_email_norm
      AND cafe_id = _cafe_id
      AND accepted_at IS NULL
      AND revoked_at IS NULL
    LIMIT 1;

    IF v_invite_id IS NOT NULL THEN
      UPDATE public.staff_invites
      SET role = _role, created_at = now()
      WHERE id = v_invite_id;
    ELSE
      INSERT INTO public.staff_invites (cafe_id, email, role)
      VALUES (_cafe_id, v_email_norm, _role);
    END IF;

    RETURN 'invited';
  END IF;
END;
$$;

-- Unconditionally reset assign_role_by_email ACL
REVOKE ALL ON FUNCTION public.assign_role_by_email(uuid, text, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_role_by_email(uuid, text, public.app_role) TO authenticated;


-- ============================================================================
-- 2. PRIVILEGED RPC EXECUTION RESTRICTIONS
-- ============================================================================
-- Revoke execution from PUBLIC/anon for administrative, billing, analytics, and customer management RPCs.
-- Grant execution only to authenticated role where required.

-- Billing RPCs
REVOKE ALL ON FUNCTION public.get_next_bill_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_bill_number(text) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_bill_atomic(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_bill_atomic(jsonb, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_bill_paid_atomic(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_bill_paid_atomic(uuid, text, timestamptz) TO authenticated;

-- Analytics RPCs
REVOKE ALL ON FUNCTION public.get_owner_analytics_summary(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owner_analytics_summary(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_sales_overview_rpc(text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_overview_rpc(text, timestamptz, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.get_menu_performance_rpc(text, timestamptz, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_menu_performance_rpc(text, timestamptz, timestamptz, integer) TO authenticated;

-- Customer Profile RPCs
REVOKE ALL ON FUNCTION public.resolve_or_create_customer(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_or_create_customer(uuid, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.record_customer_settlement(uuid, bigint, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_customer_settlement(uuid, bigint, timestamptz) TO authenticated;


-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY ON COUNTER TABLES
-- ============================================================================
-- Restrict direct PostgREST client mutations on counter tables.
-- SECURITY DEFINER trigger functions retain access to increment order/invoice counters.

ALTER TABLE public.daily_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_daily_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_invoice_counters ENABLE ROW LEVEL SECURITY;
