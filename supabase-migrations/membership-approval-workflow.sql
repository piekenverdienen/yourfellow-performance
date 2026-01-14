-- ===========================================
-- YourFellow Performance - Membership Approval Workflow
-- ===========================================
-- This migration adds admin approval workflow for client memberships
-- to ensure only approved users can access customer data.

-- ===========================================
-- 1. ADD APPROVAL FIELDS TO CLIENT_MEMBERSHIPS
-- ===========================================
ALTER TABLE public.client_memberships
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS request_reason TEXT;

-- Add index for efficient querying of pending memberships
CREATE INDEX IF NOT EXISTS idx_client_memberships_approval_status ON public.client_memberships(approval_status);
CREATE INDEX IF NOT EXISTS idx_client_memberships_approved_by ON public.client_memberships(approved_by);

-- ===========================================
-- 2. UPDATE has_client_access FUNCTION
-- ===========================================
-- Only approved memberships should grant access
CREATE OR REPLACE FUNCTION public.has_client_access(check_client_id UUID, min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_approval_status TEXT;
  role_hierarchy TEXT[] := ARRAY['viewer', 'editor', 'admin', 'owner'];
  user_role_index INTEGER;
  min_role_index INTEGER;
BEGIN
  -- Get user's role and approval status for this client
  SELECT role, approval_status INTO user_role, user_approval_status
  FROM public.client_memberships
  WHERE client_id = check_client_id AND user_id = auth.uid();

  -- If no membership found, deny access
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- CRITICAL: Only approved memberships grant access
  IF user_approval_status IS NULL OR user_approval_status != 'approved' THEN
    RETURN FALSE;
  END IF;

  -- Check if user's role meets minimum requirement
  user_role_index := array_position(role_hierarchy, user_role);
  min_role_index := array_position(role_hierarchy, min_role);

  RETURN user_role_index >= min_role_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===========================================
-- 3. UPDATE get_user_clients FUNCTION
-- ===========================================
-- Only return clients where user has approved membership
CREATE OR REPLACE FUNCTION public.get_user_clients(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  logo_url TEXT,
  settings JSONB,
  role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- If org admin, return all active clients
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_uuid AND p.role = 'admin') THEN
    RETURN QUERY
    SELECT c.id, c.name, c.slug, c.description, c.logo_url, c.settings, 'admin'::TEXT as role, c.is_active, c.created_at
    FROM public.clients c
    WHERE c.is_active = TRUE
    ORDER BY c.name;
  ELSE
    -- Return only clients where user has APPROVED membership
    RETURN QUERY
    SELECT c.id, c.name, c.slug, c.description, c.logo_url, c.settings, cm.role, c.is_active, c.created_at
    FROM public.clients c
    INNER JOIN public.client_memberships cm ON cm.client_id = c.id
    WHERE cm.user_id = user_uuid
      AND c.is_active = TRUE
      AND cm.approval_status = 'approved'
    ORDER BY c.name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 4. UPDATE get_client_role FUNCTION
-- ===========================================
-- Only return role if membership is approved
CREATE OR REPLACE FUNCTION public.get_client_role(check_client_id UUID, check_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_profile_role TEXT;
  client_role TEXT;
  client_approval_status TEXT;
BEGIN
  -- Check if user is org admin (org admins always have access)
  SELECT role INTO user_profile_role FROM public.profiles WHERE id = check_user_id;
  IF user_profile_role = 'admin' THEN
    RETURN 'admin';
  END IF;

  -- Get client membership role and approval status
  SELECT role, approval_status INTO client_role, client_approval_status
  FROM public.client_memberships
  WHERE client_id = check_client_id AND user_id = check_user_id;

  -- Only return role if approved
  IF client_approval_status = 'approved' THEN
    RETURN client_role;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===========================================
-- 5. CREATE FUNCTION: Get pending memberships for admins
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_pending_memberships()
RETURNS TABLE (
  membership_id UUID,
  client_id UUID,
  client_name TEXT,
  client_slug TEXT,
  user_id UUID,
  user_email TEXT,
  user_full_name TEXT,
  requested_role TEXT,
  request_reason TEXT,
  requested_by_id UUID,
  requested_by_email TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Only org admins can see all pending memberships
  IF NOT public.is_org_admin() THEN
    RAISE EXCEPTION 'Access denied: only org admins can view pending memberships';
  END IF;

  RETURN QUERY
  SELECT
    cm.id as membership_id,
    cm.client_id,
    c.name as client_name,
    c.slug as client_slug,
    cm.user_id,
    p.email as user_email,
    p.full_name as user_full_name,
    cm.role as requested_role,
    cm.request_reason,
    cm.requested_by as requested_by_id,
    rp.email as requested_by_email,
    cm.created_at
  FROM public.client_memberships cm
  INNER JOIN public.clients c ON c.id = cm.client_id
  INNER JOIN public.profiles p ON p.id = cm.user_id
  LEFT JOIN public.profiles rp ON rp.id = cm.requested_by
  WHERE cm.approval_status = 'pending'
  ORDER BY cm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 6. CREATE FUNCTION: Approve membership
-- ===========================================
CREATE OR REPLACE FUNCTION public.approve_membership(
  membership_uuid UUID,
  approval_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  approver_id UUID;
BEGIN
  -- Only org admins can approve
  IF NOT public.is_org_admin() THEN
    RAISE EXCEPTION 'Access denied: only org admins can approve memberships';
  END IF;

  approver_id := auth.uid();

  UPDATE public.client_memberships
  SET
    approval_status = 'approved',
    approved_by = approver_id,
    approved_at = NOW(),
    rejected_at = NULL,
    rejection_reason = NULL
  WHERE id = membership_uuid AND approval_status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 7. CREATE FUNCTION: Reject membership
-- ===========================================
CREATE OR REPLACE FUNCTION public.reject_membership(
  membership_uuid UUID,
  reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  rejector_id UUID;
BEGIN
  -- Only org admins can reject
  IF NOT public.is_org_admin() THEN
    RAISE EXCEPTION 'Access denied: only org admins can reject memberships';
  END IF;

  rejector_id := auth.uid();

  UPDATE public.client_memberships
  SET
    approval_status = 'rejected',
    approved_by = rejector_id,
    rejected_at = NOW(),
    rejection_reason = reason,
    approved_at = NULL
  WHERE id = membership_uuid AND approval_status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 8. CREATE FUNCTION: Get membership approval status
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_membership_status(check_client_id UUID, check_user_id UUID)
RETURNS TABLE (
  has_membership BOOLEAN,
  approval_status TEXT,
  role TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as has_membership,
    cm.approval_status,
    cm.role,
    cm.approved_at,
    cm.rejected_at,
    cm.rejection_reason
  FROM public.client_memberships cm
  WHERE cm.client_id = check_client_id AND cm.user_id = check_user_id;

  -- If no rows, return explicit no membership
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===========================================
-- 9. UPDATE RLS POLICY FOR CLIENT MEMBERSHIPS SELECT
-- ===========================================
-- Users can see their own pending memberships
DROP POLICY IF EXISTS "Users can view memberships for accessible clients" ON public.client_memberships;

CREATE POLICY "Users can view memberships for accessible clients or own pending"
  ON public.client_memberships FOR SELECT
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'viewer')
    OR (user_id = auth.uid())  -- Users can see their own membership status
  );

-- ===========================================
-- 10. MIGRATION: Auto-approve existing memberships
-- ===========================================
-- Existing memberships are considered already approved (grandfathered in)
UPDATE public.client_memberships
SET
  approval_status = 'approved',
  approved_at = created_at
WHERE approval_status IS NULL OR approval_status = 'pending';

-- ===========================================
-- Done! Membership approval workflow is now set up.
-- ===========================================
-- IMPORTANT: New memberships created via API will have status 'pending'
-- and must be approved by an org admin before the user can access data.
