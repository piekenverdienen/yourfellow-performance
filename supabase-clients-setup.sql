-- ===========================================
-- YourFellow Performance - Client Access Control Setup
-- ===========================================
-- Run this in Supabase SQL Editor after the main setup
-- This adds multi-client support with Row Level Security

-- ===========================================
-- 1. CLIENTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 2. CLIENT MEMBERSHIPS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.client_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique membership per client-user pair
  UNIQUE(client_id, user_id)
);

-- ===========================================
-- 3. ADD client_id TO EXISTING TABLES
-- ===========================================

-- Add client_id to conversations (chat runs)
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Add client_id to workflow_runs (playbook runs)
ALTER TABLE public.workflow_runs
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Add client_id to generations (for client-specific content)
ALTER TABLE public.generations
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Add client_id to usage (for client-specific tracking)
ALTER TABLE public.usage
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Add client_id to workflows (playbooks can be client-specific)
ALTER TABLE public.workflows
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- ===========================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_memberships ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 5. HELPER FUNCTION: Check client membership
-- ===========================================
CREATE OR REPLACE FUNCTION public.has_client_access(check_client_id UUID, min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  role_hierarchy TEXT[] := ARRAY['viewer', 'editor', 'admin', 'owner'];
  user_role_index INTEGER;
  min_role_index INTEGER;
BEGIN
  -- Get user's role for this client
  SELECT role INTO user_role
  FROM public.client_memberships
  WHERE client_id = check_client_id AND user_id = auth.uid();

  -- If no membership found, deny access
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user's role meets minimum requirement
  user_role_index := array_position(role_hierarchy, user_role);
  min_role_index := array_position(role_hierarchy, min_role);

  RETURN user_role_index >= min_role_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===========================================
-- 6. HELPER FUNCTION: Check if user is org admin
-- ===========================================
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===========================================
-- 7. RLS POLICIES FOR CLIENTS
-- ===========================================

-- SELECT: User can see clients they have membership for OR if they're org admin
CREATE POLICY "Users can view accessible clients"
  ON public.clients FOR SELECT
  USING (
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = id AND cm.user_id = auth.uid()
    )
  );

-- INSERT: Only org admins can create clients
CREATE POLICY "Org admins can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (is_org_admin());

-- UPDATE: Org admins or client owners/admins can update
CREATE POLICY "Admins can update clients"
  ON public.clients FOR UPDATE
  USING (
    is_org_admin()
    OR has_client_access(id, 'admin')
  )
  WITH CHECK (
    is_org_admin()
    OR has_client_access(id, 'admin')
  );

-- DELETE: Only org admins can delete clients
CREATE POLICY "Org admins can delete clients"
  ON public.clients FOR DELETE
  USING (is_org_admin());

-- ===========================================
-- 8. RLS POLICIES FOR CLIENT MEMBERSHIPS
-- ===========================================

-- SELECT: User can see memberships for clients they have access to
CREATE POLICY "Users can view memberships for accessible clients"
  ON public.client_memberships FOR SELECT
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'viewer')
  );

-- INSERT: Only org admins or client owners/admins can add members
CREATE POLICY "Admins can add memberships"
  ON public.client_memberships FOR INSERT
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'admin')
  );

-- UPDATE: Only org admins or client owners/admins can update roles
CREATE POLICY "Admins can update memberships"
  ON public.client_memberships FOR UPDATE
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'admin')
  )
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'admin')
  );

-- DELETE: Only org admins or client owners/admins can remove members
CREATE POLICY "Admins can delete memberships"
  ON public.client_memberships FOR DELETE
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'owner')
  );

-- ===========================================
-- 9. UPDATE RLS POLICIES FOR CONVERSATIONS
-- ===========================================
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;

-- New policies with client access check
CREATE POLICY "Users can view conversations with client access"
  ON public.conversations FOR SELECT
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'viewer'))
  );

CREATE POLICY "Users can create conversations with client access"
  ON public.conversations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

CREATE POLICY "Users can update own conversations with client access"
  ON public.conversations FOR UPDATE
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

CREATE POLICY "Users can delete own conversations with client access"
  ON public.conversations FOR DELETE
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

-- ===========================================
-- 10. UPDATE RLS POLICIES FOR WORKFLOW_RUNS
-- ===========================================
DROP POLICY IF EXISTS "Users can view own workflow runs" ON public.workflow_runs;
DROP POLICY IF EXISTS "Users can create own workflow runs" ON public.workflow_runs;
DROP POLICY IF EXISTS "Users can update own workflow runs" ON public.workflow_runs;

CREATE POLICY "Users can view workflow runs with client access"
  ON public.workflow_runs FOR SELECT
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'viewer'))
  );

CREATE POLICY "Users can create workflow runs with client access"
  ON public.workflow_runs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

CREATE POLICY "Users can update workflow runs with client access"
  ON public.workflow_runs FOR UPDATE
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

-- ===========================================
-- 11. UPDATE RLS POLICIES FOR GENERATIONS
-- ===========================================
DROP POLICY IF EXISTS "Users can view own generations" ON public.generations;
DROP POLICY IF EXISTS "Users can insert own generations" ON public.generations;
DROP POLICY IF EXISTS "Users can update own generations" ON public.generations;
DROP POLICY IF EXISTS "Users can delete own generations" ON public.generations;

CREATE POLICY "Users can view generations with client access"
  ON public.generations FOR SELECT
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'viewer'))
  );

CREATE POLICY "Users can insert generations with client access"
  ON public.generations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

CREATE POLICY "Users can update generations with client access"
  ON public.generations FOR UPDATE
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

CREATE POLICY "Users can delete generations with client access"
  ON public.generations FOR DELETE
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

-- ===========================================
-- 12. UPDATE RLS POLICIES FOR USAGE
-- ===========================================
DROP POLICY IF EXISTS "Users can view own usage" ON public.usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage;

CREATE POLICY "Users can view usage with client access"
  ON public.usage FOR SELECT
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'viewer'))
  );

CREATE POLICY "Users can insert usage with client access"
  ON public.usage FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

-- ===========================================
-- 13. UPDATE RLS POLICIES FOR WORKFLOWS
-- ===========================================
DROP POLICY IF EXISTS "Users can view own workflows and templates" ON public.workflows;
DROP POLICY IF EXISTS "Users can create own workflows" ON public.workflows;
DROP POLICY IF EXISTS "Users can update own workflows" ON public.workflows;
DROP POLICY IF EXISTS "Users can delete own workflows" ON public.workflows;

CREATE POLICY "Users can view workflows with client access"
  ON public.workflows FOR SELECT
  USING (
    is_template = TRUE
    OR (
      user_id = auth.uid()
      AND (client_id IS NULL OR has_client_access(client_id, 'viewer'))
    )
  );

CREATE POLICY "Users can create workflows with client access"
  ON public.workflows FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

CREATE POLICY "Users can update workflows with client access"
  ON public.workflows FOR UPDATE
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

CREATE POLICY "Users can delete workflows with client access"
  ON public.workflows FOR DELETE
  USING (
    user_id = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

-- ===========================================
-- 14. INDEXES FOR PERFORMANCE
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_clients_slug ON public.clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_client_memberships_client_id ON public.client_memberships(client_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_user_id ON public.client_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_client_id ON public.workflow_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_generations_client_id ON public.generations(client_id);
CREATE INDEX IF NOT EXISTS idx_usage_client_id ON public.usage(client_id);
CREATE INDEX IF NOT EXISTS idx_workflows_client_id ON public.workflows(client_id);

-- ===========================================
-- 15. TRIGGERS FOR updated_at
-- ===========================================
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER client_memberships_updated_at
  BEFORE UPDATE ON public.client_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================
-- 16. FUNCTION: Get user's accessible clients
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_user_clients(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  logo_url TEXT,
  role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- If org admin, return all active clients
  -- Note: Use table alias 'p' to avoid ambiguity with return column 'id'
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_uuid AND p.role = 'admin') THEN
    RETURN QUERY
    SELECT c.id, c.name, c.slug, c.description, c.logo_url, 'admin'::TEXT as role, c.is_active, c.created_at
    FROM public.clients c
    WHERE c.is_active = TRUE
    ORDER BY c.name;
  ELSE
    -- Return only clients user has membership for
    RETURN QUERY
    SELECT c.id, c.name, c.slug, c.description, c.logo_url, cm.role, c.is_active, c.created_at
    FROM public.clients c
    INNER JOIN public.client_memberships cm ON cm.client_id = c.id
    WHERE cm.user_id = user_uuid AND c.is_active = TRUE
    ORDER BY c.name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 17. FUNCTION: Check client access with role
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_client_role(check_client_id UUID, check_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_profile_role TEXT;
  client_role TEXT;
BEGIN
  -- Check if user is org admin
  SELECT role INTO user_profile_role FROM public.profiles WHERE id = check_user_id;
  IF user_profile_role = 'admin' THEN
    RETURN 'admin';
  END IF;

  -- Get client membership role
  SELECT role INTO client_role
  FROM public.client_memberships
  WHERE client_id = check_client_id AND user_id = check_user_id;

  RETURN client_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===========================================
-- Done! Client access control is now set up.
-- ===========================================
