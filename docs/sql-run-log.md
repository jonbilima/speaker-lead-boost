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

## 2026-08-18 21:48-21:52 UTC — cache lifecycle build

```sql
-- OK: migration 1 — scoring core + triggers (no columns/tables altered)
CREATE OR REPLACE FUNCTION public.score_opportunity_matches(uuid, uuid, boolean, integer) ...;
CREATE OR REPLACE FUNCTION public.score_opportunity_for_all_users(uuid) ...;
CREATE OR REPLACE FUNCTION public.score_missing_opportunities(integer) ...;
CREATE OR REPLACE FUNCTION public.trg_score_new_opportunity() ...;
CREATE OR REPLACE FUNCTION public.trg_rescore_changed_opportunity() ...;
CREATE OR REPLACE FUNCTION public.trg_rescore_opportunity_topics() ...;
CREATE TRIGGER score_new_opportunity        AFTER INSERT ON public.opportunities ...;
CREATE TRIGGER rescore_changed_opportunity  AFTER UPDATE OF fee_estimate_min, fee_estimate_max,
                                            deadline, is_active ON public.opportunities ...;
CREATE TRIGGER rescore_opportunity_topics   AFTER INSERT OR DELETE ON public.opportunity_topics ...;

-- OK: migration 2 — lock the new SECURITY DEFINER functions to service_role
REVOKE ALL ON FUNCTION public.score_opportunity_matches(uuid,uuid,boolean,integer)
  FROM PUBLIC, anon, authenticated;   -- (same for the other five)
GRANT EXECUTE ON FUNCTION public.score_missing_opportunities(integer) TO service_role;

-- OK: migration 3 — daily safety-net sweep at 07:30 UTC
SELECT cron.schedule('score-new-opportunities-daily', '30 7 * * *', $$ net.http_post(... score-new-opportunities, x-cron-secret ...) $$);

-- OK: trigger verification with a temporary throwaway row (source = 'trigger_test')
INSERT INTO public.opportunities (event_name, source, is_active, event_url, deadline, fee_estimate_min)
VALUES ('ZZ Trigger Test - safe to delete','trigger_test',true,'https://example.invalid/trigger-test',
        now() + interval '10 days', 5000) RETURNING id;      -- ed2ec56d-... -> 66 score rows written
UPDATE public.opportunities SET deadline = now() + interval '3 days' WHERE id = 'ed2ec56d-...';
                                                              -- urgency 20->100, code deadline_tight, calculated_at bumped
UPDATE public.opportunities SET event_name = '...', location = 'Nowhere' WHERE id = 'ed2ec56d-...';
                                                              -- calculated_at UNCHANGED (correct: non-scoring field)
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) SELECT 'ed2ec56d-...', <top topic>;
                                                              -- 22 users -> 80/topic_match_strong, 44 -> 20

-- ERROR 2202E: cannot accumulate arrays of different dimensionality (array_agg of reason_codes in a probe SELECT)
--   read-only diagnostic query only; re-run without array_agg succeeded.

-- OK: cleanup of all test data
DELETE FROM public.opportunity_scores  WHERE opportunity_id = 'ed2ec56d-...';
DELETE FROM public.opportunity_topics  WHERE opportunity_id = 'ed2ec56d-...';
DELETE FROM public.opportunities       WHERE id = 'ed2ec56d-...' AND source = 'trigger_test';

-- OK: post-cleanup verification — 0 leftovers, 48471 scores, 721 active opportunities (unchanged baseline)
```
