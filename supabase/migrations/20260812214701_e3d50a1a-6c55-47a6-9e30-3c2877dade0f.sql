CREATE TABLE public.speaking_opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name text NOT NULL,
  organization text,
  topic_or_industry text,
  location text,
  event_date text,
  application_deadline text,
  application_link text UNIQUE,
  vertical_tag text,
  source_name text,
  speaker_access text,
  is_open boolean,
  days_until_deadline text,
  lead_quality text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.speaking_opportunities TO authenticated;
GRANT ALL ON public.speaking_opportunities TO service_role;

ALTER TABLE public.speaking_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read speaking opportunities"
ON public.speaking_opportunities
FOR SELECT
TO authenticated
USING (true);