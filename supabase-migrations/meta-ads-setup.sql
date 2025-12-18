-- ============================================
-- Meta Ads Integration Setup
-- ============================================
-- This migration adds tables for Meta (Facebook/Instagram) Ads data.
-- Follows existing RLS patterns from the codebase.
--
-- Tables created:
-- 1. meta_insights_daily - Daily performance metrics
-- 2. meta_fatigue_signals - Creative fatigue detection
-- 3. meta_ai_insights - AI-generated performance insights
--
-- Note: Meta settings are stored in clients.settings.meta (JSONB)
-- ============================================

-- ============================================
-- Table: meta_insights_daily
-- ============================================
-- Stores daily performance metrics for Meta Ads entities
-- (campaigns, adsets, ads)

CREATE TABLE IF NOT EXISTS meta_insights_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,

  -- Entity identification
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account', 'campaign', 'adset', 'ad')),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,

  -- Parent references (for hierarchy)
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,

  -- Date
  date DATE NOT NULL,

  -- Core metrics
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(12, 2) DEFAULT 0,

  -- Engagement metrics
  ctr DECIMAL(8, 4) DEFAULT 0,       -- Click-through rate (%)
  cpc DECIMAL(10, 4) DEFAULT 0,      -- Cost per click
  cpm DECIMAL(10, 4) DEFAULT 0,      -- Cost per 1000 impressions
  frequency DECIMAL(6, 2) DEFAULT 0, -- Avg impressions per user

  -- Conversion metrics
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(12, 2) DEFAULT 0,
  cost_per_conversion DECIMAL(10, 4) DEFAULT 0,
  roas DECIMAL(8, 4) DEFAULT 0,      -- Return on ad spend

  -- Video metrics (optional)
  video_views INTEGER,
  video_p25_watched INTEGER,
  video_p50_watched INTEGER,
  video_p75_watched INTEGER,
  video_p100_watched INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for upserts
  CONSTRAINT meta_insights_unique UNIQUE (client_id, ad_account_id, entity_type, entity_id, date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_meta_insights_client_date
  ON meta_insights_daily(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_account_date
  ON meta_insights_daily(ad_account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_entity
  ON meta_insights_daily(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign
  ON meta_insights_daily(campaign_id) WHERE campaign_id IS NOT NULL;

-- ============================================
-- Table: meta_fatigue_signals
-- ============================================
-- Stores detected creative fatigue signals

CREATE TABLE IF NOT EXISTS meta_fatigue_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,

  -- Entity identification
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'adset', 'ad')),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  campaign_name TEXT,
  adset_name TEXT,

  -- Current metrics
  current_frequency DECIMAL(6, 2) NOT NULL,
  current_ctr DECIMAL(8, 4) NOT NULL,
  current_cpc DECIMAL(10, 4) NOT NULL,

  -- Baseline metrics (rolling 7-day average)
  baseline_frequency DECIMAL(6, 2) NOT NULL,
  baseline_ctr DECIMAL(8, 4) NOT NULL,
  baseline_cpc DECIMAL(10, 4) NOT NULL,

  -- Changes (percentage)
  frequency_change DECIMAL(8, 2) NOT NULL,
  ctr_change DECIMAL(8, 2) NOT NULL,
  cpc_change DECIMAL(8, 2) NOT NULL,

  -- Detection details
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reasons TEXT[] NOT NULL DEFAULT '{}',
  suggested_actions TEXT[] NOT NULL DEFAULT '{}',

  -- Status tracking
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),

  -- Timestamps
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meta_fatigue_client
  ON meta_fatigue_signals(client_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_fatigue_severity
  ON meta_fatigue_signals(severity, is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_meta_fatigue_entity
  ON meta_fatigue_signals(entity_type, entity_id);

-- ============================================
-- Table: meta_ai_insights
-- ============================================
-- Stores AI-generated performance insights

CREATE TABLE IF NOT EXISTS meta_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,

  -- Period
  insight_type TEXT NOT NULL CHECK (insight_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- AI-generated content (stored as JSONB for flexibility)
  executive_summary TEXT NOT NULL,
  top_performers JSONB DEFAULT '[]',
  problems JSONB DEFAULT '[]',
  opportunities JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',

  -- Metrics summary
  metrics_summary JSONB DEFAULT '{}',

  -- Timestamps
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint (one insight per period)
  CONSTRAINT meta_ai_insights_unique UNIQUE (client_id, ad_account_id, insight_type, period_start, period_end)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meta_ai_insights_client
  ON meta_ai_insights(client_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_ai_insights_period
  ON meta_ai_insights(period_start, period_end);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE meta_insights_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_fatigue_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ai_insights ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies: meta_insights_daily
-- ============================================

-- SELECT: Users can only see insights for clients they have access to
CREATE POLICY "meta_insights_select_policy" ON meta_insights_daily
  FOR SELECT
  USING (
    has_client_access(client_id, 'viewer')
  );

-- INSERT: Editors and above can insert
CREATE POLICY "meta_insights_insert_policy" ON meta_insights_daily
  FOR INSERT
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

-- UPDATE: Editors and above can update
CREATE POLICY "meta_insights_update_policy" ON meta_insights_daily
  FOR UPDATE
  USING (
    has_client_access(client_id, 'editor')
  )
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

-- DELETE: Admins only
CREATE POLICY "meta_insights_delete_policy" ON meta_insights_daily
  FOR DELETE
  USING (
    has_client_access(client_id, 'admin')
  );

-- ============================================
-- RLS Policies: meta_fatigue_signals
-- ============================================

CREATE POLICY "meta_fatigue_select_policy" ON meta_fatigue_signals
  FOR SELECT
  USING (
    has_client_access(client_id, 'viewer')
  );

CREATE POLICY "meta_fatigue_insert_policy" ON meta_fatigue_signals
  FOR INSERT
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

CREATE POLICY "meta_fatigue_update_policy" ON meta_fatigue_signals
  FOR UPDATE
  USING (
    has_client_access(client_id, 'editor')
  )
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

CREATE POLICY "meta_fatigue_delete_policy" ON meta_fatigue_signals
  FOR DELETE
  USING (
    has_client_access(client_id, 'admin')
  );

-- ============================================
-- RLS Policies: meta_ai_insights
-- ============================================

CREATE POLICY "meta_ai_insights_select_policy" ON meta_ai_insights
  FOR SELECT
  USING (
    has_client_access(client_id, 'viewer')
  );

CREATE POLICY "meta_ai_insights_insert_policy" ON meta_ai_insights
  FOR INSERT
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

CREATE POLICY "meta_ai_insights_update_policy" ON meta_ai_insights
  FOR UPDATE
  USING (
    has_client_access(client_id, 'editor')
  )
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

CREATE POLICY "meta_ai_insights_delete_policy" ON meta_ai_insights
  FOR DELETE
  USING (
    has_client_access(client_id, 'admin')
  );

-- ============================================
-- Updated_at Triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_meta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meta_insights_updated_at
  BEFORE UPDATE ON meta_insights_daily
  FOR EACH ROW
  EXECUTE FUNCTION update_meta_updated_at();

CREATE TRIGGER meta_fatigue_updated_at
  BEFORE UPDATE ON meta_fatigue_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_meta_updated_at();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE meta_insights_daily IS 'Daily performance metrics from Meta Ads API';
COMMENT ON TABLE meta_fatigue_signals IS 'Detected creative fatigue signals for Meta Ads';
COMMENT ON TABLE meta_ai_insights IS 'AI-generated performance insights for Meta Ads';

COMMENT ON COLUMN meta_insights_daily.entity_type IS 'Type of entity: account, campaign, adset, or ad';
COMMENT ON COLUMN meta_insights_daily.roas IS 'Return on Ad Spend: conversion_value / spend';
COMMENT ON COLUMN meta_fatigue_signals.severity IS 'Fatigue severity: low, medium, high, or critical';
COMMENT ON COLUMN meta_ai_insights.insight_type IS 'Insight period: daily, weekly, or monthly';
