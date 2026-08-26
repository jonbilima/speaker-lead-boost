CREATE TABLE public.opportunities_twin_merge_backup_20260826 AS
WITH norm AS (
  SELECT o.*,
    regexp_replace(trim(regexp_replace(lower(regexp_replace(o.event_name,'[^a-zA-Z0-9]+',' ','g')),'\s+',' ','g')),'^ | $','') AS nname,
    (o.raw_data ? 'location_confidence') AS isnew
  FROM public.opportunities o
  WHERE o.merged_into IS NULL
),
newr AS (SELECT * FROM norm WHERE isnew AND created_at >= '2026-08-25'),
oldr AS (SELECT * FROM norm WHERE NOT (isnew AND created_at >= '2026-08-25')),
pairs AS (
  SELECT DISTINCT n.id AS new_id, o.id AS old_id
  FROM newr n JOIN oldr o ON o.nname = n.nname
)
SELECT o.* FROM public.opportunities o
WHERE o.id IN (SELECT new_id FROM pairs) OR o.id IN (SELECT old_id FROM pairs);

ALTER TABLE public.opportunities_twin_merge_backup_20260826 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.opportunities_twin_merge_backup_20260826 TO service_role;