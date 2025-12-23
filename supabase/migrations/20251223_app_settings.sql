-- App Settings table for storing application-wide configuration
-- Used for things like Google Ads API credentials, global settings, etc.

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read app settings
CREATE POLICY "Admins can read app_settings"
  ON app_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can insert app settings
CREATE POLICY "Admins can insert app_settings"
  ON app_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update app settings
CREATE POLICY "Admins can update app_settings"
  ON app_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add comment
COMMENT ON TABLE app_settings IS 'Application-wide settings and configuration (admin only)';
COMMENT ON COLUMN app_settings.key IS 'Unique setting key (e.g., google_ads_credentials)';
COMMENT ON COLUMN app_settings.value IS 'JSON value for the setting';
