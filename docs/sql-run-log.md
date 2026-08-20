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

## 2026-08-18 22:1x UTC — verticals schema + 60-row backfill

```sql
-- OK: read-only audit of ingest marker (60 rows, all with event_name + source_name)
select lower(trim(raw_data->>'vertical_tag')), count(*) from public.opportunities
where raw_data ? 'application_link' group by 1;

-- OK: migration 1 — verticals + user_verticals + opportunities columns + backup + backfill
CREATE TABLE public.verticals (slug text primary key, label text not null, sort_order int, created_at timestamptz);
GRANT SELECT ... ; ALTER TABLE ... ENABLE RLS; CREATE POLICY "Verticals are readable by everyone" ...;
INSERT INTO public.verticals (10 canonical slugs) ON CONFLICT DO NOTHING;
CREATE TABLE public.user_verticals (... unique(user_id, vertical_slug)); GRANT/RLS/3 policies;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS vertical_slug text REFERENCES public.verticals(slug);
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS ingest_source text;
CREATE TABLE public.opportunities_vertical_backup_20260818 AS SELECT id, vertical_slug, ingest_source FROM public.opportunities;
UPDATE public.opportunities SET ingest_source='ingest-leads', vertical_slug = CASE lower(trim(raw_data->>'vertical_tag')) ... END
WHERE raw_data ? 'application_link' AND raw_data ? 'event_name';   -- 60 rows

-- OK: migration 2 — lock backup table (RLS on, revoke anon/authenticated, grant service_role)

-- OK: verification — verticals 10; marked 60; null vertical 0; false positives 0
```

## 2026-08-18 — Vertical backfill for existing users
1. CREATE TABLE public.user_verticals_backup_20260818 AS SELECT * FROM public.user_verticals; (0 rows — table was empty)
2. ALTER TABLE public.user_verticals ADD COLUMN is_inferred boolean NOT NULL DEFAULT false, ADD COLUMN confirmed_at timestamptz;
3. INSERT INTO public.user_verticals (user_id, vertical_slug, is_inferred) — deterministic topic→vertical map, 158 rows / 36 users, all is_inferred = true.
4. DO $$ ... score_opportunities_for_user(u) for each of the 36 users — 25,956 score rows refreshed, total unchanged at 48,471.

Revert: DELETE FROM public.user_verticals WHERE is_inferred = true;
        ALTER TABLE public.user_verticals DROP COLUMN is_inferred, DROP COLUMN confirmed_at;
        DROP TABLE public.user_verticals_backup_20260818;

## 2026-08-18 — ingest-leads repair
- Backup: `public.opportunities_ingest_repair_backup_20260818` (id, is_active, event_date, deadline for all ingest-leads rows).
- Fixed mis-parsed `event_date` years (month+day with no year) for ingest-leads rows.
- Reactivated ingest-leads rows whose deadline/event_date is still in the future and whose raw_data is_open is not falsy.
- Code: ingest-leads is_open coercion + toTimestamp date-component guard; deactivate-expired-opportunities implausible-date guard.
- Revert: `update public.opportunities o set is_active=b.is_active, event_date=b.event_date, deadline=b.deadline from public.opportunities_ingest_repair_backup_20260818 b where b.id=o.id;` then `drop table public.opportunities_ingest_repair_backup_20260818;`

## 2026-08-18 — Structured topics from ingested leads

- Snapshot: `public.opportunity_topics_backup_20260818` (96 rows, pre-backfill copy of `opportunity_topics`), RLS enabled, service_role only.
- Backfill: inserted `opportunity_topics` rows for opportunities whose `raw_data->>'topic_or_industry'` matched the keyword→topic alias map. No topics created. `ON CONFLICT DO NOTHING`.
- Result: opportunity_topics 96 → 146 rows; opportunities with ≥1 topic 24 → 63.
- Edge function `ingest-leads` now writes matched topics into `opportunity_topics` and returns `topic_links_created` + `unmatched_topic_values`.

### Revert
```sql
DELETE FROM public.opportunity_topics ot
WHERE NOT EXISTS (
  SELECT 1 FROM public.opportunity_topics_backup_20260818 b WHERE b.id = ot.id
);
-- then rescore: SELECT public.score_opportunities_for_user(id) FROM public.profiles;
```

## 2026-08-19 — Dedupe columns + ingest-side dedupe (ingest-leads)

Migration (additive only):
```sql
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS event_fingerprint text,
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;
CREATE INDEX idx_opportunities_canonical_url ON public.opportunities (canonical_url) WHERE canonical_url IS NOT NULL;
CREATE INDEX idx_opportunities_event_fingerprint ON public.opportunities (event_fingerprint) WHERE event_fingerprint IS NOT NULL;
CREATE INDEX idx_opportunities_merged_into ON public.opportunities (merged_into) WHERE merged_into IS NOT NULL;
```

Revert:
```sql
DROP INDEX IF EXISTS idx_opportunities_canonical_url;
DROP INDEX IF EXISTS idx_opportunities_event_fingerprint;
DROP INDEX IF EXISTS idx_opportunities_merged_into;
ALTER TABLE public.opportunities
  DROP COLUMN IF EXISTS canonical_url,
  DROP COLUMN IF EXISTS event_fingerprint,
  DROP COLUMN IF EXISTS merged_into;
```
Then redeploy the previous ingest-leads build. No existing rows were modified; backfill of the 5 known duplicate groups has NOT been run.

## 2026-08-19 — Duplicate merge backfill (26 groups)

- Snapshots (pre-existing): `opportunities_dedupe_backup_20260819` (64), `opportunity_scores_dedupe_backup_20260819` (3684), `opportunity_topics_dedupe_backup_20260819` (33).
- Merged 26 groups / 28 loser rows. 5 groups (10 rows, both sides user-touched) deliberately skipped.
- Per group: enrich survivor (never downgrade), union `opportunity_topics`, copy pipeline stage onto survivor score rows only where survivor stage was `new`, repoint `opportunity_karma`, append `raw_data.merged_from[]`, set `merged_into` + `is_active=false` on losers, backfill `canonical_url`/`event_fingerprint` on survivor.
- Rescored all 26 survivors via `score_opportunity_for_all_users`.
- Before → after: active opportunities 851 → 823; opportunity_topics 204 → 232; score rows with `no_topics_tagged` 51544 → 49913; `topic_match_strong` 667 → 674; pipeline rows 75 → 75 (unchanged); karma 4 → 4 (unchanged).
- Digest dry run (no writes): 66 users, 461 leads, 284 own vertical / 12 adjacent / 165 fallback, score range 27–79 (median 77), 0 users with nothing, 0 tombstones surfaced.

### Revert
```sql
update public.opportunities o set
  organizer_name=b.organizer_name, organizer_email=b.organizer_email, organizer_linkedin=b.organizer_linkedin,
  organizer_phone=b.organizer_phone, organization_website=b.organization_website, description=b.description,
  deadline=b.deadline, fee_estimate_min=b.fee_estimate_min, fee_estimate_max=b.fee_estimate_max,
  location=b.location, location_venue=b.location_venue, audience_size=b.audience_size,
  vertical_slug=b.vertical_slug, timezone=b.timezone, event_end_date=b.event_end_date,
  covers_travel=b.covers_travel, covers_accommodation=b.covers_accommodation, ingest_source=b.ingest_source,
  raw_data=b.raw_data, canonical_url=b.canonical_url, event_fingerprint=b.event_fingerprint,
  merged_into=b.merged_into, is_active=b.is_active
from public.opportunities_dedupe_backup_20260819 b where b.id=o.id;

update public.opportunity_scores s set
  pipeline_stage=b.pipeline_stage, viewed_at=b.viewed_at, interested_at=b.interested_at,
  response_received_at=b.response_received_at, accepted_at=b.accepted_at, rejected_at=b.rejected_at,
  completed_at=b.completed_at, rejection_reason=b.rejection_reason
from public.opportunity_scores_dedupe_backup_20260819 b where b.id=s.id;

delete from public.opportunity_topics t
where not exists (select 1 from public.opportunity_topics_backup_20260819 b where b.id=t.id)
  and t.opportunity_id in (select distinct merged_into from public.opportunities_dedupe_backup_20260819 where merged_into is not null);
-- karma: repoint back from the backup's opportunity_id if needed, then rescore survivors.
```

## 2026-08-20 — Source name normalization + source yield views

- Snapshot: `public.opportunities_source_backup_20260820` (id, source, ingest_source for all rows), RLS on, service_role only.
- Normalized `opportunities.source` to lowercase canonical slugs. 149 rows changed:
  CallingAllPapers→callingallpapers 74, Eventbrite→eventbrite 60, Sessionize→sessionize 7,
  "DevOpsDays (global series)"→devopsdays 4, Meetup→meetup 1,
  three event-name-as-source rows (NACD Directors Summit, Google Next-Gen DevCon 2026,
  Mile High SHRM 2027 Speaker RFP) → ingest-leads 3.
- Created views `public.v_source_yield` (per-source coverage, avg/max score, pipeline, won, first/last seen)
  and `public.v_source_yield_daily` (rows added per source per day). Both `security_invoker = on`,
  SELECT granted to authenticated + service_role.
- Added SELECT policies "Admins can view all opportunities" and "Admins can view all opportunity scores"
  (has_role(auth.uid(),'admin')) so the invoker-security views return complete numbers for admins.

### Revert
```sql
UPDATE public.opportunities o SET source = b.source
FROM public.opportunities_source_backup_20260820 b WHERE b.id = o.id;
DROP VIEW IF EXISTS public.v_source_yield, public.v_source_yield_daily;
DROP POLICY IF EXISTS "Admins can view all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Admins can view all opportunity scores" ON public.opportunity_scores;
DROP TABLE public.opportunities_source_backup_20260820;
```
