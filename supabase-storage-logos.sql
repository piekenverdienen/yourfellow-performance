-- Supabase Storage Setup for Client Logos
-- Run this in Supabase SQL Editor

-- Create storage bucket for logos (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880, -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];

-- Allow public read access to logos
CREATE POLICY IF NOT EXISTS "Public read access for logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Allow authenticated users to upload logos
CREATE POLICY IF NOT EXISTS "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Allow users to update their own uploads
CREATE POLICY IF NOT EXISTS "Users can update own logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own uploads
CREATE POLICY IF NOT EXISTS "Users can delete own logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Alternative: If the above policies don't work, use these simpler ones:
-- DROP POLICY IF EXISTS "Public read access for logos" ON storage.objects;
-- DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update own logos" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete own logos" ON storage.objects;

-- CREATE POLICY "logos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
-- CREATE POLICY "logos_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
-- CREATE POLICY "logos_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');
-- CREATE POLICY "logos_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');
