WITH pick AS (
  SELECT r.opportunity_id, r.resolved_domain AS domain, c.email
  FROM public.aggregator_domain_resolution_20260821 r
  JOIN public.organizer_contacts c ON c.domain = r.resolved_domain
  JOIN public.opportunities o ON o.id = r.opportunity_id
  WHERE c.email IS NOT NULL
    AND o.organizer_email IS NULL
    AND o.is_active = true
    AND o.merged_into IS NULL
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