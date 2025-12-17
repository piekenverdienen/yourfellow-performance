-- ===========================================
-- Add UPDATE policy for message_attachments
-- ===========================================
-- This allows users to update their own attachments (e.g., linking message_id)
-- Run this in Supabase SQL Editor

-- Allow users to update their own attachments
CREATE POLICY "Users can update own attachments"
  ON public.message_attachments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
