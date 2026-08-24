CREATE TABLE public.organizer_name_resolution_20260824 (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL,
  search_term text NOT NULL,
  resolved_domain text,
  confidence numeric(4,3) NOT NULL DEFAULT 0,
  crawled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX organizer_name_resolution_20260824_opp_idx
  ON public.organizer_name_resolution_20260824 (opportunity_id);
CREATE INDEX organizer_name_resolution_20260824_domain_idx
  ON public.organizer_name_resolution_20260824 (resolved_domain);

GRANT SELECT ON public.organizer_name_resolution_20260824 TO authenticated;
GRANT ALL ON public.organizer_name_resolution_20260824 TO service_role;

ALTER TABLE public.organizer_name_resolution_20260824 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read organizer name resolution"
  ON public.organizer_name_resolution_20260824
  FOR SELECT TO authenticated USING (true);