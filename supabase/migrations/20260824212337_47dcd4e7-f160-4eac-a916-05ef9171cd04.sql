CREATE TABLE public.organizer_domain_match_20260824 (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL,
  resolved_domain text NOT NULL,
  method text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizer_domain_match_20260824_opp_domain_idx
  ON public.organizer_domain_match_20260824 (opportunity_id, resolved_domain);

GRANT SELECT ON public.organizer_domain_match_20260824 TO authenticated;
GRANT ALL ON public.organizer_domain_match_20260824 TO service_role;

ALTER TABLE public.organizer_domain_match_20260824 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read organizer domain matches"
  ON public.organizer_domain_match_20260824
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE public.organizer_email_fill_log_20260824c (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL,
  old_email text,
  new_email text NOT NULL,
  method text NOT NULL,
  filled_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.organizer_email_fill_log_20260824c TO service_role;

ALTER TABLE public.organizer_email_fill_log_20260824c ENABLE ROW LEVEL SECURITY;