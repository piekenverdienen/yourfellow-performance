-- Shopify OAuth States Table
-- Stores temporary OAuth state for CSRF protection during app installation

CREATE TABLE IF NOT EXISTS shopify_oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shop TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_shopify_oauth_states_expires_at
  ON shopify_oauth_states(expires_at);

-- Index for state lookup
CREATE INDEX IF NOT EXISTS idx_shopify_oauth_states_state
  ON shopify_oauth_states(state);

-- RLS Policies
ALTER TABLE shopify_oauth_states ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can manage their own OAuth states
CREATE POLICY "Users can manage own OAuth states"
  ON shopify_oauth_states
  FOR ALL
  USING (auth.uid() = user_id);

-- Service role can manage all states (for cleanup)
CREATE POLICY "Service role full access to OAuth states"
  ON shopify_oauth_states
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to clean up expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM shopify_oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON TABLE shopify_oauth_states IS 'Temporary storage for Shopify OAuth state parameters during app installation flow';
