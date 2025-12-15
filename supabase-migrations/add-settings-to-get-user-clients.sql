-- Migration: Add settings column to get_user_clients function
-- Run this in your Supabase SQL Editor to enable ClickUp integration on dashboard

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
    -- Return only clients user has membership for
    RETURN QUERY
    SELECT c.id, c.name, c.slug, c.description, c.logo_url, c.settings, cm.role, c.is_active, c.created_at
    FROM public.clients c
    INNER JOIN public.client_memberships cm ON cm.client_id = c.id
    WHERE cm.user_id = user_uuid AND c.is_active = TRUE
    ORDER BY c.name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
