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

## 2026-08-20 — Meetup inventory retirement (A6 purge)
- Backups: `public.opportunities_meetup_backup_20260820` (all 715 meetup rows), `public.meetup_purge_retained_20260820` (29 retained ids). Both RLS-enabled, service_role only.
- Deactivated 686 meetup rows with no user activity (`is_active = false`, nothing deleted).
- Retained 29 rows with real user activity (22 pipeline stage past new, 9 pitches, 2 application packages; 0 applied_logs / karma / calendar / bookings).
- Active opportunities after purge: 537.
- Scraper disabled: meetup removed from `scrape-all-sources` scrapers list; `scrape-meetup` now short-circuits unless env `MEETUP_SCRAPER_ENABLED=true`.
- Digest dry run: 66 users, 493 leads, 328 own vertical / 0 adjacent / 165 fallback, 0 users below the 5-lead minimum, score range 27–79.

### Revert
```sql
UPDATE public.opportunities o
SET is_active = b.is_active
FROM public.opportunities_meetup_backup_20260820 b
WHERE o.id = b.id;
```
Then re-add `{ name: 'meetup', function: 'scrape-meetup' }` to `scrape-all-sources` and remove the disable guard in `scrape-meetup` (or set secret `MEETUP_SCRAPER_ENABLED=true`), then redeploy both.

## 2026-08-21 — organizer_contacts backfill (132 domains)
- Snapshot: `public.opportunities_organizer_email_backup_20260821` (id, event_url, organizer_email).
- `scrape-organizer-contacts` updated: `fill_opportunities` flag (default false — opportunities untouched), `offset` param.
- Ran chunked backfill (20/10/5 per invocation) → 132 rows in `organizer_contacts`. No writes to `opportunities`.
- Revert: `DELETE FROM public.organizer_contacts;` (or `DROP TABLE`); restore emails from the snapshot table if ever filled.

## 2026-08-25 — Organizer email discovery (methods 2 + 3)
- Backups: `public.organizer_contacts_backup_20260825`, `public.opportunities_email_backup_20260825b`.
- Crawled 29 previously uncrawled organizer domains (`crawl_v3`) and 115 crawled-but-emailless domains with deep staff-profile follow-through (`deep_staff_v3`).
- Merged results into `organizer_contacts`; filled `opportunities.organizer_email` for matching active rows.
- RDAP sweep (`rdap_v1`) over 36 remaining unreachable domains: 1 non-proxy registrant email stored (`cphrbc.ca`, status `found_whois`, tier `role_inbox`).
- Cleaned `named_staff`: 670 entries -> 345 real people (40 domains rewritten). Crawler now validates names via `isPersonName` in `_shared/organizer-crawler.ts`.
- Pattern inference: dropped, no verified samples.
### Revert
```sql
UPDATE public.opportunities o SET organizer_email = b.organizer_email
FROM public.opportunities_email_backup_20260825b b WHERE b.id = o.id;
DELETE FROM public.organizer_contacts oc
WHERE NOT EXISTS (SELECT 1 FROM public.organizer_contacts_backup_20260825 b WHERE b.domain = oc.domain);
UPDATE public.organizer_contacts oc SET email=b.email, confidence_tier=b.confidence_tier, status=b.status,
  all_emails=b.all_emails, named_staff=b.named_staff, contact_form_url=b.contact_form_url, phone=b.phone,
  socials=b.socials, paths_found=b.paths_found, strategies_tried=b.strategies_tried, source_page=b.source_page
FROM public.organizer_contacts_backup_20260825 b WHERE b.domain = oc.domain;
```
Code revert: `git revert` the `isPersonName` change in `supabase/functions/_shared/organizer-crawler.ts` and redeploy `scrape-organizer-contacts`.

## 2026-08-26 — Structured location fields + Twin resend duplicate merge
- Schema: added `opportunities.city`, `opportunities.state`, `opportunities.location_confidence` (additive only).
- `ingest-leads`: maps `country`/`city`/`state`/`location_confidence` as real columns; `Virtual`/`Global`/`Online` treated as a location *type* (stored in `location_confidence`), not a country; virtual events with a US state/`.us|.edu|.gov` host classified `United States`; those four fields added to `ENRICHABLE_FIELDS`, and an explicit payload country overrides a previously derived one on the duplicate path.
- Backup: `public.opportunities_twin_merge_backup_20260826` (full row copy of all 234 duplicates + their survivors).
- Merged the 234 duplicates created by the 2026-08-25 resend into their pre-existing counterparts (survivor = oldest row, which carries all score/pipeline history; zero duplicates had pipeline history). Survivors enriched (country/city/state/confidence, blanks filled, organizer site moved to `organization_website`), topic links unioned, duplicates tombstoned via `merged_into` + `is_active=false`. Active: 801 -> 559.
- Backfilled the four location columns from `raw_data` for all resend rows; reclassified 29 rows whose `country` was literally `Virtual`.
### Revert
```sql
UPDATE public.opportunities o SET merged_into=b.merged_into, is_active=b.is_active, country=b.country,
  city=b.city, state=b.state, location_confidence=b.location_confidence, organizer_email=b.organizer_email,
  organizer_name=b.organizer_name, description=b.description, location=b.location, deadline=b.deadline,
  event_date=b.event_date, fee_estimate_min=b.fee_estimate_min, fee_estimate_max=b.fee_estimate_max,
  audience_size=b.audience_size, vertical_slug=b.vertical_slug, organization_website=b.organization_website,
  raw_data=b.raw_data
FROM public.opportunities_twin_merge_backup_20260826 b WHERE b.id = o.id;
```
(Backup predates the `city`/`state`/`location_confidence` columns only in value, not shape — they were NULL at snapshot time.)
Code revert: `git revert` the `ingest-leads` change and redeploy.
