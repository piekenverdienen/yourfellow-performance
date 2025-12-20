-- =============================================================================
-- Migration: Canonical Content Briefs
-- =============================================================================
-- This migration adds the "Canonical Content Brief" layer to the Viral Hub:
-- 1. Adds top_comments to viral_signals for richer context
-- 2. Adds client_id to viral_sources for per-client configuration
-- 3. Creates canonical_briefs table (the core new concept)
-- 4. Creates brief_generations table (content generated from briefs)
-- 5. Updates RLS policies
-- =============================================================================

-- =============================================================================
-- 1. UPDATE VIRAL_SIGNALS: Add top_comments column
-- =============================================================================

ALTER TABLE viral_signals
ADD COLUMN IF NOT EXISTS top_comments JSONB DEFAULT '[]';

COMMENT ON COLUMN viral_signals.top_comments IS 'Top 5-10 comments from the post, truncated for context. Array of {author, text, score}';

-- =============================================================================
-- 2. UPDATE VIRAL_SOURCES: Add client_id for per-client configuration
-- =============================================================================

ALTER TABLE viral_sources
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_viral_sources_client ON viral_sources(client_id);

COMMENT ON COLUMN viral_sources.client_id IS 'Optional client association. NULL means industry-wide source.';

-- =============================================================================
-- 3. CREATE CANONICAL_BRIEFS TABLE
-- =============================================================================
-- The Canonical Content Brief is the central concept:
-- - Sits between "Ideas/Opportunities" and "Generated Content"
-- - Requires human approval before content generation
-- - All evidence/proof points are explicitly linked

CREATE TYPE brief_status AS ENUM ('draft', 'approved', 'rejected', 'superseded');

CREATE TABLE IF NOT EXISTS canonical_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client association (optional for internal-only demos)
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Link to source opportunity/idea
  idea_id UUID REFERENCES viral_opportunities(id) ON DELETE SET NULL,

  -- The Brief itself (fixed schema, short and opinionated)
  brief JSONB NOT NULL,
  -- Schema:
  -- {
  --   "core_tension": "The conflict/frustration driving engagement",
  --   "our_angle": "The stance/POV we take",
  --   "key_claim": "The one thing we're asserting",
  --   "proof_points": ["Bullet 1", "Bullet 2"],
  --   "why_now": "Why this is timely",
  --   "no_go_claims": ["Claims we must avoid based on client context"]
  -- }

  -- Evidence: explicit list of source signals used
  evidence JSONB NOT NULL DEFAULT '[]',
  -- Schema: [{ "signal_id": "uuid", "url": "...", "title": "...", "excerpt": "..." }]

  -- Date range of source material
  source_date_range JSONB,
  -- Schema: { "from": "ISO date", "to": "ISO date" }

  -- Approval workflow
  status brief_status DEFAULT 'draft',
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- If this brief was superseded by another (regenerate-angle flow)
  superseded_by UUID REFERENCES canonical_briefs(id) ON DELETE SET NULL,

  -- Metadata
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_canonical_briefs_client ON canonical_briefs(client_id);
CREATE INDEX idx_canonical_briefs_idea ON canonical_briefs(idea_id);
CREATE INDEX idx_canonical_briefs_status ON canonical_briefs(status);
CREATE INDEX idx_canonical_briefs_created ON canonical_briefs(created_at DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_canonical_briefs_brief ON canonical_briefs USING GIN (brief);

-- =============================================================================
-- 4. CREATE BRIEF_GENERATIONS TABLE
-- =============================================================================
-- Stores content generated from approved briefs (not from opportunities directly)

CREATE TABLE IF NOT EXISTS brief_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to the brief (REQUIRED - content can only be generated from briefs)
  brief_id UUID REFERENCES canonical_briefs(id) ON DELETE CASCADE NOT NULL,

  -- Channel for this generation
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('youtube', 'blog', 'instagram')),

  -- Generated output (structured based on channel)
  output JSONB NOT NULL,
  -- YouTube: { titles, thumbnail_concepts, hook_script, full_script, outline, broll_cues, retention_beats, cta }
  -- Blog: { seo_title, meta_description, outline, full_draft, faq, internal_links }
  -- Instagram: { caption, hooks, hashtags, carousel_slides, cta }

  -- AI model info
  model_id VARCHAR(50),
  tokens JSONB DEFAULT '{}',

  -- Version control (allows regeneration)
  version INTEGER DEFAULT 1,

  -- User attribution
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_brief_generations_brief ON brief_generations(brief_id);
CREATE INDEX idx_brief_generations_channel ON brief_generations(channel);
CREATE INDEX idx_brief_generations_created ON brief_generations(created_at DESC);

-- =============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE canonical_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief_generations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS POLICIES
-- =============================================================================

-- Canonical Briefs: Users can see briefs for their clients or internal (NULL client)
CREATE POLICY "Users can read briefs"
  ON canonical_briefs FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      client_id IS NULL  -- Internal briefs visible to all authenticated
      OR has_client_access(client_id, 'viewer')
    )
  );

CREATE POLICY "Users can create briefs"
  ON canonical_briefs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update briefs"
  ON canonical_briefs FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      created_by = auth.uid()
      OR (client_id IS NOT NULL AND has_client_access(client_id, 'editor'))
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Brief Generations: Users can see/create generations for accessible briefs
CREATE POLICY "Users can read brief generations"
  ON brief_generations FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM canonical_briefs cb
      WHERE cb.id = brief_id
      AND (
        cb.client_id IS NULL
        OR has_client_access(cb.client_id, 'viewer')
      )
    )
  );

CREATE POLICY "Users can create brief generations"
  ON brief_generations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM canonical_briefs cb
      WHERE cb.id = brief_id
      AND cb.status = 'approved'  -- Can only generate from approved briefs
    )
  );

-- =============================================================================
-- 7. HELPER FUNCTIONS
-- =============================================================================

-- Function to approve a brief
CREATE OR REPLACE FUNCTION approve_brief(p_brief_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE canonical_briefs
  SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_brief_id
    AND status = 'draft'
    AND (
      created_by = auth.uid()
      OR (client_id IS NOT NULL AND has_client_access(client_id, 'editor'))
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  RETURN FOUND;
END;
$$;

-- Function to reject a brief
CREATE OR REPLACE FUNCTION reject_brief(p_brief_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE canonical_briefs
  SET
    status = 'rejected',
    rejection_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_brief_id
    AND status = 'draft'
    AND (
      created_by = auth.uid()
      OR (client_id IS NOT NULL AND has_client_access(client_id, 'editor'))
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  RETURN FOUND;
END;
$$;

-- Function to supersede a brief (when regenerating with new angle)
CREATE OR REPLACE FUNCTION supersede_brief(p_old_brief_id UUID, p_new_brief_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE canonical_briefs
  SET
    status = 'superseded',
    superseded_by = p_new_brief_id,
    updated_at = NOW()
  WHERE id = p_old_brief_id
    AND status IN ('draft', 'rejected');

  RETURN FOUND;
END;
$$;

-- Function to get brief with full context
CREATE OR REPLACE FUNCTION get_brief_with_context(p_brief_id UUID)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  idea_id UUID,
  brief JSONB,
  evidence JSONB,
  source_date_range JSONB,
  status brief_status,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  -- Joined data
  idea_topic TEXT,
  idea_angle TEXT,
  idea_score NUMERIC,
  generation_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.id,
    cb.client_id,
    cb.idea_id,
    cb.brief,
    cb.evidence,
    cb.source_date_range,
    cb.status,
    cb.approved_by,
    cb.approved_at,
    cb.rejection_reason,
    cb.created_by,
    cb.created_at,
    vo.topic AS idea_topic,
    vo.angle AS idea_angle,
    vo.score AS idea_score,
    (SELECT COUNT(*) FROM brief_generations bg WHERE bg.brief_id = cb.id) AS generation_count
  FROM canonical_briefs cb
  LEFT JOIN viral_opportunities vo ON vo.id = cb.idea_id
  WHERE cb.id = p_brief_id
    AND (
      cb.client_id IS NULL
      OR has_client_access(cb.client_id, 'viewer')
    );
END;
$$;

-- =============================================================================
-- 8. UPDATED_AT TRIGGER
-- =============================================================================

CREATE TRIGGER canonical_briefs_updated_at
  BEFORE UPDATE ON canonical_briefs
  FOR EACH ROW
  EXECUTE FUNCTION update_viral_updated_at();

-- =============================================================================
-- 9. UPDATE VIRAL_SOURCES RLS POLICIES
-- =============================================================================

-- Drop existing policies if they exist (to recreate with client support)
DROP POLICY IF EXISTS "Authenticated users can read active sources" ON viral_sources;
DROP POLICY IF EXISTS "Admins can manage sources" ON viral_sources;

-- New policies with client-awareness
CREATE POLICY "Users can read sources"
  ON viral_sources FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND (
      client_id IS NULL  -- Industry sources visible to all
      OR has_client_access(client_id, 'viewer')
    )
  );

CREATE POLICY "Users can manage client sources"
  ON viral_sources FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Admins can manage all sources
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      -- Users can manage sources for their clients
      OR (client_id IS NOT NULL AND has_client_access(client_id, 'editor'))
    )
  );

-- =============================================================================
-- Done!
-- =============================================================================
