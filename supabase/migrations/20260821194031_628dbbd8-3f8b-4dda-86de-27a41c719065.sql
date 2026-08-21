CREATE TABLE IF NOT EXISTS public.organizer_email_fill_log_20260821 (
  opportunity_id uuid PRIMARY KEY,
  filled_email text NOT NULL,
  domain text NOT NULL,
  filled_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.organizer_email_fill_log_20260821 TO service_role;
ALTER TABLE public.organizer_email_fill_log_20260821 ENABLE ROW LEVEL SECURITY;

WITH best AS (
  SELECT DISTINCT ON (o.id) o.id AS opportunity_id, c.email, c.domain
  FROM public.opportunities o
  JOIN public.organizer_contacts c
    ON c.email IS NOT NULL AND o.event_url ILIKE '%' || c.domain || '%'
  WHERE o.organizer_email IS NULL
    AND o.is_active
    AND o.merged_into IS NULL
  ORDER BY o.id, length(c.domain) DESC
),
upd AS (
  UPDATE public.opportunities o
     SET organizer_email = b.email
    FROM best b
   WHERE o.id = b.opportunity_id
     AND o.organizer_email IS NULL
  RETURNING o.id, b.email, b.domain
)
INSERT INTO public.organizer_email_fill_log_20260821 (opportunity_id, filled_email, domain)
SELECT id, email, domain FROM upd
ON CONFLICT (opportunity_id) DO NOTHING;