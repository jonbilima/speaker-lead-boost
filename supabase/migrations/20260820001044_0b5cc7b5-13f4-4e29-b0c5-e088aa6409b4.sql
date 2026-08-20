
-- 1. Snapshot
CREATE TABLE IF NOT EXISTS public.opportunities_source_backup_20260820 AS
SELECT id, source, ingest_source FROM public.opportunities;
ALTER TABLE public.opportunities_source_backup_20260820 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunities_source_backup_20260820 FROM anon, authenticated;
GRANT ALL ON public.opportunities_source_backup_20260820 TO service_role;

-- 2. Normalize source names
UPDATE public.opportunities SET source = CASE
  WHEN lower(trim(source)) = 'meetup' THEN 'meetup'
  WHEN lower(trim(source)) = 'eventbrite' THEN 'eventbrite'
  WHEN lower(trim(source)) = 'sessionize' THEN 'sessionize'
  WHEN lower(trim(source)) = 'callingallpapers' THEN 'callingallpapers'
  WHEN lower(trim(source)) LIKE 'devopsdays%' THEN 'devopsdays'
  WHEN lower(trim(source)) = 'twitter' THEN 'twitter'
  WHEN lower(trim(source)) = 'manual' THEN 'manual'
  WHEN lower(trim(source)) = 'test' THEN 'test'
  WHEN ingest_source = 'ingest-leads' THEN 'ingest-leads'
  ELSE lower(trim(source))
END
WHERE source IS NOT NULL
  AND source IS DISTINCT FROM (CASE
  WHEN lower(trim(source)) = 'meetup' THEN 'meetup'
  WHEN lower(trim(source)) = 'eventbrite' THEN 'eventbrite'
  WHEN lower(trim(source)) = 'sessionize' THEN 'sessionize'
  WHEN lower(trim(source)) = 'callingallpapers' THEN 'callingallpapers'
  WHEN lower(trim(source)) LIKE 'devopsdays%' THEN 'devopsdays'
  WHEN lower(trim(source)) = 'twitter' THEN 'twitter'
  WHEN lower(trim(source)) = 'manual' THEN 'manual'
  WHEN lower(trim(source)) = 'test' THEN 'test'
  WHEN ingest_source = 'ingest-leads' THEN 'ingest-leads'
  ELSE lower(trim(source))
END);

-- 3. Yield views
CREATE OR REPLACE VIEW public.v_source_yield AS
SELECT
  coalesce(o.source, 'unknown') AS source,
  count(*) AS total_rows,
  count(*) FILTER (WHERE o.is_active) AS active_rows,
  count(*) FILTER (WHERE o.merged_into IS NOT NULL) AS merged_rows,
  count(*) FILTER (WHERE coalesce(o.organizer_email,'') <> '') AS with_organizer_email,
  count(*) FILTER (WHERE coalesce(o.organizer_name,'') <> '') AS with_organizer_name,
  count(*) FILTER (WHERE o.deadline IS NOT NULL) AS with_deadline,
  count(*) FILTER (WHERE o.event_date IS NOT NULL) AS with_event_date,
  count(*) FILTER (WHERE o.fee_estimate_min IS NOT NULL) AS with_fee,
  count(*) FILTER (WHERE o.vertical_slug IS NOT NULL) AS with_vertical,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.opportunity_topics t WHERE t.opportunity_id = o.id)) AS with_topics,
  round(avg(s.ai_score), 1) AS avg_score,
  max(s.ai_score) AS max_score,
  count(DISTINCT s.opportunity_id) FILTER (WHERE s.pipeline_stage IS NOT NULL AND s.pipeline_stage <> 'new') AS opportunities_in_pipeline,
  count(*) FILTER (WHERE s.pipeline_stage IN ('accepted','completed')) AS accepted_or_completed,
  min(o.created_at) AS first_seen,
  max(o.created_at) AS last_seen
FROM public.opportunities o
LEFT JOIN public.opportunity_scores s ON s.opportunity_id = o.id
GROUP BY 1;

CREATE OR REPLACE VIEW public.v_source_yield_daily AS
SELECT
  coalesce(source, 'unknown') AS source,
  date_trunc('day', created_at)::date AS day,
  count(*) AS rows_added,
  count(*) FILTER (WHERE is_active) AS active_rows_added
FROM public.opportunities
GROUP BY 1, 2;

REVOKE ALL ON public.v_source_yield FROM anon, authenticated;
REVOKE ALL ON public.v_source_yield_daily FROM anon, authenticated;
GRANT SELECT ON public.v_source_yield TO authenticated, service_role;
GRANT SELECT ON public.v_source_yield_daily TO authenticated, service_role;
