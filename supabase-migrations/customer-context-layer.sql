-- ===========================================
-- YourFellow Performance - Customer Context Layer
-- ===========================================
-- This migration creates the Customer Intelligence Layer
-- with AI Context, versioning, intake jobs, and scraping support
-- ===========================================

-- ===========================================
-- 1. AI CONTEXT VERSIONS TABLE
-- Stores all versions of AI-generated context per client
-- ===========================================
CREATE TABLE IF NOT EXISTS public.ai_context_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,

  -- Main AI Context (schema-validated JSONB)
  context_json JSONB NOT NULL,

  -- Summary for quick access
  summary_json JSONB,

  -- Source mapping for explainability
  source_map JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata
  generated_by TEXT NOT NULL DEFAULT 'intake', -- 'intake', 'enrichment', 'manual', 'merge'
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Who/what triggered this version
  triggered_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  triggered_by_job_id UUID, -- Will reference intake_jobs

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique version per client
  UNIQUE(client_id, version)
);

-- ===========================================
-- 2. CLIENT CONTEXT TABLE
-- Stores the active context reference per client
-- ===========================================
CREATE TABLE IF NOT EXISTS public.client_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Active version pointer (single source of truth)
  active_version INTEGER NOT NULL DEFAULT 1,

  -- Quick access to current context (denormalized for performance)
  current_context_json JSONB,
  current_summary_json JSONB,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'needs_enrichment')),

  -- Missing/low confidence fields (for UX guidance)
  missing_fields JSONB DEFAULT '[]'::jsonb,
  low_confidence_fields JSONB DEFAULT '[]'::jsonb,
  suggested_next_inputs JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 3. INTAKE JOBS TABLE
-- Async job tracking for intake processes
-- ===========================================
CREATE TABLE IF NOT EXISTS public.intake_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,

  -- Job type
  job_type TEXT NOT NULL DEFAULT 'full_intake' CHECK (job_type IN ('full_intake', 'scrape_only', 'enrich_only', 're_analyze')),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scraping', 'analyzing', 'generating', 'completed', 'failed', 'cancelled')),

  -- Progress tracking (percentage 0-100)
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- Step-by-step progress
  steps_completed JSONB DEFAULT '[]'::jsonb,
  current_step TEXT,

  -- Input config
  config JSONB DEFAULT '{}'::jsonb, -- e.g., { website_url, competitor_urls[], social_urls[] }

  -- Result reference
  result_version INTEGER, -- Version number created by this job

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Who started the job
  started_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ===========================================
-- 4. SCRAPED SOURCES TABLE
-- Stores all scraped data from websites
-- ===========================================
CREATE TABLE IF NOT EXISTS public.scraped_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  intake_job_id UUID REFERENCES public.intake_jobs(id) ON DELETE CASCADE,

  -- Source type
  source_type TEXT NOT NULL CHECK (source_type IN ('website', 'competitor', 'social_linkedin', 'social_instagram', 'social_facebook', 'social_twitter', 'social_youtube', 'review_google', 'review_trustpilot')),

  -- URL and metadata
  url TEXT NOT NULL,
  title TEXT,

  -- Scraped content
  raw_content TEXT,
  structured_content JSONB, -- Parsed/structured version

  -- Extraction metadata
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  extraction_method TEXT DEFAULT 'firecrawl', -- 'firecrawl', 'playwright', 'api'
  extraction_success BOOLEAN DEFAULT TRUE,
  extraction_error TEXT,

  -- Page metadata
  page_type TEXT, -- 'homepage', 'about', 'product', 'service', 'contact', 'blog', etc.
  depth INTEGER DEFAULT 0, -- 0 = main page, 1 = linked page, etc.

  -- For competitors
  is_competitor BOOLEAN DEFAULT FALSE,
  competitor_name TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 5. INTAKE ANSWERS TABLE
-- Stores user-provided intake answers (enrichment)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.intake_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,

  -- Answer metadata
  question_key TEXT NOT NULL, -- e.g., 'proposition', 'target_audience', 'usps.0'
  question_text TEXT, -- Original question asked

  -- Answer content
  answer_text TEXT,
  answer_json JSONB, -- For structured answers (arrays, objects)

  -- Source tracking
  source_type TEXT NOT NULL DEFAULT 'user_input' CHECK (source_type IN ('user_input', 'form', 'chat', 'import')),

  -- Who answered
  answered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Versioning (can be superseded by newer answers)
  is_active BOOLEAN DEFAULT TRUE,
  superseded_by UUID REFERENCES public.intake_answers(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 6. ADD FOREIGN KEY FOR TRIGGERED_BY_JOB_ID
-- ===========================================
ALTER TABLE public.ai_context_versions
ADD CONSTRAINT fk_triggered_by_job
FOREIGN KEY (triggered_by_job_id) REFERENCES public.intake_jobs(id) ON DELETE SET NULL;

-- ===========================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE public.ai_context_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_answers ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 8. RLS POLICIES FOR AI_CONTEXT_VERSIONS
-- ===========================================
CREATE POLICY "Users can view context versions for accessible clients"
  ON public.ai_context_versions FOR SELECT
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'viewer')
  );

CREATE POLICY "Admins can insert context versions"
  ON public.ai_context_versions FOR INSERT
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'editor')
  );

-- No update policy - versions are immutable
-- No delete policy for regular users - only service role can clean up

-- ===========================================
-- 9. RLS POLICIES FOR CLIENT_CONTEXT
-- ===========================================
CREATE POLICY "Users can view context for accessible clients"
  ON public.client_context FOR SELECT
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'viewer')
  );

CREATE POLICY "Admins can insert context"
  ON public.client_context FOR INSERT
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'admin')
  );

CREATE POLICY "Admins can update context"
  ON public.client_context FOR UPDATE
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'admin')
  )
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'admin')
  );

-- ===========================================
-- 10. RLS POLICIES FOR INTAKE_JOBS
-- ===========================================
CREATE POLICY "Users can view intake jobs for accessible clients"
  ON public.intake_jobs FOR SELECT
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'viewer')
  );

CREATE POLICY "Editors can create intake jobs"
  ON public.intake_jobs FOR INSERT
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'editor')
  );

CREATE POLICY "Editors can update intake jobs"
  ON public.intake_jobs FOR UPDATE
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'editor')
  )
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'editor')
  );

-- ===========================================
-- 11. RLS POLICIES FOR SCRAPED_SOURCES
-- ===========================================
CREATE POLICY "Users can view scraped sources for accessible clients"
  ON public.scraped_sources FOR SELECT
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'viewer')
  );

CREATE POLICY "System can insert scraped sources"
  ON public.scraped_sources FOR INSERT
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'editor')
  );

-- ===========================================
-- 12. RLS POLICIES FOR INTAKE_ANSWERS
-- ===========================================
CREATE POLICY "Users can view intake answers for accessible clients"
  ON public.intake_answers FOR SELECT
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'viewer')
  );

CREATE POLICY "Editors can insert intake answers"
  ON public.intake_answers FOR INSERT
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'editor')
  );

CREATE POLICY "Editors can update intake answers"
  ON public.intake_answers FOR UPDATE
  USING (
    is_org_admin()
    OR has_client_access(client_id, 'editor')
  )
  WITH CHECK (
    is_org_admin()
    OR has_client_access(client_id, 'editor')
  );

-- ===========================================
-- 13. INDEXES FOR PERFORMANCE
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_ai_context_versions_client_id ON public.ai_context_versions(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_versions_client_version ON public.ai_context_versions(client_id, version);
CREATE INDEX IF NOT EXISTS idx_client_context_client_id ON public.client_context(client_id);
CREATE INDEX IF NOT EXISTS idx_intake_jobs_client_id ON public.intake_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_intake_jobs_status ON public.intake_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraped_sources_client_id ON public.scraped_sources(client_id);
CREATE INDEX IF NOT EXISTS idx_scraped_sources_job_id ON public.scraped_sources(intake_job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_sources_type ON public.scraped_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_intake_answers_client_id ON public.intake_answers(client_id);
CREATE INDEX IF NOT EXISTS idx_intake_answers_question_key ON public.intake_answers(question_key);
CREATE INDEX IF NOT EXISTS idx_intake_answers_active ON public.intake_answers(client_id, is_active);

-- ===========================================
-- 14. TRIGGERS FOR updated_at
-- ===========================================
CREATE TRIGGER client_context_updated_at
  BEFORE UPDATE ON public.client_context
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER intake_jobs_updated_at
  BEFORE UPDATE ON public.intake_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================
-- 15. HELPER FUNCTION: Get latest context version
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_latest_context_version(p_client_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT MAX(version) FROM public.ai_context_versions WHERE client_id = p_client_id),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ===========================================
-- 16. HELPER FUNCTION: Get active context
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_active_context(p_client_id UUID)
RETURNS TABLE (
  context_json JSONB,
  summary_json JSONB,
  source_map JSONB,
  version INTEGER,
  generated_at TIMESTAMPTZ,
  generated_by TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.context_json,
    v.summary_json,
    v.source_map,
    v.version,
    v.generated_at,
    v.generated_by
  FROM public.client_context cc
  INNER JOIN public.ai_context_versions v
    ON v.client_id = cc.client_id AND v.version = cc.active_version
  WHERE cc.client_id = p_client_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ===========================================
-- 17. FUNCTION: Activate context version
-- ===========================================
CREATE OR REPLACE FUNCTION public.activate_context_version(p_client_id UUID, p_version INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_context_json JSONB;
  v_summary_json JSONB;
BEGIN
  -- Check if version exists
  SELECT context_json, summary_json INTO v_context_json, v_summary_json
  FROM public.ai_context_versions
  WHERE client_id = p_client_id AND version = p_version;

  IF v_context_json IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Update or insert client_context
  INSERT INTO public.client_context (client_id, active_version, current_context_json, current_summary_json, status)
  VALUES (p_client_id, p_version, v_context_json, v_summary_json, 'active')
  ON CONFLICT (client_id) DO UPDATE SET
    active_version = EXCLUDED.active_version,
    current_context_json = EXCLUDED.current_context_json,
    current_summary_json = EXCLUDED.current_summary_json,
    status = 'active',
    updated_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 18. FUNCTION: Create new context version
-- ===========================================
CREATE OR REPLACE FUNCTION public.create_context_version(
  p_client_id UUID,
  p_context_json JSONB,
  p_summary_json JSONB,
  p_source_map JSONB,
  p_generated_by TEXT DEFAULT 'intake',
  p_user_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_auto_activate BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER AS $$
DECLARE
  v_new_version INTEGER;
BEGIN
  -- Get next version number
  v_new_version := public.get_latest_context_version(p_client_id) + 1;

  -- Insert new version
  INSERT INTO public.ai_context_versions (
    client_id,
    version,
    context_json,
    summary_json,
    source_map,
    generated_by,
    triggered_by_user_id,
    triggered_by_job_id
  ) VALUES (
    p_client_id,
    v_new_version,
    p_context_json,
    p_summary_json,
    p_source_map,
    p_generated_by,
    p_user_id,
    p_job_id
  );

  -- Auto-activate if requested
  IF p_auto_activate THEN
    PERFORM public.activate_context_version(p_client_id, v_new_version);
  END IF;

  RETURN v_new_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Done! Customer Context Layer is now set up.
-- ===========================================
