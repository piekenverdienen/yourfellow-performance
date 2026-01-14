-- ===========================================
-- YourFellow Performance - Invite System
-- ===========================================
-- Allows admins to invite users to clients via email link
-- Users who accept are automatically approved

-- ===========================================
-- 1. INVITES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who is invited
  email TEXT NOT NULL,

  -- To which client and with what role
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),

  -- Unique token for the invite link
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Who sent the invite
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Optional personal message
  message TEXT,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),

  -- Timestamps
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate pending invites for same email/client
  UNIQUE(email, client_id, status) WHERE status = 'pending'
);

-- ===========================================
-- 2. INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_client_id ON public.invites(client_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON public.invites(status);
CREATE INDEX IF NOT EXISTS idx_invites_invited_by ON public.invites(invited_by);

-- ===========================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. RLS POLICIES
-- ===========================================

-- Org admins can see all invites
-- Client admins can see invites for their clients
CREATE POLICY "Users can view invites for accessible clients"
  ON public.invites FOR SELECT
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'admin')
  );

-- Only org admins or client admins can create invites
CREATE POLICY "Admins can create invites"
  ON public.invites FOR INSERT
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'admin')
  );

-- Only the inviter or org admin can update (revoke) invites
CREATE POLICY "Admins can update invites"
  ON public.invites FOR UPDATE
  USING (
    is_org_admin()
    OR invited_by = auth.uid()
    OR has_client_access(client_id, 'admin')
  );

-- ===========================================
-- 5. FUNCTION: Accept invite
-- ===========================================
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
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Je moet ingelogd zijn om een invite te accepteren'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Find the invite
  SELECT i.*, c.name INTO v_invite
  FROM public.invites i
  JOIN public.clients c ON c.id = i.client_id
  WHERE i.token = invite_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invite niet gevonden'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Check if invite is still valid
  IF v_invite.status != 'pending' THEN
    RETURN QUERY SELECT FALSE, 'Deze invite is al gebruikt of ingetrokken'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at < NOW() THEN
    -- Mark as expired
    UPDATE public.invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN QUERY SELECT FALSE, 'Deze invite is verlopen'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Check if user already has membership
  SELECT id INTO v_existing_membership
  FROM public.client_memberships
  WHERE client_id = v_invite.client_id AND user_id = v_user_id;

  IF FOUND THEN
    -- Update existing membership to approved (in case it was pending/rejected)
    UPDATE public.client_memberships
    SET
      role = v_invite.role,
      approval_status = 'approved',
      approved_by = v_invite.invited_by,
      approved_at = NOW()
    WHERE id = v_existing_membership;
  ELSE
    -- Create new membership (auto-approved via invite)
    INSERT INTO public.client_memberships (
      client_id,
      user_id,
      role,
      approval_status,
      approved_by,
      approved_at,
      requested_by
    ) VALUES (
      v_invite.client_id,
      v_user_id,
      v_invite.role,
      'approved',
      v_invite.invited_by,
      NOW(),
      v_invite.invited_by
    );
  END IF;

  -- Mark invite as accepted
  UPDATE public.invites
  SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by = v_user_id
  WHERE id = v_invite.id;

  -- Return success
  v_client_name := v_invite.name;
  RETURN QUERY SELECT TRUE, 'Je hebt nu toegang tot ' || v_client_name, v_invite.client_id, v_client_name, v_invite.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 6. FUNCTION: Get invite details (public, for accept page)
-- ===========================================
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
  SELECT
    i.*,
    c.name as client_name,
    p.full_name as inviter_name
  INTO v_invite
  FROM public.invites i
  JOIN public.clients c ON c.id = i.client_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.token = invite_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'not_found'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Check expiration
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 7. TRIGGER: Auto-expire old invites
-- ===========================================
CREATE OR REPLACE FUNCTION public.expire_old_invites()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.invites
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Run cleanup on any invite table change (or schedule via cron)
DROP TRIGGER IF EXISTS trigger_expire_invites ON public.invites;
CREATE TRIGGER trigger_expire_invites
  AFTER INSERT OR UPDATE ON public.invites
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.expire_old_invites();

-- ===========================================
-- Done! Invite system is now set up.
-- ===========================================
