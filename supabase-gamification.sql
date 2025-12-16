-- ===========================================
-- YourFellow Performance - Gamification Extension
-- ===========================================
-- Run this AFTER supabase-setup.sql
-- Adds: Leaderboard, Streaks, Achievements, Kudos

-- ===========================================
-- 1. USER STREAKS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE UNIQUE NOT NULL,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  streak_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for streaks
CREATE POLICY "Users can view own streaks"
  ON public.user_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view all streaks for leaderboard"
  ON public.user_streaks FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own streaks"
  ON public.user_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON public.user_streaks FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for streaks
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON public.user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current ON public.user_streaks(current_streak DESC);

-- ===========================================
-- 2. ACHIEVEMENTS DEFINITION TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL, -- emoji or icon name
  category TEXT NOT NULL CHECK (category IN ('milestone', 'streak', 'explorer', 'social', 'special')),
  xp_reward INTEGER DEFAULT 0,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('generations', 'streak', 'tool_usage', 'level', 'kudos', 'special')),
  requirement_value INTEGER DEFAULT 1,
  requirement_tool TEXT, -- for tool-specific achievements
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Everyone can view achievements
CREATE POLICY "Everyone can view achievements"
  ON public.achievements FOR SELECT
  USING (is_active = TRUE);

-- ===========================================
-- 3. USER ACHIEVEMENTS (Earned) TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES public.achievements ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view all achievements for profiles"
  ON public.user_achievements FOR SELECT
  USING (true);

CREATE POLICY "System can insert achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON public.user_achievements(achievement_id);

-- ===========================================
-- 4. KUDOS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.kudos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  message TEXT,
  xp_amount INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent self-kudos
  CONSTRAINT no_self_kudos CHECK (from_user_id != to_user_id)
);

-- Enable RLS
ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view kudos they sent or received"
  ON public.kudos FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send kudos"
  ON public.kudos FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kudos_from ON public.kudos(from_user_id);
CREATE INDEX IF NOT EXISTS idx_kudos_to ON public.kudos(to_user_id);
CREATE INDEX IF NOT EXISTS idx_kudos_created ON public.kudos(created_at);

-- ===========================================
-- 5. MONTHLY XP TRACKING VIEW
-- ===========================================
CREATE OR REPLACE VIEW public.monthly_xp_stats AS
SELECT
  u.user_id,
  p.full_name,
  p.avatar_url,
  p.level,
  p.xp as total_xp,
  DATE_TRUNC('month', u.created_at) as month,
  COUNT(*) as generations_count,
  SUM(COALESCE(pt.xp_reward, 10)) as xp_earned
FROM public.usage u
JOIN public.profiles p ON u.user_id = p.id
LEFT JOIN public.prompt_templates pt ON u.tool = pt.key
GROUP BY u.user_id, p.full_name, p.avatar_url, p.level, p.xp, DATE_TRUNC('month', u.created_at);

-- ===========================================
-- 6. LEADERBOARD VIEW (All-time)
-- ===========================================
CREATE OR REPLACE VIEW public.leaderboard_alltime AS
SELECT
  p.id as user_id,
  p.full_name,
  p.avatar_url,
  p.xp,
  p.level,
  p.total_generations,
  COALESCE(s.current_streak, 0) as current_streak,
  COALESCE(s.longest_streak, 0) as longest_streak,
  (SELECT COUNT(*) FROM public.user_achievements ua WHERE ua.user_id = p.id) as achievement_count,
  RANK() OVER (ORDER BY p.xp DESC) as rank
FROM public.profiles p
LEFT JOIN public.user_streaks s ON p.id = s.user_id
WHERE p.xp > 0
ORDER BY p.xp DESC;

-- ===========================================
-- 7. LEADERBOARD VIEW (Monthly)
-- ===========================================
CREATE OR REPLACE VIEW public.leaderboard_monthly AS
SELECT
  p.id as user_id,
  p.full_name,
  p.avatar_url,
  p.level,
  COUNT(u.id) as generations_this_month,
  COALESCE(SUM(COALESCE(pt.xp_reward, 10)), 0) as xp_this_month,
  COALESCE(s.current_streak, 0) as current_streak,
  RANK() OVER (ORDER BY COALESCE(SUM(COALESCE(pt.xp_reward, 10)), 0) DESC) as rank
FROM public.profiles p
LEFT JOIN public.usage u ON p.id = u.user_id
  AND u.created_at >= DATE_TRUNC('month', CURRENT_DATE)
LEFT JOIN public.prompt_templates pt ON u.tool = pt.key
LEFT JOIN public.user_streaks s ON p.id = s.user_id
GROUP BY p.id, p.full_name, p.avatar_url, p.level, s.current_streak
HAVING COUNT(u.id) > 0
ORDER BY xp_this_month DESC;

-- ===========================================
-- 8. TOOL USAGE STATS VIEW
-- ===========================================
CREATE OR REPLACE VIEW public.tool_usage_stats AS
SELECT
  u.user_id,
  u.tool,
  COALESCE(pt.name, u.tool) as tool_name,
  COALESCE(pt.xp_reward, 10) as xp_per_use,
  COUNT(*) as total_uses,
  COUNT(*) FILTER (WHERE u.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as uses_this_month,
  COUNT(*) FILTER (WHERE u.created_at >= CURRENT_DATE) as uses_today
FROM public.usage u
LEFT JOIN public.prompt_templates pt ON u.tool = pt.key
GROUP BY u.user_id, u.tool, pt.name, pt.xp_reward;

-- ===========================================
-- 9. FUNCTION: Update Streak
-- ===========================================
CREATE OR REPLACE FUNCTION public.update_user_streak(user_uuid UUID)
RETURNS TABLE (
  new_streak INTEGER,
  streak_bonus INTEGER,
  is_new_record BOOLEAN
) AS $$
DECLARE
  last_date DATE;
  current_streak_val INTEGER;
  longest_streak_val INTEGER;
  today DATE := CURRENT_DATE;
  bonus INTEGER := 0;
  new_record BOOLEAN := FALSE;
BEGIN
  -- Get or create streak record
  INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_activity_date)
  VALUES (user_uuid, 0, 0, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current values
  SELECT last_activity_date, current_streak, longest_streak
  INTO last_date, current_streak_val, longest_streak_val
  FROM public.user_streaks
  WHERE user_id = user_uuid;

  -- Calculate new streak
  IF last_date IS NULL OR last_date < today - INTERVAL '1 day' THEN
    -- Streak broken or first activity
    current_streak_val := 1;
  ELSIF last_date = today - INTERVAL '1 day' THEN
    -- Consecutive day - increase streak
    current_streak_val := current_streak_val + 1;
  END IF;
  -- If same day, don't change streak

  -- Check for new record
  IF current_streak_val > longest_streak_val THEN
    longest_streak_val := current_streak_val;
    new_record := TRUE;
  END IF;

  -- Calculate bonus XP for streaks
  IF current_streak_val >= 30 THEN
    bonus := 100;
  ELSIF current_streak_val >= 7 THEN
    bonus := 25;
  ELSIF current_streak_val >= 3 THEN
    bonus := 10;
  END IF;

  -- Update streak record
  UPDATE public.user_streaks
  SET
    current_streak = current_streak_val,
    longest_streak = longest_streak_val,
    last_activity_date = today,
    streak_updated_at = NOW()
  WHERE user_id = user_uuid;

  -- Return values
  RETURN QUERY SELECT current_streak_val, bonus, new_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 10. FUNCTION: Check and Award Achievements
-- ===========================================
CREATE OR REPLACE FUNCTION public.check_achievements(user_uuid UUID)
RETURNS TABLE (
  achievement_key TEXT,
  achievement_name TEXT,
  xp_reward INTEGER
) AS $$
DECLARE
  user_data RECORD;
  streak_data RECORD;
  ach RECORD;
  tool_count INTEGER;
BEGIN
  -- Get user stats
  SELECT xp, level, total_generations INTO user_data
  FROM public.profiles WHERE id = user_uuid;

  -- Get streak data
  SELECT current_streak, longest_streak INTO streak_data
  FROM public.user_streaks WHERE user_id = user_uuid;

  -- Loop through all achievements
  FOR ach IN SELECT * FROM public.achievements WHERE is_active = TRUE LOOP
    -- Skip if already earned
    IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = user_uuid AND achievement_id = ach.id) THEN
      CONTINUE;
    END IF;

    -- Check if achievement is earned based on type
    CASE ach.requirement_type
      WHEN 'generations' THEN
        IF user_data.total_generations >= ach.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (user_uuid, ach.id);
          -- Add bonus XP
          IF ach.xp_reward > 0 THEN
            UPDATE public.profiles SET xp = xp + ach.xp_reward WHERE id = user_uuid;
          END IF;
          RETURN QUERY SELECT ach.key, ach.name, ach.xp_reward;
        END IF;

      WHEN 'streak' THEN
        IF COALESCE(streak_data.current_streak, 0) >= ach.requirement_value
           OR COALESCE(streak_data.longest_streak, 0) >= ach.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (user_uuid, ach.id);
          IF ach.xp_reward > 0 THEN
            UPDATE public.profiles SET xp = xp + ach.xp_reward WHERE id = user_uuid;
          END IF;
          RETURN QUERY SELECT ach.key, ach.name, ach.xp_reward;
        END IF;

      WHEN 'level' THEN
        IF user_data.level >= ach.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (user_uuid, ach.id);
          IF ach.xp_reward > 0 THEN
            UPDATE public.profiles SET xp = xp + ach.xp_reward WHERE id = user_uuid;
          END IF;
          RETURN QUERY SELECT ach.key, ach.name, ach.xp_reward;
        END IF;

      WHEN 'tool_usage' THEN
        SELECT COUNT(*) INTO tool_count
        FROM public.usage
        WHERE user_id = user_uuid AND tool = ach.requirement_tool;

        IF tool_count >= ach.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (user_uuid, ach.id);
          IF ach.xp_reward > 0 THEN
            UPDATE public.profiles SET xp = xp + ach.xp_reward WHERE id = user_uuid;
          END IF;
          RETURN QUERY SELECT ach.key, ach.name, ach.xp_reward;
        END IF;

      ELSE
        -- Other types handled separately
        NULL;
    END CASE;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 11. FUNCTION: Send Kudos
-- ===========================================
CREATE OR REPLACE FUNCTION public.send_kudos(
  from_uuid UUID,
  to_uuid UUID,
  kudos_message TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  kudos_today INTEGER
) AS $$
DECLARE
  kudos_count INTEGER;
  max_daily_kudos INTEGER := 3;
BEGIN
  -- Check how many kudos sent today
  SELECT COUNT(*) INTO kudos_count
  FROM public.kudos
  WHERE from_user_id = from_uuid
    AND created_at >= CURRENT_DATE;

  IF kudos_count >= max_daily_kudos THEN
    RETURN QUERY SELECT FALSE, 'Je hebt vandaag al ' || max_daily_kudos || ' kudos gegeven', kudos_count;
    RETURN;
  END IF;

  -- Can't kudos yourself
  IF from_uuid = to_uuid THEN
    RETURN QUERY SELECT FALSE, 'Je kunt jezelf geen kudos geven', kudos_count;
    RETURN;
  END IF;

  -- Insert kudos
  INSERT INTO public.kudos (from_user_id, to_user_id, message)
  VALUES (from_uuid, to_uuid, kudos_message);

  -- Add XP to receiver
  UPDATE public.profiles SET xp = xp + 5 WHERE id = to_uuid;

  RETURN QUERY SELECT TRUE, 'Kudos verzonden! +5 XP voor ' || (SELECT full_name FROM public.profiles WHERE id = to_uuid), kudos_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 12. FUNCTION: Get Daily Kudos Remaining
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_kudos_remaining(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  kudos_count INTEGER;
  max_daily INTEGER := 3;
BEGIN
  SELECT COUNT(*) INTO kudos_count
  FROM public.kudos
  WHERE from_user_id = user_uuid
    AND created_at >= CURRENT_DATE;

  RETURN max_daily - kudos_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 13. SEED ACHIEVEMENTS
-- ===========================================
INSERT INTO public.achievements (key, name, description, icon, category, xp_reward, requirement_type, requirement_value, requirement_tool, sort_order) VALUES
-- Milestone achievements
('first_blood', 'First Blood', 'Genereer je eerste content', '🎯', 'milestone', 10, 'generations', 1, NULL, 1),
('getting_started', 'Op Dreef', 'Genereer 10 stukken content', '🚀', 'milestone', 25, 'generations', 10, NULL, 2),
('content_machine', 'Content Machine', 'Genereer 50 stukken content', '⚡', 'milestone', 50, 'generations', 50, NULL, 3),
('centurion', 'Centurion', 'Genereer 100 stukken content', '💯', 'milestone', 100, 'generations', 100, NULL, 4),
('content_king', 'Content Koning', 'Genereer 500 stukken content', '👑', 'milestone', 250, 'generations', 500, NULL, 5),
('legendary', 'Legendarisch', 'Genereer 1000 stukken content', '🏆', 'milestone', 500, 'generations', 1000, NULL, 6),

-- Streak achievements
('warming_up', 'Warming Up', '3 dagen streak', '🔥', 'streak', 15, 'streak', 3, NULL, 10),
('on_fire', 'On Fire', '7 dagen streak', '🔥', 'streak', 50, 'streak', 7, NULL, 11),
('unstoppable', 'Unstoppable', '14 dagen streak', '💪', 'streak', 100, 'streak', 14, NULL, 12),
('dedicated', 'Toegewijd', '30 dagen streak', '⭐', 'streak', 250, 'streak', 30, NULL, 13),

-- Level achievements
('level_5', 'Meester', 'Bereik level 5', '🎖️', 'milestone', 50, 'level', 5, NULL, 20),
('level_10', 'AI Wizard', 'Bereik level 10', '🧙', 'milestone', 150, 'level', 10, NULL, 21),
('level_15', 'AI Visionair', 'Bereik level 15', '🔮', 'milestone', 300, 'level', 15, NULL, 22),
('level_20', 'AI Overlord', 'Bereik level 20 - Maximaal!', '👾', 'milestone', 1000, 'level', 20, NULL, 23),

-- Tool explorer achievements
('ads_expert', 'Ads Expert', 'Gebruik Google Ads Copy 25 keer', '📢', 'explorer', 50, 'tool_usage', 25, 'google-ads-copy', 30),
('social_butterfly', 'Social Butterfly', 'Gebruik Social Media Posts 25 keer', '🦋', 'explorer', 50, 'tool_usage', 25, 'social-copy', 31),
('seo_guru', 'SEO Goeroe', 'Gebruik SEO Content 25 keer', '🔍', 'explorer', 50, 'tool_usage', 25, 'seo-content', 32),
('cro_master', 'CRO Meester', 'Gebruik CRO Analyzer 10 keer', '📊', 'explorer', 75, 'tool_usage', 10, 'cro-analyzer', 33),
('feed_optimizer', 'Feed Optimizer', 'Gebruik Feed Optimalisatie 15 keer', '🛒', 'explorer', 50, 'tool_usage', 15, 'google-ads-feed', 34),

-- Special achievements (awarded manually or via special logic)
('early_adopter', 'Early Adopter', 'Een van de eerste gebruikers', '🌟', 'special', 100, 'special', 1, NULL, 50),
('monthly_champion', 'Maand Kampioen', '#1 op het maandelijkse leaderboard', '🏅', 'special', 200, 'special', 1, NULL, 51)

ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  xp_reward = EXCLUDED.xp_reward,
  requirement_value = EXCLUDED.requirement_value;

-- ===========================================
-- 14. UPDATE PROFILES RLS FOR LEADERBOARD
-- ===========================================
-- Allow users to see basic info of other users for leaderboard
DROP POLICY IF EXISTS "Users can view profiles for leaderboard" ON public.profiles;
CREATE POLICY "Users can view profiles for leaderboard"
  ON public.profiles FOR SELECT
  USING (true);

-- ===========================================
-- 15. INDEXES FOR PERFORMANCE
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_usage_user_tool ON public.usage(user_id, tool);
-- Note: DATE_TRUNC index removed (not IMMUTABLE in PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level DESC);

-- ===========================================
-- DONE! Gamification system ready
-- ===========================================
