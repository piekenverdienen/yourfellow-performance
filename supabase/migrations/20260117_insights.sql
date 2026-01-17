-- Google Ads Insights table
-- Stores rule-based, deterministic insights for optimization recommendations

CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Scope
  scope VARCHAR(50) NOT NULL DEFAULT 'account', -- 'account', 'campaign', 'ad_group', 'asset_group'
  scope_id VARCHAR(255), -- Campaign ID, Ad Group ID, etc. (optional)
  scope_name VARCHAR(255), -- Human-readable name of the scoped entity

  -- Insight identification
  rule_id VARCHAR(100) NOT NULL, -- e.g., 'cpa_increase_with_budget_limit', 'low_search_impression_share'
  type VARCHAR(50) NOT NULL, -- 'performance', 'budget', 'bidding', 'structure', 'creative'

  -- Impact & Confidence
  impact VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  confidence VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'

  -- Content
  summary TEXT NOT NULL, -- Short summary (max 100 chars)
  explanation TEXT NOT NULL, -- Detailed explanation of the issue
  recommendation TEXT NOT NULL, -- Specific action to take

  -- Status management
  status VARCHAR(20) NOT NULL DEFAULT 'new', -- 'new', 'picked_up', 'ignored', 'resolved'
  picked_up_at TIMESTAMP WITH TIME ZONE,
  picked_up_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),

  -- Data context
  data_snapshot JSONB DEFAULT '{}', -- Metrics at time of insight generation

  -- Deduplication
  fingerprint VARCHAR(255) NOT NULL, -- Unique identifier for this specific insight instance

  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- When this insight is no longer relevant
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Unique constraint on client + fingerprint
  CONSTRAINT insights_client_fingerprint_unique UNIQUE (client_id, fingerprint)
);

-- Indexes for common queries
CREATE INDEX idx_insights_client_status ON insights(client_id, status);
CREATE INDEX idx_insights_client_type ON insights(client_id, type);
CREATE INDEX idx_insights_detected_at ON insights(detected_at DESC);
CREATE INDEX idx_insights_rule_id ON insights(rule_id);
CREATE INDEX idx_insights_impact ON insights(impact);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insights_updated_at
  BEFORE UPDATE ON insights
  FOR EACH ROW
  EXECUTE FUNCTION update_insights_updated_at();

-- RLS Policies
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Users can view insights for clients they are members of or if they are admin
CREATE POLICY "Users can view insights for their clients" ON insights
  FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_memberships WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can update status of insights for clients they have editor access to
CREATE POLICY "Users can update insights for their clients" ON insights
  FOR UPDATE
  USING (
    client_id IN (
      SELECT client_id FROM client_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'editor')
    )
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Comments for documentation
COMMENT ON TABLE insights IS 'Rule-based insights for Google Ads optimization recommendations';
COMMENT ON COLUMN insights.rule_id IS 'Identifier for the rule that generated this insight';
COMMENT ON COLUMN insights.fingerprint IS 'Unique identifier for deduplication, e.g., rule_id:scope_id:date';
COMMENT ON COLUMN insights.data_snapshot IS 'JSON snapshot of metrics at insight generation time';
