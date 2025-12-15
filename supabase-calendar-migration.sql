-- ===========================================
-- YourFellow Performance - Calendar Enhancement Migration
-- ===========================================
-- Run dit in Supabase SQL Editor

-- 1. Add client_id column to marketing_events
ALTER TABLE public.marketing_events
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- 2. Update event_type constraint to include new types
ALTER TABLE public.marketing_events
DROP CONSTRAINT IF EXISTS marketing_events_event_type_check;

ALTER TABLE public.marketing_events
ADD CONSTRAINT marketing_events_event_type_check
CHECK (event_type IN ('holiday', 'sale', 'campaign', 'deadline', 'life', 'launch'));

-- 3. Create index for client_id
CREATE INDEX IF NOT EXISTS idx_marketing_events_client_id ON public.marketing_events(client_id);

-- 4. Update RLS policies for client-specific events
DROP POLICY IF EXISTS "Users can view global events" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can view their events" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can view client events" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can create events" ON public.marketing_events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.marketing_events;

-- View: Global events visible to all authenticated users
CREATE POLICY "View global events" ON public.marketing_events
FOR SELECT TO authenticated
USING (is_global = TRUE);

-- View: Personal events (created by user, no client)
CREATE POLICY "View personal events" ON public.marketing_events
FOR SELECT TO authenticated
USING (created_by = auth.uid() AND client_id IS NULL AND is_global = FALSE);

-- View: Client events (user has access to client)
CREATE POLICY "View client events" ON public.marketing_events
FOR SELECT TO authenticated
USING (
  client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.client_memberships
    WHERE client_id = marketing_events.client_id
    AND user_id = auth.uid()
  )
);

-- Create: Users can create personal or client events
CREATE POLICY "Create events" ON public.marketing_events
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    -- Personal event (no client)
    client_id IS NULL
    OR
    -- Client event (user has editor+ access)
    EXISTS (
      SELECT 1 FROM public.client_memberships
      WHERE client_id = marketing_events.client_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'editor')
    )
  )
  -- Only admins can create global events
  AND (
    is_global = FALSE
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
);

-- Delete: Users can delete their own events
CREATE POLICY "Delete own events" ON public.marketing_events
FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- Admins can delete any event
CREATE POLICY "Admins delete any event" ON public.marketing_events
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
