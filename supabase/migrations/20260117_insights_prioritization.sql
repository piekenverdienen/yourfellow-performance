-- Add prioritization fields to insights table
-- These fields enable media buyers to focus on highest-value opportunities first

-- Add effort field (how much work to implement the recommendation)
-- Values: 'low' (quick fix), 'medium' (some work), 'high' (significant effort)
ALTER TABLE insights ADD COLUMN IF NOT EXISTS effort VARCHAR(20) DEFAULT 'medium';

-- Add urgency field (time-sensitivity based on trend)
-- Values: 'low' (stable), 'medium' (trending), 'high' (accelerating/critical)
ALTER TABLE insights ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium';

-- Add priority_score (calculated: (impact_weight * urgency_weight) / effort_weight)
-- Higher score = higher priority
-- Range typically 0.33 to 9.0 depending on combination
ALTER TABLE insights ADD COLUMN IF NOT EXISTS priority_score DECIMAL(5,2) DEFAULT 1.0;

-- Add constraint to ensure valid values
ALTER TABLE insights ADD CONSTRAINT insights_effort_check
  CHECK (effort IN ('low', 'medium', 'high'));

ALTER TABLE insights ADD CONSTRAINT insights_urgency_check
  CHECK (urgency IN ('low', 'medium', 'high'));

-- Create index for priority-based sorting (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_insights_priority_score ON insights(priority_score DESC);

-- Create composite index for common dashboard query:
-- "Show me highest priority new insights for this client"
CREATE INDEX IF NOT EXISTS idx_insights_client_status_priority ON insights(client_id, status, priority_score DESC);

-- Add comments for documentation
COMMENT ON COLUMN insights.effort IS 'Estimated effort to implement: low (quick fix), medium (some work), high (significant effort)';
COMMENT ON COLUMN insights.urgency IS 'Time-sensitivity: low (stable issue), medium (trending), high (accelerating/critical)';
COMMENT ON COLUMN insights.priority_score IS 'Calculated priority: (impact * urgency) / effort. Higher = more urgent/impactful.';
