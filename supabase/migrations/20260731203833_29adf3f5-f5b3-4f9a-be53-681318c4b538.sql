CREATE TABLE public.boxoffice_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

GRANT ALL ON public.boxoffice_events TO service_role;

ALTER TABLE public.boxoffice_events ENABLE ROW LEVEL SECURITY;
-- no policies on purpose: only the service role (which bypasses RLS) touches it