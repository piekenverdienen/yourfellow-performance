-- ============================================
-- Meta Ad Creatives Setup
-- ============================================
-- This migration adds a table for storing Meta Ad creative data.
-- Creatives are synced from the Meta Ads API alongside performance data.
--
-- Purpose:
-- - Store ad creative content (title, body, CTA, images)
-- - Enable "Top Ads" analysis with creative context
-- - Support AI analysis of what makes ads perform
-- ============================================

-- ============================================
-- Table: meta_ad_creatives
-- ============================================
-- Stores creative data for each ad

CREATE TABLE IF NOT EXISTS meta_ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,

  -- Ad identification
  ad_id TEXT NOT NULL,
  ad_name TEXT,

  -- Creative identification
  creative_id TEXT,

  -- Creative content
  title TEXT,
  body TEXT,
  cta_type TEXT,                    -- e.g., 'SHOP_NOW', 'LEARN_MORE', 'SIGN_UP'

  -- Media
  image_url TEXT,
  thumbnail_url TEXT,
  video_id TEXT,

  -- Landing page
  link_url TEXT,

  -- Status from Meta
  ad_status TEXT,                   -- 'ACTIVE', 'PAUSED', etc.
  effective_status TEXT,

  -- Raw data for future use
  raw_creative_json JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for upserts: one creative per ad per client/account
  CONSTRAINT meta_ad_creatives_unique UNIQUE (client_id, ad_account_id, ad_id)
);

-- ============================================
-- Indexes
-- ============================================

-- Primary lookup: by client and ad account
CREATE INDEX IF NOT EXISTS idx_meta_creatives_client_account
  ON meta_ad_creatives(client_id, ad_account_id);

-- Lookup by ad_id (for joining with insights)
CREATE INDEX IF NOT EXISTS idx_meta_creatives_ad_id
  ON meta_ad_creatives(ad_id);

-- Filter by status
CREATE INDEX IF NOT EXISTS idx_meta_creatives_status
  ON meta_ad_creatives(ad_status) WHERE ad_status IS NOT NULL;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE meta_ad_creatives ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can only see creatives for clients they have access to
CREATE POLICY "meta_creatives_select_policy" ON meta_ad_creatives
  FOR SELECT
  USING (
    has_client_access(client_id, 'viewer')
  );

-- INSERT: Editors and above can insert
CREATE POLICY "meta_creatives_insert_policy" ON meta_ad_creatives
  FOR INSERT
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

-- UPDATE: Editors and above can update
CREATE POLICY "meta_creatives_update_policy" ON meta_ad_creatives
  FOR UPDATE
  USING (
    has_client_access(client_id, 'editor')
  )
  WITH CHECK (
    has_client_access(client_id, 'editor')
  );

-- DELETE: Admins only
CREATE POLICY "meta_creatives_delete_policy" ON meta_ad_creatives
  FOR DELETE
  USING (
    has_client_access(client_id, 'admin')
  );

-- ============================================
-- Updated_at Trigger
-- ============================================

CREATE TRIGGER meta_creatives_updated_at
  BEFORE UPDATE ON meta_ad_creatives
  FOR EACH ROW
  EXECUTE FUNCTION update_meta_updated_at();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE meta_ad_creatives IS 'Creative content for Meta Ads - synced from API';
COMMENT ON COLUMN meta_ad_creatives.ad_id IS 'Meta Ad ID - links to meta_insights_daily.entity_id';
COMMENT ON COLUMN meta_ad_creatives.cta_type IS 'Call-to-action type: SHOP_NOW, LEARN_MORE, SIGN_UP, etc.';
COMMENT ON COLUMN meta_ad_creatives.raw_creative_json IS 'Full creative object from Meta API for future use';
