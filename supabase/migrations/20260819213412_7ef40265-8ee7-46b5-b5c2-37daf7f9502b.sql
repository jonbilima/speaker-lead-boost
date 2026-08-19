
CREATE TABLE public.opportunities_dedupe_backup_20260819 AS
WITH n AS (
  SELECT o.*, regexp_replace(lower(coalesce(o.event_name,'')), '[^a-z0-9]', '', 'g') AS nname, o.event_date::date AS d
  FROM public.opportunities o WHERE o.event_date IS NOT NULL AND o.merged_into IS NULL
), g AS (SELECT nname, d FROM n GROUP BY 1,2 HAVING count(*) > 1)
SELECT n.* FROM n JOIN g ON g.nname = n.nname AND g.d = n.d;

ALTER TABLE public.opportunities_dedupe_backup_20260819 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunities_dedupe_backup_20260819 FROM anon, authenticated;
GRANT ALL ON public.opportunities_dedupe_backup_20260819 TO service_role;

CREATE TABLE public.opportunity_scores_dedupe_backup_20260819 AS
SELECT s.* FROM public.opportunity_scores s
WHERE s.opportunity_id IN (SELECT id FROM public.opportunities_dedupe_backup_20260819);

ALTER TABLE public.opportunity_scores_dedupe_backup_20260819 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_scores_dedupe_backup_20260819 FROM anon, authenticated;
GRANT ALL ON public.opportunity_scores_dedupe_backup_20260819 TO service_role;

CREATE TABLE public.opportunity_topics_dedupe_backup_20260819 AS
SELECT t.* FROM public.opportunity_topics t
WHERE t.opportunity_id IN (SELECT id FROM public.opportunities_dedupe_backup_20260819);

ALTER TABLE public.opportunity_topics_dedupe_backup_20260819 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_topics_dedupe_backup_20260819 FROM anon, authenticated;
GRANT ALL ON public.opportunity_topics_dedupe_backup_20260819 TO service_role;
