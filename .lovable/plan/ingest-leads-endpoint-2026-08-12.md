# Ingest Leads Endpoint

Add a dedicated table and a token-protected webhook endpoint so an external automation service can push speaking opportunity records into NextMIC.

## 1. Database table: `speaking_opportunities`

Columns exactly as specified:

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | primary key, auto-generated |
| event_name | text | required |
| organization | text | |
| topic_or_industry | text | |
| location | text | |
| event_date | text | |
| application_deadline | text | |
| application_link | text | unique |
| vertical_tag | text | |
| source_name | text | |
| speaker_access | text | |
| is_open | boolean | |
| days_until_deadline | text | |
| lead_quality | text | |
| created_at | timestamptz | defaults to now |

Access rules:
- Row level security on.
- Signed-in users can read all rows.
- No one can write from the browser (no insert/update/delete policies).
- The backend service role has full access, so the endpoint can insert.

## 2. Edge function: `ingest-leads`

Behavior on `POST`:
1. Require `Authorization: Bearer <token>`; compare against the stored shared secret. Missing or wrong token returns `401`.
2. Parse the JSON body — accepts either a bare array or `{ "records": [...] }`.
3. Validate each record has `event_name` and `application_link`; records missing either are counted as invalid and skipped.
4. Look up which `application_link` values already exist; skip those as duplicates.
5. Insert the remaining records in one batch (upsert-ignore on the unique link as a safety net against races).
6. Respond with JSON: `{ received, inserted, skipped_duplicates, skipped_invalid }`.

Runs with `verify_jwt = false` (external caller has no Supabase JWT) and uses the service role key internally. CORS headers included so it can be called from anywhere.

## 3. Shared secret

The token has to be readable by you so you can paste it into the sending service, so it is set as a shared secret rather than an unrevealed generated one. I will generate a strong random value, save it as `INGEST_LEADS_TOKEN`, and print it in chat along with the endpoint URL.

## 4. Deliverables at the end

- Full public endpoint URL for `ingest-leads`
- The bearer token value
- A ready-to-run `curl` example for a test payload

## Technical notes

- Table created via migration with explicit `GRANT SELECT` to authenticated and `GRANT ALL` to service_role, RLS enabled, single read policy.
- Function lives at `supabase/functions/ingest-leads/index.ts`, registered in `supabase/config.toml` with `verify_jwt = false`.
- Token comparison uses a constant-time check to avoid timing leaks.
- Duplicate detection is a single `in`-filter query on `application_link`, so one round trip regardless of batch size.
