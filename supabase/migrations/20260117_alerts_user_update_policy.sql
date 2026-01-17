-- Allow users to update alert status for clients they have access to
-- This enables the "Mark as Resolved" and "Acknowledge" functionality in the UI

-- Policy: Users can update alerts for clients they have access to
CREATE POLICY "Users can update alerts for their clients" ON alerts
  FOR UPDATE
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
  )
  WITH CHECK (
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

-- Add comment for documentation
COMMENT ON POLICY "Users can update alerts for their clients" ON alerts IS
  'Allows users to update alert status (acknowledge/resolve) for clients they have membership to';
