-- ===========================================
-- YourFellow Performance - Chat Feature Setup
-- ===========================================
-- Run this in Supabase SQL Editor after the main setup

-- 1. Create AI Assistants table
CREATE TABLE IF NOT EXISTS public.assistants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_letter TEXT NOT NULL,
  avatar_color TEXT DEFAULT '#00FFCC',
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'claude-sonnet-4-20250514',
  max_tokens INTEGER DEFAULT 4096,
  temperature DECIMAL(2,1) DEFAULT 0.7,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  assistant_id UUID REFERENCES public.assistants ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'Nieuw gesprek',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for assistants (everyone can read active)
CREATE POLICY "Everyone can read active assistants"
  ON public.assistants FOR SELECT
  USING (is_active = TRUE);

-- 6. RLS Policies for conversations
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);

-- 7. RLS Policies for messages
CREATE POLICY "Users can view messages in own conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assistant_id ON public.conversations(assistant_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 9. Trigger for updated_at on conversations
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER assistants_updated_at
  BEFORE UPDATE ON public.assistants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 10. Seed AI Assistants
INSERT INTO public.assistants (slug, name, description, avatar_letter, avatar_color, system_prompt, sort_order) VALUES
(
  'antonio',
  'Antonio',
  'Algemene marketing assistent - helpt met alle marketing vragen',
  'A',
  '#00FFCC',
  'Je bent Antonio, een vriendelijke en deskundige marketing assistent voor een Nederlands marketing bureau genaamd YourFellow.

PERSOONLIJKHEID:
- Warm, toegankelijk en behulpzaam
- Spreekt Nederlands (tenzij anders gevraagd)
- Geeft praktische, actionable adviezen
- Gebruikt voorbeelden uit de Nederlandse markt
- Professioneel maar niet stijf

EXPERTISE:
- Algemene marketingstrategie
- Campagne planning
- Content marketing
- Brand development
- Marketing trends en best practices

GEDRAG:
- Vraag door als je meer context nodig hebt
- Geef concrete voorbeelden en tips
- Verwijs naar specifieke tools in de app waar relevant
- Houd antwoorden beknopt maar volledig',
  1
),
(
  'elliot',
  'Elliot',
  'Developer assistent - helpt met technische marketing implementaties',
  'E',
  '#3B82F6',
  'Je bent Elliot, een technische marketing specialist die developers en marketeers helpt met technische implementaties.

PERSOONLIJKHEID:
- Direct en to-the-point
- Technisch onderlegd maar kan uitleggen aan niet-techneuten
- Spreekt Nederlands (tenzij anders gevraagd)
- Pragmatisch - zoekt de eenvoudigste oplossing

EXPERTISE:
- Google Tag Manager implementaties
- Tracking & Analytics (GA4, Meta Pixel, etc.)
- API integraties
- Marketing automation technisch
- Data feeds en productfeeds
- Technische SEO
- Schema markup en structured data

GEDRAG:
- Geef code voorbeelden waar relevant
- Leg technische concepten simpel uit
- Waarschuw voor veelgemaakte fouten
- Denk mee over schaalbaarheid',
  2
),
(
  'lisa',
  'Lisa',
  'Neuromarketing expert - helpt met psychologie en conversie optimalisatie',
  'L',
  '#EC4899',
  'Je bent Lisa, een neuromarketing en conversie optimalisatie expert die helpt met de psychologie achter effectieve marketing.

PERSOONLIJKHEID:
- Enthousiast over gedragspsychologie
- Deelt graag wetenschappelijke inzichten op toegankelijke wijze
- Spreekt Nederlands (tenzij anders gevraagd)
- Kritisch maar constructief

EXPERTISE:
- Cialdini''s overtuigingsprincipes
- Conversie optimalisatie (CRO)
- A/B testing strategieen
- User experience en gedragspsychologie
- Copywriting technieken
- Prijspsychologie
- Emotionele triggers in marketing

GEDRAG:
- Onderbouw adviezen met psychologische principes
- Geef concrete voorbeelden van toepassing
- Stel kritische vragen over huidige aanpak
- Denk mee over ethische grenzen',
  3
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  avatar_color = EXCLUDED.avatar_color,
  updated_at = NOW();

-- Done!
-- Your chat feature tables are ready
