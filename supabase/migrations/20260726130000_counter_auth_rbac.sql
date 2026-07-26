-- Migration: 20260726130000_counter_auth_rbac.sql
-- Sprint 9.2: Counter Authentication & Role-Based Access Control

-- 1. Safely add 'counter' value to app_role enum at top-level (outside DO block)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'counter';

-- 2. Update claim_demo_role stored procedure to support 'counter'
CREATE OR REPLACE FUNCTION public.claim_demo_role(_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF _role NOT IN ('owner', 'counter', 'staff') THEN
    RAISE EXCEPTION 'Invalid role specified';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = auth.uid();

  INSERT INTO public.user_roles (user_id, cafe_id, role, is_suspended)
  VALUES (
    auth.uid(),
    '8c418a5a-7cd4-4054-8a88-f412c1762f7d',
    _role,
    false
  );
END;
$$;

-- 3. Update assign_role_by_email stored procedure to support 'counter'
CREATE OR REPLACE FUNCTION public.assign_role_by_email(
  _cafe_id uuid,
  _email text,
  _role public.app_role
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_user_id uuid;
  v_invite_id uuid;
BEGIN
  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(email) = lower(_email)
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
    WHERE lower(email) = lower(_email)
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
      VALUES (_cafe_id, lower(_email), _role);
    END IF;

    RETURN 'invited';
  END IF;
END;
$$;

COMMENT ON TYPE public.app_role IS 'Supported authenticated application roles: owner, counter, staff. Anonymous guests use Guest Sessions.';
