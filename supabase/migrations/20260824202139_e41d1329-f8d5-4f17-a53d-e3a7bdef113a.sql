CREATE TABLE public.organizer_email_fill_log_20260824b AS
SELECT o.id AS opportunity_id, o.organizer_email AS old_email, oc.email AS new_email, now() AS filled_at
FROM public.opportunities o
JOIN public.organizer_name_resolution_20260824 r ON r.opportunity_id = o.id
JOIN public.organizer_contacts oc ON oc.domain = r.resolved_domain
WHERE oc.email IS NOT NULL AND (o.organizer_email IS NULL OR o.organizer_email = '');

ALTER TABLE public.organizer_email_fill_log_20260824b ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.organizer_email_fill_log_20260824b TO service_role;

UPDATE public.opportunities o
SET organizer_email = l.new_email
FROM public.organizer_email_fill_log_20260824b l
WHERE o.id = l.opportunity_id AND (o.organizer_email IS NULL OR o.organizer_email = '');