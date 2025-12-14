-- ===========================================
-- YourFellow Performance - Integrations Schema
-- ===========================================
-- Run this in Supabase SQL Editor after the main setup

-- 1. Create integrations table for OAuth connections
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_ads', 'meta_ads', 'google_analytics', 'hubspot')),

  -- OAuth tokens (encrypted at rest by Supabase)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Account info
  account_id TEXT,                    -- Google Ads Customer ID / Meta Ad Account ID
  account_name TEXT,
  scopes TEXT[],

  -- Status
  is_active BOOLEAN DEFAULT true,
  connection_status TEXT DEFAULT 'pending' CHECK (connection_status IN ('pending', 'connected', 'expired', 'error')),
  last_error TEXT,

  -- Sync info
  last_synced_at TIMESTAMPTZ,
  sync_frequency TEXT DEFAULT 'daily' CHECK (sync_frequency IN ('hourly', 'daily', 'weekly', 'manual')),

  -- Extra data
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One integration per provider per user
  UNIQUE(user_id, provider, account_id)
);

-- 2. Create analytics_cache table for storing fetched data
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE NOT NULL,

  -- Cache key
  data_type TEXT NOT NULL,            -- 'campaigns', 'ad_groups', 'ads', 'metrics'
  date_from DATE,
  date_to DATE,

  -- Cached data
  data JSONB NOT NULL,

  -- Cache management
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),

  -- Prevent duplicate cache entries
  UNIQUE(integration_id, data_type, date_from, date_to)
);

-- 3. Create integration_logs for audit trail
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  action TEXT NOT NULL,               -- 'connect', 'disconnect', 'sync', 'refresh_token', 'error'
  provider TEXT NOT NULL,
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for integrations
CREATE POLICY "Users can view own integrations"
  ON public.integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON public.integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON public.integrations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON public.integrations FOR DELETE
  USING (auth.uid() = user_id);

-- 6. RLS Policies for analytics_cache
CREATE POLICY "Users can view own analytics cache"
  ON public.analytics_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.integrations
      WHERE id = analytics_cache.integration_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own analytics cache"
  ON public.analytics_cache FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.integrations
      WHERE id = analytics_cache.integration_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own analytics cache"
  ON public.analytics_cache FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.integrations
      WHERE id = analytics_cache.integration_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own analytics cache"
  ON public.analytics_cache FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.integrations
      WHERE id = analytics_cache.integration_id
      AND user_id = auth.uid()
    )
  );

-- 7. RLS Policies for integration_logs
CREATE POLICY "Users can view own integration logs"
  ON public.integration_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integration logs"
  ON public.integration_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON public.integrations(connection_status);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_integration ON public.analytics_cache(integration_id);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON public.analytics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_integration_logs_user ON public.integration_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON public.integration_logs(integration_id);

-- 9. Trigger for updated_at on integrations
CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 10. Function to clean expired cache
CREATE OR REPLACE FUNCTION public.clean_expired_analytics_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.analytics_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to log integration actions
CREATE OR REPLACE FUNCTION public.log_integration_action(
  p_integration_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_provider TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.integration_logs (integration_id, user_id, action, provider, details)
  VALUES (p_integration_id, p_user_id, p_action, p_provider, p_details)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done!
-- Run this after supabase-setup.sql
