-- ===========================================
-- Workflows Database Schema
-- ===========================================
-- Run this in Supabase SQL Editor after the main setup

-- 1. Create workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- Store the React Flow nodes and edges as JSON
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  -- Workflow settings
  is_active BOOLEAN DEFAULT TRUE,
  is_template BOOLEAN DEFAULT FALSE,
  -- Execution settings
  trigger_type TEXT DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'schedule', 'webhook')),
  schedule_cron TEXT, -- For scheduled workflows
  webhook_secret TEXT, -- For webhook triggers
  -- Stats
  total_runs INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create workflow_runs table (execution history)
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  -- Store input/output for each node
  node_results JSONB DEFAULT '{}'::jsonb,
  -- Error tracking
  error_message TEXT,
  error_node_id TEXT,
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  -- Metadata
  trigger_type TEXT DEFAULT 'manual',
  input_data JSONB
);

-- 3. Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for workflows
CREATE POLICY "Users can view own workflows and templates"
  ON public.workflows FOR SELECT
  USING (user_id = auth.uid() OR is_template = TRUE);

CREATE POLICY "Users can create own workflows"
  ON public.workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows"
  ON public.workflows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON public.workflows FOR DELETE
  USING (auth.uid() = user_id);

-- 5. RLS Policies for workflow_runs
CREATE POLICY "Users can view own workflow runs"
  ON public.workflow_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workflow runs"
  ON public.workflow_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflow runs"
  ON public.workflow_runs FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON public.workflows(is_template);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);

-- 7. Trigger for updated_at
CREATE TRIGGER workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. Insert default workflow templates
INSERT INTO public.workflows (user_id, name, description, is_template, nodes, edges) VALUES
-- Template 1: Blog Generator
(
  (SELECT id FROM public.profiles LIMIT 1), -- Will be replaced with actual admin user
  'Blog Artikel Generator',
  'Onderzoek een onderwerp en schrijf automatisch een blog artikel',
  TRUE,
  '[
    {"id": "1", "type": "triggerNode", "position": {"x": 100, "y": 200}, "data": {"label": "Start", "config": {}}},
    {"id": "2", "type": "aiAgentNode", "position": {"x": 350, "y": 100}, "data": {"label": "Research Agent", "config": {"model": "claude-sonnet", "prompt": "Onderzoek het volgende onderwerp en geef een samenvatting met key points: {{input}}"}}},
    {"id": "3", "type": "aiAgentNode", "position": {"x": 600, "y": 200}, "data": {"label": "Blog Writer", "config": {"model": "claude-sonnet", "prompt": "Schrijf een engaging blog artikel in het Nederlands op basis van dit onderzoek: {{research_output}}"}}},
    {"id": "4", "type": "outputNode", "position": {"x": 850, "y": 200}, "data": {"label": "Output", "config": {}}}
  ]'::jsonb,
  '[
    {"id": "e1-2", "source": "1", "target": "2"},
    {"id": "e2-3", "source": "2", "target": "3"},
    {"id": "e3-4", "source": "3", "target": "4"}
  ]'::jsonb
),
-- Template 2: Social Media Generator
(
  (SELECT id FROM public.profiles LIMIT 1),
  'Social Media Content',
  'Genereer social media posts voor meerdere platformen',
  TRUE,
  '[
    {"id": "1", "type": "triggerNode", "position": {"x": 100, "y": 250}, "data": {"label": "Start", "config": {}}},
    {"id": "2", "type": "aiAgentNode", "position": {"x": 350, "y": 150}, "data": {"label": "LinkedIn Post", "config": {"model": "claude-sonnet", "prompt": "Schrijf een professionele LinkedIn post over: {{input}}"}}},
    {"id": "3", "type": "aiAgentNode", "position": {"x": 350, "y": 350}, "data": {"label": "Instagram Caption", "config": {"model": "claude-sonnet", "prompt": "Schrijf een engaging Instagram caption met emoji''s over: {{input}}"}}},
    {"id": "4", "type": "outputNode", "position": {"x": 600, "y": 250}, "data": {"label": "Output", "config": {}}}
  ]'::jsonb,
  '[
    {"id": "e1-2", "source": "1", "target": "2"},
    {"id": "e1-3", "source": "1", "target": "3"},
    {"id": "e2-4", "source": "2", "target": "4"},
    {"id": "e3-4", "source": "3", "target": "4"}
  ]'::jsonb
),
-- Template 3: Email Sequence
(
  (SELECT id FROM public.profiles LIMIT 1),
  'Email Welkomst Sequence',
  'Genereer een 3-delige email welkomst serie',
  TRUE,
  '[
    {"id": "1", "type": "triggerNode", "position": {"x": 100, "y": 200}, "data": {"label": "Start", "config": {}}},
    {"id": "2", "type": "aiAgentNode", "position": {"x": 350, "y": 200}, "data": {"label": "Email 1: Welkom", "config": {"model": "claude-sonnet", "prompt": "Schrijf een warme welkomst email voor een nieuwe subscriber. Product/dienst: {{input}}"}}},
    {"id": "3", "type": "aiAgentNode", "position": {"x": 600, "y": 200}, "data": {"label": "Email 2: Waarde", "config": {"model": "claude-sonnet", "prompt": "Schrijf een follow-up email die waarde biedt en tips geeft. Context: {{email_1_output}}"}}},
    {"id": "4", "type": "aiAgentNode", "position": {"x": 850, "y": 200}, "data": {"label": "Email 3: CTA", "config": {"model": "claude-sonnet", "prompt": "Schrijf een email met een call-to-action. Context van eerdere emails: {{email_2_output}}"}}},
    {"id": "5", "type": "outputNode", "position": {"x": 1100, "y": 200}, "data": {"label": "Output", "config": {}}}
  ]'::jsonb,
  '[
    {"id": "e1-2", "source": "1", "target": "2"},
    {"id": "e2-3", "source": "2", "target": "3"},
    {"id": "e3-4", "source": "3", "target": "4"},
    {"id": "e4-5", "source": "4", "target": "5"}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
