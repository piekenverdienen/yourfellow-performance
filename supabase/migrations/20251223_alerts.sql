-- Create alerts table for monitoring notifications
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  -- Alert identification
  type VARCHAR(50) NOT NULL,           -- 'fundamental', 'performance', 'tracking'
  channel VARCHAR(50) NOT NULL,        -- 'google_ads', 'meta', 'website', 'tracking', 'seo'
  check_id VARCHAR(100) NOT NULL,      -- 'disapproved_ads', 'no_delivery', etc.

  -- Severity & Status
  severity VARCHAR(20) NOT NULL,       -- 'critical', 'high', 'medium', 'low'
  status VARCHAR(20) DEFAULT 'open',   -- 'open', 'acknowledged', 'resolved'

  -- Content
  title VARCHAR(255) NOT NULL,
  short_description TEXT,
  impact TEXT,
  suggested_actions JSONB DEFAULT '[]'::jsonb,
  details JSONB DEFAULT '{}'::jsonb,

  -- Deduplication
  fingerprint VARCHAR(255) NOT NULL,

  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint for deduplication
  UNIQUE(client_id, fingerprint)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_alerts_client_status ON alerts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_channel ON alerts(channel);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_detected_at ON alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_client_channel_status ON alerts(client_id, channel, status);

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view alerts for clients they have access to
CREATE POLICY "Users can view alerts for their clients" ON alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_memberships
      WHERE client_memberships.client_id = alerts.client_id
        AND client_memberships.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Policy: Only system (service role) can insert/update/delete alerts
-- Alerts are created by the monitoring system, not users directly
CREATE POLICY "Service role can manage alerts" ON alerts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_alert_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS alert_updated_at_trigger ON alerts;
CREATE TRIGGER alert_updated_at_trigger
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_alert_updated_at();

-- Add comment for documentation
COMMENT ON TABLE alerts IS 'Monitoring alerts for client accounts (Google Ads, Meta, etc.)';
COMMENT ON COLUMN alerts.type IS 'Alert category: fundamental (critical issues), performance (metrics), tracking (setup issues)';
COMMENT ON COLUMN alerts.channel IS 'Source platform: google_ads, meta, website, tracking, seo';
COMMENT ON COLUMN alerts.fingerprint IS 'Unique identifier for deduplication (client_id + check_id + date)';
