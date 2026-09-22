CREATE TABLE public.opportunities_unsupported_eventdate_backup_20260922 (
  opportunity_id uuid PRIMARY KEY REFERENCES public.opportunities(id) ON DELETE CASCADE,
  event_name text,
  source text,
  event_date_was timestamptz,
  reason text,
  cleared_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.opportunities_unsupported_eventdate_backup_20260922 TO authenticated;
GRANT ALL ON public.opportunities_unsupported_eventdate_backup_20260922 TO service_role;
ALTER TABLE public.opportunities_unsupported_eventdate_backup_20260922 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view eventdate backup"
  ON public.opportunities_unsupported_eventdate_backup_20260922
  FOR SELECT TO authenticated USING (true);

WITH a AS (
  SELECT id, event_name, source, event_date, event_date::date d, coalesce(raw_data::text,'') r
  FROM public.opportunities
  WHERE is_active AND merged_into IS NULL AND event_date IS NOT NULL
), c AS (
  SELECT * FROM a
  WHERE position(to_char(d,'YYYY-MM-DD') in r)=0
    AND position(to_char(d,'FMMonth FMDD') in r)=0
    AND position(to_char(d,'Mon FMDD') in r)=0
    AND position(to_char(d,'FMMM/FMDD/YYYY') in r)=0
    AND position(to_char(d,'MM/DD/YYYY') in r)=0
    AND position(to_char(d,'FMDD FMMonth') in r)=0
    AND position(to_char(d,'FMDD Mon') in r)=0
    AND position(to_char(d,'YYYY/MM/DD') in r)=0
    AND position(to_char(d,'DD-MM-YYYY') in r)=0
    AND position(to_char(d,'MM-DD') in r)=0
    AND position(to_char(d,'FMMonth FMDDth') in r)=0
)
INSERT INTO public.opportunities_unsupported_eventdate_backup_20260922
  (opportunity_id, event_name, source, event_date_was, reason)
SELECT id, event_name, source, event_date,
  CASE WHEN position(to_char(d,'YYYY') in r)>0 THEN 'year_only_in_source' ELSE 'no_date_in_source' END
FROM c
ON CONFLICT (opportunity_id) DO NOTHING;

UPDATE public.opportunities o
SET event_date = NULL
FROM public.opportunities_unsupported_eventdate_backup_20260922 b
WHERE o.id = b.opportunity_id AND o.event_date IS NOT NULL;