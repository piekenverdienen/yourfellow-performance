-- ===========================================
-- YourFellow Performance - COMPLETE DATABASE SETUP
-- ===========================================
-- Dit bestand bevat ALLES wat je nodig hebt.
-- Voer dit uit in Supabase SQL Editor.
-- ===========================================

-- ===========================================
-- DEEL 1: BASIS TABELLEN EN FUNCTIES
-- ===========================================

-- 1.1 Profiles tabel (koppeling met auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'marketer' CHECK (role IN ('admin', 'marketer', 'client')),
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  company_name TEXT,
  industry TEXT,
  preferred_tone TEXT DEFAULT 'professional' CHECK (preferred_tone IN ('professional', 'casual', 'friendly', 'formal', 'creative')),
  preferred_language TEXT DEFAULT 'nl',
  target_audience TEXT,
  brand_voice TEXT,
  total_generations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Usage tracking tabel
CREATE TABLE IF NOT EXISTS public.usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  tool TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Generations tabel
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  tool TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Marketing events tabel
CREATE TABLE IF NOT EXISTS public.marketing_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_type TEXT DEFAULT 'campaign' CHECK (event_type IN ('holiday', 'sale', 'campaign', 'deadline')),
  color TEXT DEFAULT '#00FFCC',
  created_by UUID REFERENCES public.profiles,
  is_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 Enable RLS op basis tabellen
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

-- 1.6 Helper functie: update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.7 Trigger voor profiles updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 1.8 Functie: handle_new_user (automatisch profiel bij signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.9 Trigger voor nieuwe gebruiker
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- DEEL 2: CLIENTS EN MEMBERSHIPS
-- ===========================================

-- 2.1 Clients tabel
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

-- 2.2 Client memberships tabel (met approval velden)
CREATE TABLE IF NOT EXISTS public.client_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  -- Approval workflow velden
  approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, user_id)
);

-- 2.3 Enable RLS op clients tabellen
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_memberships ENABLE ROW LEVEL SECURITY;

-- 2.4 Indexes voor clients
CREATE INDEX IF NOT EXISTS idx_clients_slug ON public.clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_client_memberships_client_id ON public.client_memberships(client_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_user_id ON public.client_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_approval_status ON public.client_memberships(approval_status);

-- 2.5 Triggers voor clients
DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS client_memberships_updated_at ON public.client_memberships;
CREATE TRIGGER client_memberships_updated_at
  BEFORE UPDATE ON public.client_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================
-- DEEL 3: INVITES TABEL
-- ===========================================

CREATE TABLE IF NOT EXISTS public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique index voor pending invites
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_unique_pending
  ON public.invites(email, client_id)
  WHERE status = 'pending';

-- Indexes voor invites
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_client_id ON public.invites(client_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON public.invites(status);

-- Enable RLS op invites
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- DEEL 4: HELPER FUNCTIES (ZONDER RECURSIE)
-- ===========================================

-- 4.1 is_org_admin functie
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated;

-- 4.2 has_client_access functie (met approval check)
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
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;

  -- Check of user org admin is
  SELECT role INTO user_profile_role FROM public.profiles WHERE id = v_user_id;
  IF user_profile_role = 'admin' THEN RETURN TRUE; END IF;

  -- Check client membership
  SELECT role, COALESCE(approval_status, 'approved') INTO user_role, user_approval_status
  FROM public.client_memberships
  WHERE client_id = check_client_id AND user_id = v_user_id;

  IF user_role IS NULL THEN RETURN FALSE; END IF;
  IF user_approval_status != 'approved' THEN RETURN FALSE; END IF;

  user_role_index := array_position(role_hierarchy, user_role);
  min_role_index := array_position(role_hierarchy, min_role);
  RETURN user_role_index >= min_role_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.has_client_access(UUID, TEXT) TO authenticated;

-- 4.3 get_client_role functie
CREATE OR REPLACE FUNCTION public.get_client_role(check_client_id UUID, check_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_profile_role TEXT;
  client_role TEXT;
  client_approval_status TEXT;
BEGIN
  SELECT role INTO user_profile_role FROM public.profiles WHERE id = check_user_id;
  IF user_profile_role = 'admin' THEN RETURN 'admin'; END IF;

  SELECT role, approval_status INTO client_role, client_approval_status
  FROM public.client_memberships
  WHERE client_id = check_client_id AND user_id = check_user_id;

  IF client_approval_status = 'approved' THEN
    RETURN client_role;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_client_role(UUID, UUID) TO authenticated;

-- 4.4 get_user_clients functie
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
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_uuid AND p.role = 'admin') THEN
    RETURN QUERY
    SELECT c.id, c.name, c.slug, c.description, c.logo_url, c.settings, 'admin'::TEXT as role, c.is_active, c.created_at
    FROM public.clients c
    WHERE c.is_active = TRUE
    ORDER BY c.name;
  ELSE
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_user_clients(UUID) TO authenticated;

-- ===========================================
-- DEEL 5: RLS POLICIES (ZONDER RECURSIE)
-- ===========================================

-- 5.1 Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5.2 Clients policies
DROP POLICY IF EXISTS "Users can view accessible clients" ON public.clients;
DROP POLICY IF EXISTS "Org admins can create clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can update clients" ON public.clients;
DROP POLICY IF EXISTS "Org admins can delete clients" ON public.clients;

CREATE POLICY "Users can view accessible clients"
  ON public.clients FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admins can update clients"
  ON public.clients FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = id AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved' AND cm.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Org admins can delete clients"
  ON public.clients FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 5.3 Client memberships policies (ZONDER RECURSIE!)
DROP POLICY IF EXISTS "Users can view memberships for accessible clients" ON public.client_memberships;
DROP POLICY IF EXISTS "Users can view memberships for accessible clients or own pending" ON public.client_memberships;
DROP POLICY IF EXISTS "Users can view their own memberships or all if org admin" ON public.client_memberships;
DROP POLICY IF EXISTS "Admins can add memberships" ON public.client_memberships;
DROP POLICY IF EXISTS "Admins can update memberships" ON public.client_memberships;
DROP POLICY IF EXISTS "Admins can delete memberships" ON public.client_memberships;

CREATE POLICY "Users can view their own memberships or all if org admin"
  ON public.client_memberships FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm2
      WHERE cm2.client_id = client_memberships.client_id
        AND cm2.user_id = auth.uid()
        AND cm2.approval_status = 'approved'
        AND cm2.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can add memberships"
  ON public.client_memberships FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = client_memberships.client_id
        AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved'
        AND cm.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update memberships"
  ON public.client_memberships FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = client_memberships.client_id
        AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved'
        AND cm.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete memberships"
  ON public.client_memberships FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = client_memberships.client_id
        AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved'
        AND cm.role = 'owner'
    )
  );

-- 5.4 Invites policies (ZONDER RECURSIE!)
DROP POLICY IF EXISTS "Users can view invites for accessible clients" ON public.invites;
DROP POLICY IF EXISTS "Users can view invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can update invites" ON public.invites;

CREATE POLICY "Users can view invites"
  ON public.invites FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = invites.client_id
        AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved'
        AND cm.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can create invites"
  ON public.invites FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = invites.client_id
        AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved'
        AND cm.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update invites"
  ON public.invites FOR UPDATE
  USING (
    invited_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_memberships cm
      WHERE cm.client_id = invites.client_id
        AND cm.user_id = auth.uid()
        AND cm.approval_status = 'approved'
        AND cm.role IN ('admin', 'owner')
    )
  );

-- ===========================================
-- DEEL 6: INVITE FUNCTIES
-- ===========================================

-- 6.1 Accept invite functie
CREATE OR REPLACE FUNCTION public.accept_invite(invite_token TEXT)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  client_id UUID,
  client_name TEXT,
  role TEXT
) AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_client_name TEXT;
  v_existing_membership UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Je moet ingelogd zijn om een invite te accepteren'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  SELECT i.*, c.name INTO v_invite
  FROM public.invites i
  JOIN public.clients c ON c.id = i.client_id
  WHERE i.token = invite_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invite niet gevonden'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN QUERY SELECT FALSE, 'Deze invite is al gebruikt of ingetrokken'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at < NOW() THEN
    UPDATE public.invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN QUERY SELECT FALSE, 'Deze invite is verlopen'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  SELECT id INTO v_existing_membership
  FROM public.client_memberships
  WHERE client_id = v_invite.client_id AND user_id = v_user_id;

  IF FOUND THEN
    UPDATE public.client_memberships
    SET role = v_invite.role, approval_status = 'approved', approved_by = v_invite.invited_by, approved_at = NOW()
    WHERE id = v_existing_membership;
  ELSE
    INSERT INTO public.client_memberships (client_id, user_id, role, approval_status, approved_by, approved_at, requested_by)
    VALUES (v_invite.client_id, v_user_id, v_invite.role, 'approved', v_invite.invited_by, NOW(), v_invite.invited_by);
  END IF;

  UPDATE public.invites SET status = 'accepted', accepted_at = NOW(), accepted_by = v_user_id WHERE id = v_invite.id;

  v_client_name := v_invite.name;
  RETURN QUERY SELECT TRUE, 'Je hebt nu toegang tot ' || v_client_name, v_invite.client_id, v_client_name, v_invite.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT) TO authenticated;

-- 6.2 Get invite details functie (public)
CREATE OR REPLACE FUNCTION public.get_invite_details(invite_token TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  status TEXT,
  email TEXT,
  client_name TEXT,
  role TEXT,
  invited_by_name TEXT,
  message TEXT,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT i.*, c.name as client_name, p.full_name as inviter_name
  INTO v_invite
  FROM public.invites i
  JOIN public.clients c ON c.id = i.client_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.token = invite_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'not_found'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_invite.expires_at < NOW() AND v_invite.status = 'pending' THEN
    UPDATE public.invites SET status = 'expired' WHERE id = v_invite.id;
    v_invite.status := 'expired';
  END IF;

  RETURN QUERY SELECT
    v_invite.status = 'pending',
    v_invite.status,
    v_invite.email,
    v_invite.client_name,
    v_invite.role,
    v_invite.inviter_name,
    v_invite.message,
    v_invite.expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_invite_details(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_details(TEXT) TO anon;

-- ===========================================
-- DEEL 7: APPROVAL FUNCTIES
-- ===========================================

-- 7.1 Get pending memberships (voor admins)
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied: only org admins can view pending memberships';
  END IF;

  RETURN QUERY
  SELECT
    cm.id as membership_id, cm.client_id, c.name as client_name, c.slug as client_slug,
    cm.user_id, p.email as user_email, p.full_name as user_full_name,
    cm.role as requested_role, cm.request_reason,
    cm.requested_by as requested_by_id, rp.email as requested_by_email, cm.created_at
  FROM public.client_memberships cm
  INNER JOIN public.clients c ON c.id = cm.client_id
  INNER JOIN public.profiles p ON p.id = cm.user_id
  LEFT JOIN public.profiles rp ON rp.id = cm.requested_by
  WHERE cm.approval_status = 'pending'
  ORDER BY cm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_pending_memberships() TO authenticated;

-- 7.2 Approve membership
CREATE OR REPLACE FUNCTION public.approve_membership(membership_uuid UUID, approval_notes TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied: only org admins can approve memberships';
  END IF;

  UPDATE public.client_memberships
  SET approval_status = 'approved', approved_by = auth.uid(), approved_at = NOW(), rejected_at = NULL, rejection_reason = NULL
  WHERE id = membership_uuid AND approval_status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.approve_membership(UUID, TEXT) TO authenticated;

-- 7.3 Reject membership
CREATE OR REPLACE FUNCTION public.reject_membership(membership_uuid UUID, reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied: only org admins can reject memberships';
  END IF;

  UPDATE public.client_memberships
  SET approval_status = 'rejected', approved_by = auth.uid(), rejected_at = NOW(), rejection_reason = reason, approved_at = NULL
  WHERE id = membership_uuid AND approval_status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reject_membership(UUID, TEXT) TO authenticated;

-- ===========================================
-- DEEL 8: INDEXES VOOR PERFORMANCE
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON public.usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON public.usage(created_at);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_tool ON public.generations(tool);
CREATE INDEX IF NOT EXISTS idx_marketing_events_date ON public.marketing_events(event_date);

-- ===========================================
-- KLAAR!
-- ===========================================
-- Je database is nu volledig geconfigureerd met:
-- - Gebruikers (profiles)
-- - Clients en memberships
-- - Invite systeem
-- - Approval workflow
-- - RLS policies (zonder recursie)
-- ===========================================
