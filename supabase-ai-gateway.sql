-- =============================================================================
-- AI Gateway Database Schema
-- =============================================================================
-- This migration adds:
-- 1. ai_templates - Versioned prompt templates with A/B testing support
-- 2. ai_usage_logs - Extended usage logging with cost tracking
-- 3. ai_evaluations - Optional output quality scoring
-- =============================================================================

-- =============================================================================
-- 1. AI TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template identification
  task VARCHAR(50) NOT NULL,  -- e.g., 'google_ads_copy', 'social_post'
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',  -- Semantic versioning
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Prompt configuration
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,  -- Supports {{variable}} syntax
  output_schema JSONB,  -- JSON Schema for structured output validation

  -- Model settings
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,

  -- Gamification
  xp_reward INTEGER DEFAULT 5,

  -- Status & A/B testing
  is_active BOOLEAN DEFAULT true,
  traffic_percentage INTEGER DEFAULT 100,  -- For A/B testing (0-100)

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: only one active version per task by default
-- Multiple can be active if traffic_percentage < 100 (A/B testing)
CREATE INDEX idx_ai_templates_task ON ai_templates(task);
CREATE INDEX idx_ai_templates_active ON ai_templates(task, is_active) WHERE is_active = true;
CREATE INDEX idx_ai_templates_version ON ai_templates(task, version);

-- Enable RLS
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read active templates
CREATE POLICY "Anyone can read active templates"
  ON ai_templates FOR SELECT
  USING (is_active = true);

-- Only admins can manage templates
CREATE POLICY "Admins can manage templates"
  ON ai_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 2. AI USAGE LOGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User & Client
  user_id UUID REFERENCES profiles(id),
  client_id UUID REFERENCES clients(id),

  -- Template reference
  template_id UUID REFERENCES ai_templates(id),
  template_version VARCHAR(20) NOT NULL,

  -- Model info
  model_id VARCHAR(50) NOT NULL,  -- e.g., 'claude-sonnet', 'gpt-4o'
  provider VARCHAR(20) NOT NULL,  -- 'anthropic', 'openai', 'google'
  task VARCHAR(50) NOT NULL,

  -- Token usage
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost tracking (in cents)
  estimated_cost DECIMAL(10,4) DEFAULT 0,

  -- Performance
  duration_ms INTEGER DEFAULT 0,

  -- Status
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Additional metadata
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_ai_usage_logs_user ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_client ON ai_usage_logs(client_id);
CREATE INDEX idx_ai_usage_logs_template ON ai_usage_logs(template_id);
CREATE INDEX idx_ai_usage_logs_task ON ai_usage_logs(task);
CREATE INDEX idx_ai_usage_logs_created ON ai_usage_logs(created_at);
CREATE INDEX idx_ai_usage_logs_model ON ai_usage_logs(model_id, provider);

-- Composite index for analytics queries
CREATE INDEX idx_ai_usage_logs_analytics
  ON ai_usage_logs(user_id, client_id, task, created_at);

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own logs
CREATE POLICY "Users can view own usage logs"
  ON ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own logs
CREATE POLICY "Users can insert own usage logs"
  ON ai_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all logs
CREATE POLICY "Admins can view all usage logs"
  ON ai_usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 3. AI EVALUATIONS TABLE (Optional)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to usage log
  usage_log_id UUID REFERENCES ai_usage_logs(id) ON DELETE CASCADE,

  -- Overall score
  score INTEGER CHECK (score >= 0 AND score <= 100),

  -- Detailed criteria scores
  criteria JSONB,  -- Array of {name, score, weight, notes}

  -- Feedback
  feedback TEXT,

  -- Evaluator info
  evaluated_by VARCHAR(20) DEFAULT 'ai',  -- 'ai' or 'human'
  evaluator_model VARCHAR(50),  -- If AI, which model evaluated
  evaluator_user_id UUID REFERENCES profiles(id),  -- If human

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_evaluations_usage_log ON ai_evaluations(usage_log_id);
CREATE INDEX idx_ai_evaluations_score ON ai_evaluations(score);

-- Enable RLS
ALTER TABLE ai_evaluations ENABLE ROW LEVEL SECURITY;

-- Users can see evaluations for their own usage logs
CREATE POLICY "Users can view own evaluations"
  ON ai_evaluations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_usage_logs
      WHERE ai_usage_logs.id = usage_log_id
      AND ai_usage_logs.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 4. HELPER FUNCTIONS
-- =============================================================================

-- Function to get the active template for a task (handles A/B testing)
CREATE OR REPLACE FUNCTION get_active_template(p_task VARCHAR)
RETURNS TABLE (
  id UUID,
  task VARCHAR,
  version VARCHAR,
  name VARCHAR,
  system_prompt TEXT,
  user_prompt_template TEXT,
  output_schema JSONB,
  temperature DECIMAL,
  max_tokens INTEGER,
  xp_reward INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  random_pct INTEGER;
  cumulative_pct INTEGER := 0;
  template_row RECORD;
BEGIN
  -- Generate random percentage for A/B testing
  random_pct := floor(random() * 100)::INTEGER;

  -- Loop through active templates and select based on traffic percentage
  FOR template_row IN
    SELECT t.id, t.task, t.version, t.name, t.system_prompt,
           t.user_prompt_template, t.output_schema, t.temperature,
           t.max_tokens, t.xp_reward, t.traffic_percentage
    FROM ai_templates t
    WHERE t.task = p_task AND t.is_active = true
    ORDER BY t.version DESC
  LOOP
    cumulative_pct := cumulative_pct + template_row.traffic_percentage;

    IF random_pct < cumulative_pct THEN
      RETURN QUERY SELECT
        template_row.id,
        template_row.task,
        template_row.version,
        template_row.name,
        template_row.system_prompt,
        template_row.user_prompt_template,
        template_row.output_schema,
        template_row.temperature,
        template_row.max_tokens,
        template_row.xp_reward;
      RETURN;
    END IF;
  END LOOP;

  -- Fallback: return latest version if no match
  RETURN QUERY SELECT t.id, t.task, t.version, t.name, t.system_prompt,
                      t.user_prompt_template, t.output_schema, t.temperature,
                      t.max_tokens, t.xp_reward
  FROM ai_templates t
  WHERE t.task = p_task AND t.is_active = true
  ORDER BY t.version DESC
  LIMIT 1;
END;
$$;

-- Function to get usage statistics for a user
CREATE OR REPLACE FUNCTION get_ai_usage_stats(p_user_id UUID)
RETURNS TABLE (
  total_requests BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL,
  avg_duration_ms DECIMAL,
  requests_today BIGINT,
  tokens_today BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_requests,
    COALESCE(SUM(l.total_tokens), 0)::BIGINT as total_tokens,
    COALESCE(SUM(l.estimated_cost), 0) as total_cost,
    COALESCE(AVG(l.duration_ms), 0) as avg_duration_ms,
    COUNT(*) FILTER (WHERE l.created_at >= CURRENT_DATE)::BIGINT as requests_today,
    COALESCE(SUM(l.total_tokens) FILTER (WHERE l.created_at >= CURRENT_DATE), 0)::BIGINT as tokens_today
  FROM ai_usage_logs l
  WHERE l.user_id = p_user_id;
END;
$$;

-- Function to get model usage breakdown
CREATE OR REPLACE FUNCTION get_model_usage_breakdown(
  p_user_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  model_id VARCHAR,
  provider VARCHAR,
  request_count BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL,
  avg_duration_ms DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.model_id,
    l.provider,
    COUNT(*)::BIGINT as request_count,
    COALESCE(SUM(l.total_tokens), 0)::BIGINT as total_tokens,
    COALESCE(SUM(l.estimated_cost), 0) as total_cost,
    COALESCE(AVG(l.duration_ms), 0) as avg_duration_ms
  FROM ai_usage_logs l
  WHERE l.created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND (p_user_id IS NULL OR l.user_id = p_user_id)
    AND (p_client_id IS NULL OR l.client_id = p_client_id)
  GROUP BY l.model_id, l.provider
  ORDER BY request_count DESC;
END;
$$;

-- =============================================================================
-- 5. INSERT DEFAULT TEMPLATES
-- =============================================================================

INSERT INTO ai_templates (task, version, name, description, system_prompt, user_prompt_template, output_schema, temperature, max_tokens, xp_reward)
VALUES
  -- Google Ads Copy
  (
    'google_ads_copy',
    '1.0.0',
    'Google Ads Copy Generator',
    'Genereert headlines en descriptions voor Google Ads campagnes',
    E'Je bent een ervaren Google Ads copywriter gespecialiseerd in het schrijven van advertenties met hoge Quality Scores.\n\nTECHNISCHE EISEN:\n- Headlines: STRIKT max 30 karakters (inclusief spaties)\n- Descriptions: STRIKT max 90 karakters (inclusief spaties)\n- Tel karakters nauwkeurig! Overschrijd NOOIT de limieten.\n\nSCHRIJFREGELS:\n- Gebruik actieve, directe taal\n- Vermijd generieke zinnen\n- Verwerk keywords natuurlijk\n- Gebruik cijfers en specifieke voordelen\n- Creëer urgentie zonder clickbait\n\nOUTPUT: JSON met headlines[] en descriptions[]',
    E'Product: {{product_name}}\nBeschrijving: {{product_description}}\nDoelgroep: {{target_audience}}\nKeywords: {{keywords}}\nTone: {{tone}}\n{{#landing_page_content}}Landingspagina content: {{landing_page_content}}{{/landing_page_content}}',
    '{"type": "object", "properties": {"headlines": {"type": "array", "items": {"type": "string"}}, "descriptions": {"type": "array", "items": {"type": "string"}}}}',
    0.7,
    2048,
    10
  ),

  -- Social Post
  (
    'social_post',
    '1.0.0',
    'Social Media Post Generator',
    'Genereert posts voor social media platforms',
    E'Je bent een social media expert. Schrijf engaging posts die passen bij het platform en de doelgroep.\n\nPLATFORM STIJLEN:\n- LinkedIn: Professioneel, thought leadership\n- Instagram: Visueel, storytelling, hashtags\n- Facebook: Conversational, community\n- Twitter/X: Kort, puntig, trending\n\nOUTPUT: JSON met primary_text, headline (optioneel), hashtags[], suggested_cta',
    E'Platform: {{platform}}\nOnderwerp: {{topic}}\nTone: {{tone}}\nType: {{post_type}}\nHashtags: {{include_hashtags}}\nEmoji: {{include_emoji}}',
    '{"type": "object", "properties": {"primary_text": {"type": "string"}, "headline": {"type": "string"}, "hashtags": {"type": "array", "items": {"type": "string"}}, "suggested_cta": {"type": "string"}}}',
    0.8,
    1024,
    8
  ),

  -- Image Prompt
  (
    'image_prompt',
    '1.0.0',
    'Image Prompt Engineer',
    'Genereert prompts voor AI image generators',
    E'Je bent een expert image prompt engineer. Je analyseert content en schrijft visueel beschrijvende prompts voor AI image generators.\n\nREGELS:\n- Schrijf ALLEEN de image prompt, geen uitleg\n- Prompt moet in het ENGELS zijn\n- NOOIT tekst, woorden, letters of logos beschrijven (AI kan dit niet)\n- Beschrijf: onderwerp, setting, belichting, stijl, kleuren, compositie, sfeer\n- Max 80 woorden\n\nOUTPUT: Alleen de prompt als plain text',
    E'Platform: {{platform}}\nContent: {{content}}',
    NULL,
    0.8,
    500,
    5
  ),

  -- SEO Content
  (
    'seo_content',
    '1.0.0',
    'SEO Content Writer',
    'Genereert SEO-geoptimaliseerde content',
    E'Je bent een SEO content specialist. Schrijf content die zowel voor zoekmachines als lezers werkt.\n\nSEO PRINCIPES:\n- Gebruik hoofdkeyword in titel en eerste alinea\n- Natuurlijke keyword dichtheid (1-2%)\n- Gebruik H2/H3 headers met relevante keywords\n- Schrijf meta description van max 155 karakters\n- Interne linking suggesties\n\nOUTPUT: JSON met title, meta_description, content, suggested_headers[]',
    E'Onderwerp: {{topic}}\nKeywords: {{keywords}}\nContent type: {{content_type}}\nWoordentelling: {{word_count}}\nTone: {{tone}}',
    '{"type": "object", "properties": {"title": {"type": "string"}, "meta_description": {"type": "string"}, "content": {"type": "string"}, "suggested_headers": {"type": "array", "items": {"type": "string"}}}}',
    0.7,
    4096,
    15
  ),

  -- Content Evaluation
  (
    'content_evaluation',
    '1.0.0',
    'Content Quality Evaluator',
    'Evalueert AI-gegenereerde content op kwaliteit',
    E'Je bent een content quality analyst. Evalueer de gegeven content op basis van de criteria.\n\nCRITERIA:\n- Relevantie (past bij opdracht)\n- Kwaliteit (taalgebruik, structuur)\n- Creativiteit (originaliteit)\n- Brand alignment (past bij merkidentiteit)\n- Technische correctheid (karakterlimieten, format)\n\nOUTPUT: JSON met score (0-100), criteria[] met per criterium: name, score, weight, notes',
    E'Originele opdracht: {{original_request}}\nGegenereerde content: {{generated_content}}\nKlant context: {{client_context}}',
    '{"type": "object", "properties": {"score": {"type": "integer"}, "criteria": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "score": {"type": "integer"}, "weight": {"type": "number"}, "notes": {"type": "string"}}}}, "feedback": {"type": "string"}}}',
    0.3,
    1024,
    0
  )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_ai_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_templates_updated_at
  BEFORE UPDATE ON ai_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_templates_updated_at();
