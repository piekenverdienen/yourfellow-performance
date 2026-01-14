-- ===========================================
-- Fix RLS Recursion Issue
-- ===========================================
-- The has_client_access function causes infinite recursion when called
-- from RLS policies because it queries client_memberships which has
-- its own RLS policy that also calls has_client_access.

-- ===========================================
-- 1. UPDATE is_org_admin TO BYPASS RLS
-- ===========================================
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Direct query without RLS check
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated;

-- ===========================================
-- 2. UPDATE has_client_access TO BYPASS RLS
-- ===========================================
CREATE OR REPLACE FUNCTION public.has_client_access(check_client_id UUID, min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_approval_status TEXT;
  user_profile_role TEXT;
  role_hierarchy TEXT[] := ARRAY['viewer', 'editor', 'admin', 'owner'];
  user_role_index INTEGER;
  min_role_index INTEGER;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- First check if user is org admin (they have access to everything)
  SELECT role INTO user_profile_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF user_profile_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Get user's role and approval status for this client (direct query, no RLS)
  SELECT role, COALESCE(approval_status, 'approved') INTO user_role, user_approval_status
  FROM public.client_memberships
  WHERE client_id = check_client_id AND user_id = v_user_id;

  -- If no membership found, deny access
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- CRITICAL: Only approved memberships grant access
  IF user_approval_status != 'approved' THEN
    RETURN FALSE;
  END IF;

  -- Check if user's role meets minimum requirement
  user_role_index := array_position(role_hierarchy, user_role);
  min_role_index := array_position(role_hierarchy, min_role);

  RETURN user_role_index >= min_role_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.has_client_access(UUID, TEXT) TO authenticated;

-- ===========================================
-- 3. FIX CLIENT_MEMBERSHIPS RLS POLICY
-- ===========================================
-- Remove the circular dependency by not using has_client_access in the policy

DROP POLICY IF EXISTS "Users can view memberships for accessible clients or own pending" ON public.client_memberships;
DROP POLICY IF EXISTS "Users can view memberships for accessible clients" ON public.client_memberships;

-- New policy that doesn't cause recursion
CREATE POLICY "Users can view their own memberships or all if org admin"
  ON public.client_memberships FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm2
      WHERE cm2.client_id = client_memberships.client_id
        AND cm2.user_id = auth.uid()
        AND cm2.approval_status = 'approved'
        AND cm2.role IN ('admin', 'owner')
    )
  );

-- ===========================================
-- 4. FIX INVITES RLS POLICIES
-- ===========================================
DROP POLICY IF EXISTS "Users can view invites for accessible clients" ON public.invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can update invites" ON public.invites;

-- Org admins see all, client admins see their client's invites
CREATE POLICY "Users can view invites"
  ON public.invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = invites.client_id
        AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved'
        AND cm.role IN ('admin', 'owner')
    )
  );

-- Org admins or client admins can create invites
CREATE POLICY "Admins can create invites"
  ON public.invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = invites.client_id
        AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved'
        AND cm.role IN ('admin', 'owner')
    )
  );

-- Org admins, inviters, or client admins can update invites
CREATE POLICY "Admins can update invites"
  ON public.invites FOR UPDATE
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = invites.client_id
        AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved'
        AND cm.role IN ('admin', 'owner')
    )
  );

-- ===========================================
-- Done! RLS recursion is now fixed.
-- ===========================================
