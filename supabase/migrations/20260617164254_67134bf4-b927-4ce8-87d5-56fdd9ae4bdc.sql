-- 1) calendar_connections: prevent OAuth tokens from ever reaching the browser.
--    Replace table-wide grants with column-scoped grants that exclude the token columns.
REVOKE ALL ON public.calendar_connections FROM authenticated;
REVOKE ALL ON public.calendar_connections FROM anon;

GRANT SELECT (
  id, speaker_id, provider, email, calendar_id, is_active,
  auto_sync_speaking, show_external_events, last_sync_at, sync_errors,
  created_at, updated_at
) ON public.calendar_connections TO authenticated;

GRANT INSERT (
  id, speaker_id, provider, email, calendar_id, is_active,
  auto_sync_speaking, show_external_events, last_sync_at, sync_errors
) ON public.calendar_connections TO authenticated;

GRANT UPDATE (
  email, calendar_id, is_active, auto_sync_speaking,
  show_external_events, last_sync_at, sync_errors
) ON public.calendar_connections TO authenticated;

GRANT DELETE ON public.calendar_connections TO authenticated;

-- Server-side code (edge functions) keeps full access to read/write tokens.
GRANT ALL ON public.calendar_connections TO service_role;

-- 2) event_feedback: drop always-true public policies (app uses the
--    get_feedback_by_token RPC for reads and a service-role function for writes).
DROP POLICY IF EXISTS "Public can view feedback by token" ON public.event_feedback;
DROP POLICY IF EXISTS "Public can submit feedback via token" ON public.event_feedback;

-- 3) inbound_leads: only allow public submissions attributed to a real public speaker.
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.inbound_leads;
CREATE POLICY "Anyone can submit leads to public speakers"
ON public.inbound_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = inbound_leads.speaker_id
      AND p.is_public = true
  )
);