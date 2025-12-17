-- ===========================================
-- YourFellow Performance - Multimodal Chat Setup
-- ===========================================
-- Extends the existing chat system with multimodal capabilities
-- Run this in Supabase SQL Editor

-- 1. Create storage bucket for chat attachments (images, files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  TRUE,  -- Public so images can be displayed in chat
  52428800,  -- 50MB max file size
  ARRAY[
    -- Images
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain'
  ];

-- 2. Storage policies for chat-attachments bucket

-- Allow anyone to view chat attachments (for rendering in chat)
DROP POLICY IF EXISTS "Public chat attachment access" ON storage.objects;
CREATE POLICY "Public chat attachment access"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

-- Allow authenticated users to upload chat attachments
DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
CREATE POLICY "Users can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.role() = 'authenticated'
);

-- Allow users to delete their own attachments
DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Create message_attachments table for storing attachment metadata
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,

  -- Attachment details
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('image', 'document', 'generated_image')),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,  -- MIME type
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL,  -- Storage path
  public_url TEXT NOT NULL,  -- Public URL for display

  -- Optional metadata
  width INTEGER,  -- For images
  height INTEGER,  -- For images
  extracted_text TEXT,  -- For documents (parsed content)
  generation_prompt TEXT,  -- For generated images

  -- Optional client context
  client_id UUID REFERENCES public.clients ON DELETE SET NULL,
  assistant_slug TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on message_attachments
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for message_attachments
CREATE POLICY "Users can view attachments in own conversations"
  ON public.message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create attachments in own conversations"
  ON public.message_attachments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own attachments"
  ON public.message_attachments FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON public.message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_conversation_id ON public.message_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_user_id ON public.message_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_type ON public.message_attachments(attachment_type);

-- 7. Extend messages table with optional content_type field
-- This allows us to mark messages as having multimodal content
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text'
CHECK (content_type IN ('text', 'multimodal', 'image_generation', 'file_analysis'));

-- 8. Add action_type to usage table for tracking multimodal actions
-- First check if the column exists and add it if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage' AND column_name = 'action_type'
  ) THEN
    ALTER TABLE public.usage ADD COLUMN action_type TEXT DEFAULT 'chat';
  END IF;
END $$;

-- Done!
-- The multimodal chat storage and schema is now ready
