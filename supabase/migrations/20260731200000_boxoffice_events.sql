-- Idempotency ledger for Box Office fulfillment events processed by the
-- boxoffice-webhook edge function. Service-role only; no client access.
CREATE TABLE public.boxoffice_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.boxoffice_events ENABLE ROW LEVEL SECURITY;
-- no policies on purpose: only the service role (which bypasses RLS) touches it
