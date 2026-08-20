
CREATE OR REPLACE VIEW public.v_source_yield AS
WITH per_opp AS (
  SELECT o.id, coalesce(o.source,'unknown') AS source, o.is_active, o.merged_into,
    o.organizer_email, o.organizer_name, o.deadline, o.event_date,
    o.fee_estimate_min, o.vertical_slug, o.created_at,
    EXISTS (SELECT 1 FROM public.opportunity_topics t WHERE t.opportunity_id = o.id) AS has_topics,
    (SELECT avg(s.ai_score) FROM public.opportunity_scores s WHERE s.opportunity_id = o.id) AS avg_score,
    (SELECT max(s.ai_score) FROM public.opportunity_scores s WHERE s.opportunity_id = o.id) AS max_score,
    EXISTS (SELECT 1 FROM public.opportunity_scores s WHERE s.opportunity_id = o.id
            AND s.pipeline_stage IS NOT NULL AND s.pipeline_stage <> 'new') AS in_pipeline,
    EXISTS (SELECT 1 FROM public.opportunity_scores s WHERE s.opportunity_id = o.id
            AND s.pipeline_stage IN ('accepted','completed')) AS won
  FROM public.opportunities o
)
SELECT source,
  count(*) AS total_rows,
  count(*) FILTER (WHERE is_active) AS active_rows,
  count(*) FILTER (WHERE merged_into IS NOT NULL) AS merged_rows,
  count(*) FILTER (WHERE coalesce(organizer_email,'') <> '') AS with_organizer_email,
  count(*) FILTER (WHERE coalesce(organizer_name,'') <> '') AS with_organizer_name,
  count(*) FILTER (WHERE deadline IS NOT NULL) AS with_deadline,
  count(*) FILTER (WHERE event_date IS NOT NULL) AS with_event_date,
  count(*) FILTER (WHERE fee_estimate_min IS NOT NULL) AS with_fee,
  count(*) FILTER (WHERE vertical_slug IS NOT NULL) AS with_vertical,
  count(*) FILTER (WHERE has_topics) AS with_topics,
  round(avg(avg_score), 1) AS avg_score,
  max(max_score) AS max_score,
  count(*) FILTER (WHERE in_pipeline) AS opportunities_in_pipeline,
  count(*) FILTER (WHERE won) AS accepted_or_completed,
  min(created_at) AS first_seen,
  max(created_at) AS last_seen
FROM per_opp
GROUP BY source;

ALTER VIEW public.v_source_yield SET (security_invoker = on);
GRANT SELECT ON public.v_source_yield TO authenticated, service_role;
