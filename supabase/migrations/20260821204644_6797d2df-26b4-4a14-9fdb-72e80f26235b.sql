CREATE TABLE IF NOT EXISTS public.organizer_email_fill_log_20260821b (
  opportunity_id uuid,
  domain text,
  email text,
  filled_at timestamptz DEFAULT now()
);
ALTER TABLE public.organizer_email_fill_log_20260821b ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizer_email_fill_log_20260821b FROM anon, authenticated;
GRANT ALL ON public.organizer_email_fill_log_20260821b TO service_role;

WITH m AS (
  SELECT o.id AS opportunity_id, c.domain, c.email
  FROM public.opportunities o
  JOIN public.organizer_contacts c
    ON o.event_url ILIKE '%' || c.domain || '%'
  WHERE o.organizer_email IS NULL
    AND o.is_active = true
    AND o.merged_into IS NULL
    AND c.email IS NOT NULL
),
pick AS (
  SELECT DISTINCT ON (opportunity_id) opportunity_id, domain, email
  FROM m ORDER BY opportunity_id, length(domain) DESC
),
logged AS (
  INSERT INTO public.organizer_email_fill_log_20260821b (opportunity_id, domain, email)
  SELECT opportunity_id, domain, email FROM pick
  RETURNING opportunity_id, email
)
UPDATE public.opportunities o
SET organizer_email = l.email
FROM logged l
WHERE o.id = l.opportunity_id AND o.organizer_email IS NULL;