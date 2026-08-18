create table if not exists public.opportunities_ingest_repair_backup_20260818 as
select id, is_active, event_date, deadline from public.opportunities where ingest_source = 'ingest-leads';

-- 1) Repair mis-parsed event_date values (month+day with no year parsed to year 2001/2010)
update public.opportunities o
set event_date = (
  to_timestamp(
    (regexp_match(o.raw_data->>'event_date', '(?i)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})'))[1]
    || ' ' || (regexp_match(o.raw_data->>'event_date', '(?i)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})'))[2]
    || ' ' || extract(year from now())::int,
    'Mon DD YYYY'
  )
)
where o.ingest_source = 'ingest-leads'
  and o.event_date is not null
  and extract(year from o.event_date) < extract(year from now()) - 0
  and o.raw_data->>'event_date' ~* '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}';

-- 2) Reactivate rows that were never genuinely expired
update public.opportunities
set is_active = true
where ingest_source = 'ingest-leads'
  and is_active = false
  and coalesce(lower(raw_data->>'is_open'), '1') not in ('0','false','no','closed','n','f')
  and coalesce(deadline, event_date) is not null
  and coalesce(deadline, event_date) > now();