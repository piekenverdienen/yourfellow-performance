-- ===========================================
-- YourFellow Performance - Playbooks System
-- ===========================================
-- Run this in Supabase SQL Editor after the client setup

-- ===========================================
-- 1. PLAYBOOKS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.playbooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who created it (org admin)
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('content', 'seo', 'ads', 'social', 'email', 'analysis', 'other')),
  description TEXT,
  -- Schema definitions (JSON Schema format)
  input_schema JSONB NOT NULL DEFAULT '{"type": "object", "properties": {}, "required": []}'::jsonb,
  prompt_template TEXT NOT NULL,
  output_schema JSONB DEFAULT '{"type": "object"}'::jsonb,
  -- Versioning
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  -- Metadata
  icon TEXT DEFAULT 'file-text', -- Lucide icon name
  estimated_tokens INTEGER DEFAULT 1000, -- Estimated token usage
  xp_reward INTEGER DEFAULT 10, -- XP awarded on completion
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 2. PLAYBOOK RUNS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.playbook_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  playbook_id UUID REFERENCES public.playbooks(id) ON DELETE CASCADE NOT NULL,
  playbook_version INTEGER NOT NULL, -- Snapshot of version at time of run
  -- Input/Output
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB, -- The generated result
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  -- Token usage
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  -- Attribution
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ===========================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_runs ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. RLS POLICIES FOR PLAYBOOKS
-- ===========================================

-- SELECT: Everyone can see published playbooks, org admins can see all
CREATE POLICY "Users can view published playbooks"
  ON public.playbooks FOR SELECT
  USING (
    status = 'published'
    OR is_org_admin()
  );

-- INSERT: Only org admins can create playbooks
CREATE POLICY "Org admins can create playbooks"
  ON public.playbooks FOR INSERT
  WITH CHECK (is_org_admin());

-- UPDATE: Only org admins can update playbooks
CREATE POLICY "Org admins can update playbooks"
  ON public.playbooks FOR UPDATE
  USING (is_org_admin())
  WITH CHECK (is_org_admin());

-- DELETE: Only org admins can delete playbooks
CREATE POLICY "Org admins can delete playbooks"
  ON public.playbooks FOR DELETE
  USING (is_org_admin());

-- ===========================================
-- 5. RLS POLICIES FOR PLAYBOOK RUNS
-- ===========================================

-- SELECT: Users can view their own runs or runs for clients they have access to
CREATE POLICY "Users can view playbook runs"
  ON public.playbook_runs FOR SELECT
  USING (
    created_by = auth.uid()
    OR (client_id IS NOT NULL AND has_client_access(client_id, 'viewer'))
    OR is_org_admin()
  );

-- INSERT: Users can create runs for clients they have editor access to
CREATE POLICY "Users can create playbook runs"
  ON public.playbook_runs FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (client_id IS NULL OR has_client_access(client_id, 'editor'))
  );

-- UPDATE: Users can update their own runs
CREATE POLICY "Users can update own playbook runs"
  ON public.playbook_runs FOR UPDATE
  USING (created_by = auth.uid());

-- DELETE: Only org admins can delete playbook runs
CREATE POLICY "Org admins can delete playbook runs"
  ON public.playbook_runs FOR DELETE
  USING (is_org_admin());

-- ===========================================
-- 6. INDEXES FOR PERFORMANCE
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_playbooks_slug ON public.playbooks(slug);
CREATE INDEX IF NOT EXISTS idx_playbooks_category ON public.playbooks(category);
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON public.playbooks(status);
CREATE INDEX IF NOT EXISTS idx_playbook_runs_playbook_id ON public.playbook_runs(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_runs_client_id ON public.playbook_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_playbook_runs_created_by ON public.playbook_runs(created_by);
CREATE INDEX IF NOT EXISTS idx_playbook_runs_created_at ON public.playbook_runs(created_at DESC);

-- ===========================================
-- 7. TRIGGERS FOR updated_at
-- ===========================================
CREATE TRIGGER playbooks_updated_at
  BEFORE UPDATE ON public.playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================
-- 8. INSERT SAMPLE PLAYBOOKS
-- ===========================================
INSERT INTO public.playbooks (org_id, slug, title, category, description, input_schema, prompt_template, output_schema, status, icon, xp_reward) VALUES
-- Blog Generator Playbook
(
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
  'blog-generator',
  'Blog Artikel Generator',
  'content',
  'Genereer een volledig SEO-geoptimaliseerd blog artikel op basis van een onderwerp en trefwoorden.',
  '{
    "type": "object",
    "properties": {
      "topic": {
        "type": "string",
        "title": "Onderwerp",
        "description": "Het hoofdonderwerp van het blog artikel"
      },
      "keywords": {
        "type": "string",
        "title": "Trefwoorden",
        "description": "Komma-gescheiden lijst van SEO trefwoorden"
      },
      "wordCount": {
        "type": "number",
        "title": "Woordenaantal",
        "description": "Gewenst aantal woorden",
        "default": 800,
        "minimum": 300,
        "maximum": 2000
      },
      "tone": {
        "type": "string",
        "title": "Toon",
        "enum": ["professional", "casual", "friendly", "authoritative"],
        "default": "professional"
      }
    },
    "required": ["topic", "keywords"]
  }'::jsonb,
  'Je bent een ervaren content schrijver gespecialiseerd in SEO-geoptimaliseerde blog artikelen.

Schrijf een blog artikel over het volgende onderwerp: {{topic}}

SEO Trefwoorden om te integreren: {{keywords}}
Gewenst woordenaantal: {{wordCount}} woorden
Toon: {{tone}}

{{#if client_context}}
CLIENT CONTEXT:
- Bedrijf: {{client_name}}
- Propositie: {{client_context.proposition}}
- Doelgroep: {{client_context.targetAudience}}
- Tone of voice: {{client_context.toneOfVoice}}
{{#if client_context.doNots}}
⚠️ VERBODEN: {{client_context.doNots}}
{{/if}}
{{#if client_context.mustHaves}}
✓ VERPLICHT: {{client_context.mustHaves}}
{{/if}}
{{/if}}

Lever het resultaat als JSON met de volgende structuur:
{
  "title": "De titel van het artikel",
  "metaDescription": "SEO meta beschrijving (max 160 tekens)",
  "content": "Het volledige artikel in markdown formaat",
  "headings": ["Array van H2 koppen gebruikt in het artikel"]
}',
  '{
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "metaDescription": {"type": "string", "maxLength": 160},
      "content": {"type": "string"},
      "headings": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["title", "metaDescription", "content", "headings"]
  }'::jsonb,
  'published',
  'file-text',
  15
),
-- Social Media Posts Playbook
(
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
  'social-media-posts',
  'Social Media Posts Generator',
  'social',
  'Genereer geoptimaliseerde posts voor meerdere social media platformen tegelijk.',
  '{
    "type": "object",
    "properties": {
      "topic": {
        "type": "string",
        "title": "Onderwerp",
        "description": "Waar moet de post over gaan?"
      },
      "platforms": {
        "type": "array",
        "title": "Platformen",
        "items": {
          "type": "string",
          "enum": ["linkedin", "instagram", "facebook", "twitter"]
        },
        "default": ["linkedin", "instagram"]
      },
      "includeHashtags": {
        "type": "boolean",
        "title": "Hashtags toevoegen",
        "default": true
      },
      "cta": {
        "type": "string",
        "title": "Call-to-Action",
        "description": "Optionele call-to-action (bijv. ''Lees meer'', ''Shop nu'')"
      }
    },
    "required": ["topic", "platforms"]
  }'::jsonb,
  'Je bent een social media expert die virale content creëert voor verschillende platformen.

Maak social media posts over: {{topic}}
Platformen: {{platforms}}
Hashtags toevoegen: {{includeHashtags}}
{{#if cta}}Call-to-Action: {{cta}}{{/if}}

{{#if client_context}}
CLIENT CONTEXT:
- Bedrijf: {{client_name}}
- Propositie: {{client_context.proposition}}
- Doelgroep: {{client_context.targetAudience}}
- Tone of voice: {{client_context.toneOfVoice}}
{{#if client_context.doNots}}
⚠️ VERBODEN: {{client_context.doNots}}
{{/if}}
{{#if client_context.mustHaves}}
✓ VERPLICHT: {{client_context.mustHaves}}
{{/if}}
{{/if}}

Lever het resultaat als JSON met posts per platform:
{
  "posts": {
    "linkedin": {"text": "...", "hashtags": ["..."]},
    "instagram": {"text": "...", "hashtags": ["..."]},
    "facebook": {"text": "...", "hashtags": ["..."]},
    "twitter": {"text": "...", "hashtags": ["..."]}
  }
}

Alleen de gevraagde platformen opnemen.',
  '{
    "type": "object",
    "properties": {
      "posts": {
        "type": "object",
        "additionalProperties": {
          "type": "object",
          "properties": {
            "text": {"type": "string"},
            "hashtags": {"type": "array", "items": {"type": "string"}}
          },
          "required": ["text"]
        }
      }
    },
    "required": ["posts"]
  }'::jsonb,
  'published',
  'share-2',
  10
),
-- Product Description Playbook
(
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
  'product-description',
  'Product Beschrijving Generator',
  'content',
  'Genereer overtuigende productbeschrijvingen voor e-commerce.',
  '{
    "type": "object",
    "properties": {
      "productName": {
        "type": "string",
        "title": "Productnaam"
      },
      "features": {
        "type": "string",
        "title": "Kenmerken",
        "description": "Komma-gescheiden lijst van productkenmerken"
      },
      "targetAudience": {
        "type": "string",
        "title": "Doelgroep",
        "description": "Voor wie is dit product?"
      },
      "style": {
        "type": "string",
        "title": "Stijl",
        "enum": ["luxury", "budget", "technical", "lifestyle"],
        "default": "lifestyle"
      }
    },
    "required": ["productName", "features"]
  }'::jsonb,
  'Je bent een e-commerce copywriter gespecialiseerd in conversie-optimalisatie.

Schrijf een overtuigende productbeschrijving voor:
Product: {{productName}}
Kenmerken: {{features}}
{{#if targetAudience}}Doelgroep: {{targetAudience}}{{/if}}
Stijl: {{style}}

{{#if client_context}}
CLIENT CONTEXT:
- Merk: {{client_name}}
- Propositie: {{client_context.proposition}}
- Tone of voice: {{client_context.toneOfVoice}}
- USPs: {{client_context.usps}}
{{#if client_context.doNots}}
⚠️ VERBODEN: {{client_context.doNots}}
{{/if}}
{{#if client_context.mustHaves}}
✓ VERPLICHT: {{client_context.mustHaves}}
{{/if}}
{{/if}}

Lever het resultaat als JSON:
{
  "shortDescription": "Korte beschrijving (max 150 tekens)",
  "longDescription": "Uitgebreide beschrijving in HTML",
  "bulletPoints": ["Array van selling points"],
  "metaTitle": "SEO titel",
  "metaDescription": "SEO beschrijving"
}',
  '{
    "type": "object",
    "properties": {
      "shortDescription": {"type": "string", "maxLength": 150},
      "longDescription": {"type": "string"},
      "bulletPoints": {"type": "array", "items": {"type": "string"}},
      "metaTitle": {"type": "string"},
      "metaDescription": {"type": "string"}
    },
    "required": ["shortDescription", "longDescription", "bulletPoints"]
  }'::jsonb,
  'published',
  'package',
  12
),
-- Email Campaign Playbook
(
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
  'email-campaign',
  'Email Campagne Generator',
  'email',
  'Genereer een complete email campagne met meerdere varianten.',
  '{
    "type": "object",
    "properties": {
      "campaignGoal": {
        "type": "string",
        "title": "Campagne Doel",
        "enum": ["sales", "awareness", "retention", "newsletter"],
        "default": "sales"
      },
      "product": {
        "type": "string",
        "title": "Product/Aanbieding",
        "description": "Het product of de aanbieding die je wilt promoten"
      },
      "urgency": {
        "type": "string",
        "title": "Urgentie",
        "enum": ["none", "low", "medium", "high"],
        "default": "medium"
      },
      "variants": {
        "type": "number",
        "title": "Aantal Varianten",
        "description": "Hoeveel A/B test varianten?",
        "default": 2,
        "minimum": 1,
        "maximum": 3
      }
    },
    "required": ["campaignGoal", "product"]
  }'::jsonb,
  'Je bent een email marketing specialist met expertise in conversie-optimalisatie.

Maak een email campagne:
Doel: {{campaignGoal}}
Product/Aanbieding: {{product}}
Urgentie niveau: {{urgency}}
Aantal varianten: {{variants}}

{{#if client_context}}
CLIENT CONTEXT:
- Bedrijf: {{client_name}}
- Propositie: {{client_context.proposition}}
- Doelgroep: {{client_context.targetAudience}}
- Tone of voice: {{client_context.toneOfVoice}}
{{#if client_context.doNots}}
⚠️ VERBODEN: {{client_context.doNots}}
{{/if}}
{{#if client_context.mustHaves}}
✓ VERPLICHT: {{client_context.mustHaves}}
{{/if}}
{{/if}}

Lever het resultaat als JSON:
{
  "subject_lines": ["Array van onderwerpregel varianten"],
  "preview_text": "Preview tekst",
  "variants": [
    {
      "name": "Variant A",
      "headline": "...",
      "body": "... (HTML)",
      "cta_text": "..."
    }
  ]
}',
  '{
    "type": "object",
    "properties": {
      "subject_lines": {"type": "array", "items": {"type": "string"}},
      "preview_text": {"type": "string"},
      "variants": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "headline": {"type": "string"},
            "body": {"type": "string"},
            "cta_text": {"type": "string"}
          },
          "required": ["name", "headline", "body", "cta_text"]
        }
      }
    },
    "required": ["subject_lines", "variants"]
  }'::jsonb,
  'published',
  'mail',
  15
),
-- Google Ads Copy Playbook
(
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
  'google-ads-copy',
  'Google Ads Copy Generator',
  'ads',
  'Genereer Google Ads headlines en descriptions die voldoen aan karakterlimieten.',
  '{
    "type": "object",
    "properties": {
      "product": {
        "type": "string",
        "title": "Product/Dienst",
        "description": "Wat wil je adverteren?"
      },
      "keywords": {
        "type": "string",
        "title": "Trefwoorden",
        "description": "Belangrijkste zoektermen (komma-gescheiden)"
      },
      "usp": {
        "type": "string",
        "title": "USP",
        "description": "Belangrijkste unique selling point"
      },
      "cta": {
        "type": "string",
        "title": "Call-to-Action",
        "enum": ["shop-now", "learn-more", "get-quote", "contact", "sign-up"],
        "default": "shop-now"
      }
    },
    "required": ["product", "keywords"]
  }'::jsonb,
  'Je bent een Google Ads specialist met focus op hoge CTR.

Maak Google Ads teksten voor:
Product/Dienst: {{product}}
Trefwoorden: {{keywords}}
{{#if usp}}USP: {{usp}}{{/if}}
CTA: {{cta}}

{{#if client_context}}
CLIENT CONTEXT:
- Bedrijf: {{client_name}}
- Propositie: {{client_context.proposition}}
- USPs: {{client_context.usps}}
{{#if client_context.doNots}}
⚠️ VERBODEN CLAIMS: {{client_context.doNots}}
{{/if}}
{{#if client_context.mustHaves}}
✓ VERPLICHTE TEKST: {{client_context.mustHaves}}
{{/if}}
{{/if}}

BELANGRIJK:
- Headlines: MAX 30 tekens per headline
- Descriptions: MAX 90 tekens per description
- Lever minimaal 15 headlines en 4 descriptions

Lever als JSON:
{
  "headlines": ["Array van headlines (max 30 tekens elk)"],
  "descriptions": ["Array van descriptions (max 90 tekens elk)"],
  "responsive_search_ad": {
    "headlines": ["Eerste 3 headlines voor RSA"],
    "descriptions": ["Eerste 2 descriptions voor RSA"]
  }
}',
  '{
    "type": "object",
    "properties": {
      "headlines": {
        "type": "array",
        "items": {"type": "string", "maxLength": 30},
        "minItems": 15
      },
      "descriptions": {
        "type": "array",
        "items": {"type": "string", "maxLength": 90},
        "minItems": 4
      },
      "responsive_search_ad": {
        "type": "object",
        "properties": {
          "headlines": {"type": "array", "items": {"type": "string"}},
          "descriptions": {"type": "array", "items": {"type": "string"}}
        }
      }
    },
    "required": ["headlines", "descriptions"]
  }'::jsonb,
  'published',
  'megaphone',
  12
)
ON CONFLICT (slug) DO NOTHING;

-- ===========================================
-- Done! Playbooks system is now set up.
-- ===========================================
