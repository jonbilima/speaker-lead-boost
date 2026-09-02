# Next Cycle Date Discovery — schema proposal (nothing built yet)

Goal: capture **real published** future event dates and call-for-speakers status from organizer sites, as a separate signal from contact data, with a visible freshness stamp.

## Two new tables (no existing table, column, or row is touched)

### 1. `public.organizer_event_signals` — one row per (domain, detected event)
One crawl of a multi-event calendar (devopsdays, sqlsaturday, ndcconferences) legitimately yields many rows, so this is per-event, not per-domain.

| column | type | meaning |
|---|---|---|
| `id` | uuid pk | |
| `domain` | text not null | organizer domain, matches `organizer_contacts.domain` |
| `event_name` | text | name as published on the site (null if only a bare date) |
| `event_slug` | text not null | normalised key for upsert, derived from name+date |
| `next_event_date` | date | published future start date |
| `next_event_date_end` | date | end date when a range is published |
| `next_event_date_text` | text | raw string as printed, e.g. "March 3–5, 2027" |
| `date_confidence` | text | `explicit_date` / `month_year` / `year_only` |
| `date_source_url` | text | exact page the date came from |
| `date_confirmed_at` | timestamptz | **last confirmed** — set every time a crawl re-sees this date |
| `cfp_status` | text | `open` / `announced_not_open` / `closed` / `unknown` |
| `cfp_url` | text | standing call-for-speakers URL when one exists |
| `cfp_deadline` | date | when published |
| `cfp_source_url` | text | |
| `cfp_confirmed_at` | timestamptz | last confirmed, independent of the date stamp |
| `site_shape` | text | `standing_cfp_url` / `homepage_next_date` / `multi_event_calendar` |
| `render_used` | boolean | whether browser rendering was needed |
| `raw_evidence` | jsonb | matched snippets, for debugging false positives |
| `is_stale` | generated/derived in UI | not stored; UI marks anything confirmed >45 days ago as stale |
| `created_at` / `updated_at` | timestamptz | |

Unique on `(domain, event_slug)` so re-crawls update rather than duplicate.
`next_date_known` and `cfp_open` stay **separate**: the highest-value pitch window is `next_event_date is not null and cfp_status <> 'open'`.

### 2. `public.organizer_crawl_runs` — one row per domain crawl attempt
So a domain that was crawled and genuinely had nothing is distinguishable from one never crawled.

`id`, `domain`, `pages_fetched`, `render_used`, `signals_found int`, `status text`, `error text`, `ran_at timestamptz`.

### Access
Both tables are shared reference data, not user data:
```
GRANT SELECT ON ... TO authenticated;  GRANT ALL ON ... TO service_role;
RLS on; authenticated may read; only service_role (the edge function) writes.
```

## Code changes (all additive)
- `_shared/event-date-extractor.ts` (new) — date/CFP parsing: JSON-LD `Event` blocks, `<time datetime>`, hero date ranges, "Call for Speakers opens/closes" phrasing, "See you in <Month Year>".
- `_shared/organizer-crawler.ts` — add `event_signals` to `CrawlResult`, add `/cfp`, `/call-for-papers`, `/2027`, `/events`, `/schedule`, `/conference` to probe paths, and force browser render for JS-shell sites (the 5 largest commercial conferences that failed static fetch).
- New edge function `discover-event-cycles` (admin/service auth, `verify_jwt = true`) — takes `{ domains?: string[], expired_only?: true, limit, offset, use_render }`, crawls, upserts signals, logs the run.
- No change to `opportunities`, ingest-leads, enrichment, merge logic, auth, payments, or boxoffice-webhook.

## Revert
```sql
drop table public.organizer_event_signals;
drop table public.organizer_crawl_runs;
```
plus delete `discover-event-cycles/`, `_shared/event-date-extractor.ts`, revert the two added blocks in `organizer-crawler.ts` and the `config.toml` entry. Nothing else is modified, so revert is clean.

## Then
Run across every organizer domain with at least one expired opportunity and report hit rate for future dates and for open calls, split by site shape and by static vs rendered.
