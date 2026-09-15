CREATE TABLE public.ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL DEFAULT 'ingest-leads',
  status text NOT NULL DEFAULT 'success',
  received integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  invalid integer NOT NULL DEFAULT 0,
  enriched_rows integer NOT NULL DEFAULT 0,
  enriched_fields integer NOT NULL DEFAULT 0,
  matched_by_event_url integer NOT NULL DEFAULT 0,
  matched_by_canonical_url integer NOT NULL DEFAULT 0,
  matched_by_fingerprint integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ingest_runs TO authenticated;
GRANT ALL ON public.ingest_runs TO service_role;

ALTER TABLE public.ingest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ingest runs"
ON public.ingest_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ingest_runs_created_at ON public.ingest_runs (created_at DESC);

CREATE TRIGGER update_ingest_runs_updated_at
BEFORE UPDATE ON public.ingest_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();