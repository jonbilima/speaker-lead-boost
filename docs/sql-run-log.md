# SQL Run Log

Every SQL statement executed against the production database by the agent, newest run last.
Purpose: make failed/red statements recoverable and auditable after the fact.

Format per entry: UTC timestamp, intent, statement, result.

---

## 2026-08-18 21:44 UTC — read-only audit (cache lifecycle question)

```sql
-- OK: 48471 total, 48471 with reason_codes, 16 null ai_score
select count(*) total, count(reason_codes) with_codes,
       count(*) filter (where ai_score is null) null_score,
       min(calculated_at) oldest, max(calculated_at) newest
from public.opportunity_scores;

-- OK: [] (no triggers on scoring-relevant tables)
select tgname, tgrelid::regclass::text as tbl, pg_get_triggerdef(oid)
from pg_trigger where not tgisinternal
  and tgrelid::regclass::text in ('public.opportunities','public.profiles',
                                  'public.user_topics','public.opportunity_scores');

-- OK: 2 cron jobs (scrape-all-sources 6h, deactivate-expired-opportunities daily)
select jobname, schedule, command from cron.job;

-- ERROR 42703: column o.updated_at does not exist  <-- the "red error", rejected before writing
select ... from public.opportunity_scores s
join public.opportunities o on o.id=s.opportunity_id where o.updated_at is null;

-- OK (retry without the bad column): active_opps 721, profiles 66, scored_users 66,
--     null_scores 16, stale_rows 885, opps_after_run 0
select (select count(*) from public.opportunities o
        where o.is_active and o.created_at > '2026-08-18 21:40:00+00') as opps_after_run,
       (select count(*) from public.opportunities where is_active) as active_opps,
       (select count(distinct user_id) from public.opportunity_scores) as scored_users,
       (select count(*) from public.profiles) as profiles,
       (select count(*) from public.opportunity_scores where ai_score is null) as null_scores,
       (select count(*) from public.opportunity_scores
        where calculated_at < '2026-08-18'::date) as stale_rows;
```

## 2026-08-18 21:47 UTC — triage of null/stale rows (read-only)

```sql
-- OK: all 16 null-score rows are is_active = false
select o.is_active, count(*) from public.opportunity_scores s
join public.opportunities o on o.id=s.opportunity_id
where s.ai_score is null group by 1;

-- OK: all 885 stale rows are is_active = false; 46 of them are in a user pipeline
select o.is_active, count(*) as stale_rows,
       count(*) filter (where s.pipeline_stage is not null and s.pipeline_stage <> 'new') as in_pipeline
from public.opportunity_scores s join public.opportunities o on o.id=s.opportunity_id
where s.calculated_at < '2026-08-18'::date group by 1;

-- OK: 0 orphan score rows
select count(*) as orphan_scores from public.opportunity_scores s
left join public.opportunities o on o.id=s.opportunity_id where o.id is null;

-- OK: expected 47586, have 47586 (active coverage exact)
select (select count(*) from public.opportunities where is_active)
     * (select count(*) from public.profiles) as expected,
       (select count(*) from public.opportunity_scores s
        join public.opportunities o on o.id=s.opportunity_id where o.is_active) as have;
```
