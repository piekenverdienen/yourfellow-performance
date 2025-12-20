-- =============================================================================
-- Viral Hub Database Schema
-- =============================================================================
-- This migration adds:
-- 1. viral_sources - Configurable signal sources (Reddit, YouTube, etc.)
-- 2. viral_signals - Trending posts/content from sources
-- 3. viral_opportunities - AI-processed content opportunities
-- 4. viral_generations - Generated content packages
-- =============================================================================

-- =============================================================================
-- 1. VIRAL SOURCES TABLE
-- =============================================================================
-- Stores configuration for different signal sources (Reddit first, extensible)

CREATE TYPE viral_source_type AS ENUM ('reddit', 'youtube', 'tiktok', 'twitter', 'hackernews');

CREATE TABLE IF NOT EXISTS viral_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  type viral_source_type NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Configuration (JSON for flexibility)
  config JSONB NOT NULL DEFAULT '{}',
  -- Example Reddit config: { "subreddits": ["marketing", "entrepreneur"], "query": "viral marketing" }
  -- Example YouTube config: { "channels": [], "search_query": "marketing tips" }

  -- Industry/niche targeting
  industry VARCHAR(100),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Rate limiting
  last_fetched_at TIMESTAMPTZ,
  fetch_interval_minutes INTEGER DEFAULT 60,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_viral_sources_type ON viral_sources(type);
CREATE INDEX idx_viral_sources_industry ON viral_sources(industry);
CREATE INDEX idx_viral_sources_active ON viral_sources(is_active) WHERE is_active = true;

-- =============================================================================
-- 2. VIRAL SIGNALS TABLE
-- =============================================================================
-- Stores raw signals from sources (trending posts, videos, etc.)

CREATE TABLE IF NOT EXISTS viral_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source reference
  source_id UUID REFERENCES viral_sources(id) ON DELETE SET NULL,
  source_type viral_source_type NOT NULL,

  -- External identification
  external_id TEXT NOT NULL,  -- e.g., Reddit post ID
  url TEXT NOT NULL,

  -- Content info
  title TEXT NOT NULL,
  author TEXT,
  community TEXT,  -- e.g., subreddit name

  -- Timing
  created_at_external TIMESTAMPTZ,  -- When the content was posted

  -- Engagement metrics (JSONB for flexibility across sources)
  metrics JSONB NOT NULL DEFAULT '{}',
  -- Reddit: { "upvotes": 1234, "comments": 56, "upvote_ratio": 0.95, "awards": 3 }
  -- YouTube: { "views": 50000, "likes": 2000, "comments": 150 }

  -- Content excerpt (truncated for compliance - no full content storage)
  raw_excerpt TEXT,  -- Max ~500 chars, just for context

  -- Processing status
  is_processed BOOLEAN DEFAULT false,

  -- Industry classification
  industry VARCHAR(100),

  -- Metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint to prevent duplicates
  CONSTRAINT viral_signals_unique_source_external UNIQUE (source_type, external_id)
);

-- Indexes for common queries
CREATE INDEX idx_viral_signals_source ON viral_signals(source_id);
CREATE INDEX idx_viral_signals_industry ON viral_signals(industry);
CREATE INDEX idx_viral_signals_fetched ON viral_signals(fetched_at);
CREATE INDEX idx_viral_signals_external_time ON viral_signals(created_at_external);
CREATE INDEX idx_viral_signals_processed ON viral_signals(is_processed) WHERE is_processed = false;

-- GIN index for metrics queries
CREATE INDEX idx_viral_signals_metrics ON viral_signals USING GIN (metrics);

-- =============================================================================
-- 3. VIRAL OPPORTUNITIES TABLE
-- =============================================================================
-- AI-processed content opportunities derived from signals

CREATE TYPE viral_channel AS ENUM ('youtube', 'instagram', 'blog');
CREATE TYPE viral_opportunity_status AS ENUM ('new', 'shortlisted', 'generated', 'archived');

CREATE TABLE IF NOT EXISTS viral_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client association (optional for internal use)
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Targeting
  industry TEXT NOT NULL,
  channel viral_channel NOT NULL,

  -- Opportunity content
  topic TEXT NOT NULL,
  angle TEXT NOT NULL,
  hook TEXT NOT NULL,
  reasoning TEXT NOT NULL,  -- Why this will likely perform well

  -- Scoring
  score NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 0-100
  score_breakdown JSONB NOT NULL DEFAULT '{}',
  -- Example: {
  --   "engagement": 25,
  --   "freshness": 20,
  --   "relevance": 30,
  --   "novelty": 15,
  --   "seasonality": 10
  -- }

  -- Source references
  source_signal_ids UUID[] NOT NULL DEFAULT '{}',

  -- Status workflow
  status viral_opportunity_status DEFAULT 'new',

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_viral_opportunities_client ON viral_opportunities(client_id);
CREATE INDEX idx_viral_opportunities_industry ON viral_opportunities(industry);
CREATE INDEX idx_viral_opportunities_channel ON viral_opportunities(channel);
CREATE INDEX idx_viral_opportunities_status ON viral_opportunities(status);
CREATE INDEX idx_viral_opportunities_score ON viral_opportunities(score DESC);
CREATE INDEX idx_viral_opportunities_created ON viral_opportunities(created_at);

-- GIN index for signal references
CREATE INDEX idx_viral_opportunities_signals ON viral_opportunities USING GIN (source_signal_ids);

-- =============================================================================
-- 4. VIRAL GENERATIONS TABLE
-- =============================================================================
-- Stores generated content packages for opportunities

CREATE TABLE IF NOT EXISTS viral_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Opportunity reference
  opportunity_id UUID REFERENCES viral_opportunities(id) ON DELETE CASCADE NOT NULL,

  -- AI task used
  task VARCHAR(50) NOT NULL,  -- e.g., 'viral_ig_package', 'viral_youtube_script'

  -- Generated output
  output JSONB NOT NULL,  -- Structured content based on task
  -- IG: { "caption": "...", "hooks": [...], "hashtags": [...], "carousel_slides": [...] }
  -- YouTube: { "titles": [...], "hook": "...", "outline": [...], "script": "...", "cta": "...", "broll": [...] }
  -- Blog: { "title": "...", "meta": "...", "keywords": [...], "sections": [...], "draft": "..." }

  -- Model info
  model_id VARCHAR(50),
  tokens JSONB DEFAULT '{}',  -- { "input": 500, "output": 1200, "total": 1700 }

  -- Version control
  version INTEGER DEFAULT 1,

  -- User attribution
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_viral_generations_opportunity ON viral_generations(opportunity_id);
CREATE INDEX idx_viral_generations_task ON viral_generations(task);
CREATE INDEX idx_viral_generations_created ON viral_generations(created_at);

-- =============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE viral_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_generations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS POLICIES
-- =============================================================================

-- Viral Sources: Authenticated users can read, admins can manage
CREATE POLICY "Authenticated users can read active sources"
  ON viral_sources FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Admins can manage sources"
  ON viral_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Viral Signals: All authenticated users can read
CREATE POLICY "Authenticated users can read signals"
  ON viral_signals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert signals"
  ON viral_signals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Viral Opportunities: Users can see all internal, or own client's
CREATE POLICY "Users can read opportunities"
  ON viral_opportunities FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      client_id IS NULL  -- Internal opportunities visible to all authenticated
      OR EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = client_id
        AND (
          c.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM client_users cu
            WHERE cu.client_id = c.id
            AND cu.user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "Users can create opportunities"
  ON viral_opportunities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own opportunities"
  ON viral_opportunities FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

-- Viral Generations: Users can manage their own generations
CREATE POLICY "Users can read generations"
  ON viral_generations FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM viral_opportunities vo
      WHERE vo.id = opportunity_id
      AND (
        vo.client_id IS NULL
        OR vo.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create generations"
  ON viral_generations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- 7. HELPER FUNCTIONS
-- =============================================================================

-- Function to get viral signals for an industry within a time window
CREATE OR REPLACE FUNCTION get_viral_signals_for_industry(
  p_industry TEXT,
  p_days INTEGER DEFAULT 7,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  source_type viral_source_type,
  external_id TEXT,
  url TEXT,
  title TEXT,
  author TEXT,
  community TEXT,
  created_at_external TIMESTAMPTZ,
  metrics JSONB,
  raw_excerpt TEXT,
  fetched_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.source_type,
    s.external_id,
    s.url,
    s.title,
    s.author,
    s.community,
    s.created_at_external,
    s.metrics,
    s.raw_excerpt,
    s.fetched_at
  FROM viral_signals s
  WHERE s.industry = p_industry
    AND s.fetched_at >= NOW() - (p_days || ' days')::INTERVAL
  ORDER BY (s.metrics->>'upvotes')::INTEGER DESC NULLS LAST,
           s.created_at_external DESC
  LIMIT p_limit;
END;
$$;

-- Function to get top opportunities by score
CREATE OR REPLACE FUNCTION get_top_opportunities(
  p_industry TEXT DEFAULT NULL,
  p_channel viral_channel DEFAULT NULL,
  p_status viral_opportunity_status DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  industry TEXT,
  channel viral_channel,
  topic TEXT,
  angle TEXT,
  hook TEXT,
  reasoning TEXT,
  score NUMERIC,
  score_breakdown JSONB,
  source_signal_ids UUID[],
  status viral_opportunity_status,
  client_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.industry,
    o.channel,
    o.topic,
    o.angle,
    o.hook,
    o.reasoning,
    o.score,
    o.score_breakdown,
    o.source_signal_ids,
    o.status,
    o.client_id,
    o.created_at
  FROM viral_opportunities o
  WHERE (p_industry IS NULL OR o.industry = p_industry)
    AND (p_channel IS NULL OR o.channel = p_channel)
    AND (p_status IS NULL OR o.status = p_status)
    AND (p_client_id IS NULL OR o.client_id = p_client_id)
  ORDER BY o.score DESC, o.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to calculate signal engagement score (normalized 0-100)
CREATE OR REPLACE FUNCTION calculate_signal_engagement_score(p_metrics JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  upvotes INTEGER;
  comments INTEGER;
  upvote_ratio NUMERIC;
  score NUMERIC;
BEGIN
  upvotes := COALESCE((p_metrics->>'upvotes')::INTEGER, 0);
  comments := COALESCE((p_metrics->>'comments')::INTEGER, 0);
  upvote_ratio := COALESCE((p_metrics->>'upvote_ratio')::NUMERIC, 0.5);

  -- Normalize: upvotes (max 10000 = 40pts), comments (max 500 = 30pts), ratio (30pts)
  score := LEAST(upvotes / 250.0, 40) +
           LEAST(comments / 16.67, 30) +
           (upvote_ratio * 30);

  RETURN LEAST(score, 100);
END;
$$;

-- Function to update opportunity status
CREATE OR REPLACE FUNCTION update_opportunity_status(
  p_opportunity_id UUID,
  p_status viral_opportunity_status
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE viral_opportunities
  SET status = p_status, updated_at = NOW()
  WHERE id = p_opportunity_id
    AND (created_by = auth.uid() OR created_by IS NULL OR
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

  RETURN FOUND;
END;
$$;

-- =============================================================================
-- 8. UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_viral_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER viral_sources_updated_at
  BEFORE UPDATE ON viral_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_viral_updated_at();

CREATE TRIGGER viral_opportunities_updated_at
  BEFORE UPDATE ON viral_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_viral_updated_at();

-- =============================================================================
-- 9. SEED DEFAULT SOURCES (Reddit)
-- =============================================================================

INSERT INTO viral_sources (type, name, description, industry, config, is_active)
VALUES
  (
    'reddit',
    'Marketing & Growth',
    'Marketing-focused subreddits for growth and viral content ideas',
    'marketing',
    '{
      "subreddits": ["marketing", "digitalmarketing", "growthmarketing", "socialmedia", "entrepreneur"],
      "sort": "hot",
      "time_filter": "day",
      "limit": 25
    }'::JSONB,
    true
  ),
  (
    'reddit',
    'E-commerce & DTC',
    'E-commerce and direct-to-consumer subreddits',
    'ecommerce',
    '{
      "subreddits": ["ecommerce", "shopify", "dropship", "FulfillmentByAmazon", "smallbusiness"],
      "sort": "hot",
      "time_filter": "day",
      "limit": 25
    }'::JSONB,
    true
  ),
  (
    'reddit',
    'Tech & SaaS',
    'Technology and SaaS-focused communities',
    'technology',
    '{
      "subreddits": ["startups", "SaaS", "webdev", "programming", "technology"],
      "sort": "hot",
      "time_filter": "day",
      "limit": 25
    }'::JSONB,
    true
  ),
  (
    'reddit',
    'Content Creation',
    'Content creation and creator economy communities',
    'content',
    '{
      "subreddits": ["content_marketing", "youtubers", "NewTubers", "Instagram", "TikTokCreators"],
      "sort": "hot",
      "time_filter": "day",
      "limit": 25
    }'::JSONB,
    true
  )
ON CONFLICT DO NOTHING;
