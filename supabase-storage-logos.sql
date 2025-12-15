-- ===========================================
-- YourFellow Performance - Logo Storage Setup
-- ===========================================
-- Creates a storage bucket for client logos
-- Run this ONCE in Supabase SQL Editor

-- 1. Create the storage bucket for logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  TRUE,  -- Public bucket so logos can be displayed without auth
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];

-- 2. Storage policies for the logos bucket

-- Allow anyone to view logos (public bucket)
DROP POLICY IF EXISTS "Public logo access" ON storage.objects;
CREATE POLICY "Public logo access"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Allow authenticated users to upload logos for clients they have admin access to
DROP POLICY IF EXISTS "Users can upload client logos" ON storage.objects;
CREATE POLICY "Users can upload client logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
  AND (
    -- Path format: logos/clients/{client_id}/{filename}
    -- Check if user has admin/owner access to the client
    EXISTS (
      SELECT 1 FROM public.client_memberships
      WHERE client_id = (storage.foldername(name))[2]::uuid
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR
    -- Or user is a platform admin
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Allow users to update/replace logos they have access to
DROP POLICY IF EXISTS "Users can update client logos" ON storage.objects;
CREATE POLICY "Users can update client logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM public.client_memberships
      WHERE client_id = (storage.foldername(name))[2]::uuid
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Allow users to delete logos they have access to
DROP POLICY IF EXISTS "Users can delete client logos" ON storage.objects;
CREATE POLICY "Users can delete client logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM public.client_memberships
      WHERE client_id = (storage.foldername(name))[2]::uuid
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Done!
-- After running this, the logos bucket is ready for client logo uploads
