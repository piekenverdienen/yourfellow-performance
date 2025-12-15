-- ===========================================
-- YourFellow Performance - Calendar Enhancement Migration
-- ===========================================
-- Adds client_id to marketing_events for project-specific events
-- Adds 'life' event type for personal events (birthdays, etc.)

-- 1. Add client_id column to marketing_events
ALTER TABLE public.marketing_events
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- 2. Update event_type constraint to include 'life' for personal events
ALTER TABLE public.marketing_events
DROP CONSTRAINT IF EXISTS marketing_events_event_type_check;

ALTER TABLE public.marketing_events
ADD CONSTRAINT marketing_events_event_type_check
CHECK (event_type IN ('holiday', 'sale', 'campaign', 'deadline', 'life', 'launch'));

-- 3. Create index for client_id for better query performance
CREATE INDEX IF NOT EXISTS idx_marketing_events_client_id ON public.marketing_events(client_id);

-- 4. Update RLS policies to include client-based access

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view global events" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can create events" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can update own events" ON public.marketing_events;

-- New SELECT policy: can see global events, own events, or events for clients they have access to
CREATE POLICY "Users can view accessible events"
ON public.marketing_events FOR SELECT
USING (
  is_global = TRUE
  OR created_by = auth.uid()
  OR (
    client_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.client_memberships
      WHERE client_id = marketing_events.client_id
      AND user_id = auth.uid()
    )
  )
);

-- New INSERT policy: can create events for self or for clients they have editor+ access to
CREATE POLICY "Users can create events"
ON public.marketing_events FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (
    -- Personal event (no client)
    client_id IS NULL
    -- OR client event where user has editor+ access
    OR EXISTS (
      SELECT 1 FROM public.client_memberships
      WHERE client_id = marketing_events.client_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'editor')
    )
  )
  -- Only admins can create global events
  AND (
    is_global = FALSE
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- New UPDATE policy: can update own events
CREATE POLICY "Users can update own events"
ON public.marketing_events FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- New DELETE policy: can delete own events or admin can delete any
CREATE POLICY "Users can delete own events"
ON public.marketing_events FOR DELETE
USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. Add some sample life events (optional - remove if not wanted)
-- INSERT INTO public.marketing_events (title, description, event_date, event_type, color, is_global) VALUES
--   ('Voorbeeld: Team uitje', 'Jaarlijks team evenement', '2025-03-15', 'life', '#8B5CF6', FALSE);

-- Done!
-- Run this migration in Supabase SQL Editor after the initial setup
