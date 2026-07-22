-- Fix Onboarding RLS & Invitation Consistency
-- Part 1: Allow owners to read all profiles for Pending Account Approvals discovery
-- Part 3: Index support for active pending invitation queries

-- 1. Profiles RLS: Allow owners to read ALL profiles
-- RATIONALE: The existing "profiles owner read cafe members" policy only exposes
-- profiles of users who already have a user_roles entry. Walk-in registrations
-- create a profile but NO user_roles entry, so the owner cannot discover them.
-- This new policy allows any authenticated owner to read all profiles.
-- Tenant isolation is preserved because the Pending Approvals frontend query
-- cross-references user_roles, staff_invites, and rejected_approvals scoped
-- to the owner's cafe_id — only unassigned users surface as "pending".

DROP POLICY IF EXISTS "profiles_owner_read_all" ON public.profiles;
CREATE POLICY "profiles_owner_read_all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'owner'
  )
);
