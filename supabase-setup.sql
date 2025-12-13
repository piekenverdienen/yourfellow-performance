-- ===========================================
-- YourFellow Performance - Database Setup
-- ===========================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/sbrdvpqgdmwgacteitys/sql/new

-- 1. Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'marketer' CHECK (role IN ('admin', 'marketer', 'client')),
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  -- User preferences
  company_name TEXT,
  industry TEXT,
  preferred_tone TEXT DEFAULT 'professional' CHECK (preferred_tone IN ('professional', 'casual', 'friendly', 'formal', 'creative')),
  preferred_language TEXT DEFAULT 'nl',
  target_audience TEXT,
  brand_voice TEXT,
  -- Stats
  total_generations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create usage tracking table
CREATE TABLE IF NOT EXISTS public.usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  tool TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create generated content history
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  tool TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create marketing events table (for calendar)
CREATE TABLE IF NOT EXISTS public.marketing_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_type TEXT DEFAULT 'campaign' CHECK (event_type IN ('holiday', 'sale', 'campaign', 'deadline')),
  color TEXT DEFAULT '#00FFCC',
  created_by UUID REFERENCES public.profiles,
  is_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for profiles
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
  ON public.profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 7. RLS Policies for usage
CREATE POLICY "Users can view own usage" 
  ON public.usage FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" 
  ON public.usage FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 8. RLS Policies for generations
CREATE POLICY "Users can view own generations" 
  ON public.generations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations" 
  ON public.generations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations" 
  ON public.generations FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations" 
  ON public.generations FOR DELETE 
  USING (auth.uid() = user_id);

-- 9. RLS Policies for marketing events
CREATE POLICY "Everyone can view global events" 
  ON public.marketing_events FOR SELECT 
  USING (is_global = TRUE OR created_by = auth.uid());

CREATE POLICY "Users can create events" 
  ON public.marketing_events FOR INSERT 
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own events" 
  ON public.marketing_events FOR UPDATE 
  USING (auth.uid() = created_by);

-- 10. Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Function to update XP and level
CREATE OR REPLACE FUNCTION public.add_xp(user_uuid UUID, xp_amount INTEGER)
RETURNS void AS $$
DECLARE
  current_xp INTEGER;
  new_xp INTEGER;
  new_level INTEGER;
BEGIN
  SELECT xp INTO current_xp FROM public.profiles WHERE id = user_uuid;
  new_xp := current_xp + xp_amount;
  new_level := FLOOR(new_xp / 100) + 1;
  
  UPDATE public.profiles 
  SET xp = new_xp, level = new_level, updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Trigger for updated_at on profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 15. Insert some default marketing events
INSERT INTO public.marketing_events (title, description, event_date, event_type, color, is_global) VALUES
  ('Cyber Monday', 'Grote online kortingsdag', '2025-12-01', 'sale', '#EF4444', TRUE),
  ('Sinterklaasavond', 'Pakjesavond in Nederland', '2025-12-05', 'holiday', '#F97316', TRUE),
  ('Kerst', 'Eerste Kerstdag', '2025-12-25', 'holiday', '#22C55E', TRUE),
  ('Tweede Kerstdag', 'Tweede Kerstdag', '2025-12-26', 'holiday', '#22C55E', TRUE),
  ('Oud & Nieuw', 'Oudjaarsavond', '2025-12-31', 'holiday', '#8B5CF6', TRUE),
  ('Blue Monday', 'Meest deprimerende dag - perfect voor positieve marketing', '2025-01-20', 'campaign', '#3B82F6', TRUE),
  ('Valentijnsdag', 'Dag van de liefde', '2025-02-14', 'holiday', '#EC4899', TRUE),
  ('Black Friday', 'Grootste shopping dag', '2025-11-28', 'sale', '#000000', TRUE)
ON CONFLICT DO NOTHING;

-- 16. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON public.usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON public.usage(created_at);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_tool ON public.generations(tool);
CREATE INDEX IF NOT EXISTS idx_marketing_events_date ON public.marketing_events(event_date);

-- 17. Migration for existing profiles table (run if updating existing database)
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS industry TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_tone TEXT DEFAULT 'professional';
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'nl';
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_audience TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_voice TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_generations INTEGER DEFAULT 0;

-- 18. Function to add XP and track generation
CREATE OR REPLACE FUNCTION public.record_generation(
  user_uuid UUID,
  tool_name TEXT,
  xp_amount INTEGER DEFAULT 10
)
RETURNS void AS $$
BEGIN
  -- Add XP
  PERFORM public.add_xp(user_uuid, xp_amount);

  -- Increment total generations
  UPDATE public.profiles
  SET total_generations = total_generations + 1
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 19. Function to get user stats
CREATE OR REPLACE FUNCTION public.get_user_stats(user_uuid UUID)
RETURNS TABLE (
  total_generations BIGINT,
  generations_today BIGINT,
  current_xp INTEGER,
  current_level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.total_generations::BIGINT,
    (SELECT COUNT(*) FROM public.usage WHERE user_id = user_uuid AND created_at >= CURRENT_DATE)::BIGINT,
    p.xp,
    p.level
  FROM public.profiles p
  WHERE p.id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done!
-- Your database is now ready for YourFellow Performance
