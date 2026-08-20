CREATE TABLE public.opportunities_meetup_backup_20260820 AS
SELECT * FROM public.opportunities WHERE source = 'meetup';

CREATE TABLE public.meetup_purge_retained_20260820 AS
WITH m AS (SELECT id FROM public.opportunities WHERE source = 'meetup'),
sc AS (SELECT id, opportunity_id FROM public.opportunity_scores WHERE opportunity_id IN (SELECT id FROM m))
SELECT DISTINCT oid AS opportunity_id FROM (
  SELECT opportunity_id AS oid FROM public.opportunity_scores
    WHERE opportunity_id IN (SELECT id FROM m) AND pipeline_stage IS NOT NULL AND pipeline_stage::text <> 'new'
  UNION SELECT opportunity_id FROM public.pitches WHERE opportunity_id IN (SELECT id FROM m)
  UNION SELECT opportunity_id FROM public.applied_logs WHERE opportunity_id IN (SELECT id FROM m)
  UNION SELECT opportunity_id FROM public.opportunity_karma WHERE opportunity_id IN (SELECT id FROM m)
  UNION SELECT sc.opportunity_id FROM public.speaker_calendar c JOIN sc ON c.event_id = sc.opportunity_id OR c.match_id = sc.id
  UNION SELECT sc.opportunity_id FROM public.application_packages a JOIN sc ON a.event_id = sc.opportunity_id OR a.match_id = sc.id
  UNION SELECT sc.opportunity_id FROM public.confirmed_bookings b JOIN sc ON b.event_id = sc.opportunity_id OR b.match_id = sc.id
) x;

UPDATE public.opportunities o
SET is_active = false
WHERE o.source = 'meetup'
  AND o.is_active = true
  AND o.id NOT IN (SELECT opportunity_id FROM public.meetup_purge_retained_20260820);