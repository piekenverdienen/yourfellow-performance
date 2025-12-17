-- ===========================================
-- YourFellow Performance - Knowledge Documents Setup
-- ===========================================
-- Run this in Supabase SQL Editor to enable knowledge base for AI assistants

-- 1. Create knowledge_documents table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Document metadata
  name TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf', 'docx', 'xlsx', 'txt', 'md'
  file_size INTEGER NOT NULL, -- in bytes
  file_path TEXT NOT NULL, -- path in Supabase Storage

  -- Extracted content
  content TEXT, -- extracted text content
  content_summary TEXT, -- AI-generated summary (optional)

  -- Categorization
  category TEXT DEFAULT 'general', -- 'seo', 'sea', 'social', 'reporting', 'general'
  tags TEXT[] DEFAULT '{}',

  -- Scope: which assistant(s) can use this
  assistant_slugs TEXT[] DEFAULT '{mia}', -- e.g., '{mia}', '{mia,max}', or '{all}'

  -- Ownership
  uploaded_by UUID REFERENCES public.profiles ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_processed BOOLEAN DEFAULT FALSE, -- true when content is extracted
  processing_error TEXT, -- error message if extraction failed

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- All authenticated users can read active documents
CREATE POLICY "Authenticated users can read active documents"
  ON public.knowledge_documents FOR SELECT
  TO authenticated
  USING (is_active = TRUE AND is_processed = TRUE);

-- Admins can do everything
CREATE POLICY "Admins can manage all documents"
  ON public.knowledge_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can insert their own documents
CREATE POLICY "Users can upload documents"
  ON public.knowledge_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- Users can update their own unprocessed documents
CREATE POLICY "Users can update own documents"
  ON public.knowledge_documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_assistant ON public.knowledge_documents USING GIN (assistant_slugs);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_category ON public.knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_active ON public.knowledge_documents(is_active, is_processed);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tags ON public.knowledge_documents USING GIN (tags);

-- 5. Full-text search index on content
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_content_search
  ON public.knowledge_documents
  USING GIN (to_tsvector('dutch', COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(content, '')));

-- 6. Trigger for updated_at
CREATE TRIGGER knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7. Function to search knowledge documents
CREATE OR REPLACE FUNCTION search_knowledge_documents(
  search_query TEXT,
  assistant_slug TEXT DEFAULT 'mia',
  max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  content TEXT,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kd.id,
    kd.name,
    kd.description,
    kd.category,
    kd.content,
    ts_rank(
      to_tsvector('dutch', COALESCE(kd.name, '') || ' ' || COALESCE(kd.description, '') || ' ' || COALESCE(kd.content, '')),
      plainto_tsquery('dutch', search_query)
    ) AS relevance
  FROM public.knowledge_documents kd
  WHERE
    kd.is_active = TRUE
    AND kd.is_processed = TRUE
    AND (assistant_slug = ANY(kd.assistant_slugs) OR 'all' = ANY(kd.assistant_slugs))
    AND to_tsvector('dutch', COALESCE(kd.name, '') || ' ' || COALESCE(kd.description, '') || ' ' || COALESCE(kd.content, ''))
        @@ plainto_tsquery('dutch', search_query)
  ORDER BY relevance DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get all knowledge for an assistant (for context injection)
CREATE OR REPLACE FUNCTION get_assistant_knowledge(
  assistant_slug TEXT DEFAULT 'mia',
  max_chars INTEGER DEFAULT 50000
)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  doc RECORD;
  current_length INTEGER := 0;
BEGIN
  FOR doc IN
    SELECT
      kd.name,
      kd.category,
      kd.content
    FROM public.knowledge_documents kd
    WHERE
      kd.is_active = TRUE
      AND kd.is_processed = TRUE
      AND (assistant_slug = ANY(kd.assistant_slugs) OR 'all' = ANY(kd.assistant_slugs))
    ORDER BY kd.category, kd.name
  LOOP
    -- Check if adding this document would exceed max_chars
    IF current_length + LENGTH(doc.content) > max_chars THEN
      -- Add truncated content
      result := result || E'\n\n--- ' || doc.name || ' [' || doc.category || '] ---\n';
      result := result || LEFT(doc.content, max_chars - current_length - 100) || '... [afgekapt]';
      EXIT;
    ELSE
      result := result || E'\n\n--- ' || doc.name || ' [' || doc.category || '] ---\n';
      result := result || doc.content;
      current_length := current_length + LENGTH(doc.content) + LENGTH(doc.name) + 50;
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done!
-- Next: Create a storage bucket named 'knowledge-documents' in Supabase Dashboard
-- Storage > New bucket > Name: knowledge-documents > Public: OFF
