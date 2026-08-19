# Backfill Plan — Merging Existing Duplicate Opportunity Groups

## What the data looks like now (re-audited, read-only)

The picture is bigger than the 5 groups reported earlier — the CallingAllPapers/Sessionize harvest has since landed more overlap.

Matching on normalized event name + exact `event_date`, restricted to rows with a real date and `merged_into is null`:

- **31 duplicate groups**, **64 rows** involved
- **33 rows** would be merged away (29 groups of 2, 2 groups of 3)
- Attached data on those 64 rows: **3,684 opportunity_scores**, **33 opportunity_topics**, **1 opportunity_karma**, **12 score rows with a non-`new` pipeline stage**
- **0 pitches, 0 applied_logs, 0 lead_deliveries** — nothing has been emailed or delivered yet, so this is the cheapest moment to merge

Typical shape of a group: the same event ingested once with its organizer URL and once with its Sessionize URL.

```text
Fractional Conference (FRAK) 2026   2026-10-28
  CallingAllPapers  https://fractionalconference.com        topics 0
  Sessionize        https://sessionize.com/frak-2026        topics 1

Google Next-Gen DevCon 2026         2026-08-27   (3 rows)
  https://sessionize.com/google-next-gen-devcon-2026/       topics 4
  https://sessionize.com/google-next-gen-devcon-2026        topics 1
  https://next-gen-cloud-spark.lovable.app                  topics 0
```

Two groups are pure URL variants (trailing slash, `globalaicommunity.org` vs `globalai.community`) that the new `canonical_url` rule would already catch on ingest.

## Survivor selection

Per group, pick the survivor by, in order:
1. Any row referenced by user activity (non-`new` pipeline stage, karma, submitted_by) — never merge away a row a user has touched. If two rows in a group both qualify, that group is **skipped** and reported for manual review.
2. Highest source trust: organizer-domain URL > Sessionize > CallingAllPapers feed > aggregator/other.
3. Most populated: count of non-null scoring-relevant fields (fee range, deadline, vertical_slug, location, description length, topic links).
4. Oldest `created_at` as the tiebreaker, so existing scores stay stable.

## Merge operation (per group, in one transaction)

1. **Enrich the survivor** field-by-field from the losers using the never-downgrade rule: a populated field on the survivor is never overwritten; nulls/empties are filled from the highest-trust loser that has a value. Applies to `organizer_name`, `organizer_email`, `description`, `deadline`, `fee_estimate_min/max`, `location`, `location_venue`, `audience_size`, `organization_website`, `vertical_slug`, `timezone`, `covers_travel`, `covers_accommodation`.
2. **Union topic links** — insert missing `opportunity_topics` rows onto the survivor, `ON CONFLICT DO NOTHING`.
3. **Union pipeline state** — for each loser score row with a non-`new` `pipeline_stage`, copy that stage (plus notes/follow-up fields) onto the same user's survivor score row only if the survivor row is still `new`. A user's pipeline position is never regressed.
4. **Move karma** — repoint `opportunity_karma.opportunity_id` to the survivor, `ON CONFLICT DO NOTHING`.
5. **Record provenance** — on the survivor, append to `raw_data.merged_from[]`: loser id, event_name, event_url, source, and the merge timestamp.
6. **Tombstone the losers** — set `merged_into = <survivor id>` and `is_active = false`. **Nothing is deleted**, no scores are deleted; loser score rows simply stop surfacing because the loser is inactive.
7. **Backfill dedupe keys** — set `canonical_url` and `event_fingerprint` on the survivor so future ingests hit it directly.

## Feed hygiene (small code change)

Merged tombstones are already excluded everywhere by `is_active = false`. I will additionally add `.is('merged_into', null)` to the Find feed and digest queries as a belt-and-braces guard so a future reactivation can't resurrect a tombstone.

## Order of execution

1. Snapshot `opportunities_dedupe_backup_20260819` (full row copy of the 64 involved rows) and `opportunity_scores_dedupe_backup_20260819` (their 3,684 score rows), both RLS-locked to service_role.
2. **Dry run first**: run the survivor selection and print, per group, chosen survivor, losers, which fields would be enriched, which pipeline states would be copied, and any groups auto-skipped for conflicting user activity. No writes.
3. On your approval, run the merge.
4. Rescore the survivors (`score_opportunity_for_all_users`) so enriched fields and new topic links land in `ai_score` and `reason_codes`.
5. Report post-merge counts and re-run the digest dry run.

## Revert

```sql
-- restore merged/enriched rows
update public.opportunities o set ... = b....
  from public.opportunities_dedupe_backup_20260819 b where b.id = o.id;
-- restore pipeline/score state
update public.opportunity_scores s set ... = b....
  from public.opportunity_scores_dedupe_backup_20260819 b where b.id = s.id;
-- drop links added by the merge
delete from public.opportunity_topics t
  where not exists (select 1 from <topics snapshot> b where b.id = t.id);
```
Because losers are tombstoned rather than deleted, a revert is a straight column restore — no row resurrection needed.

## What I need from you

Approve, and I'll run the snapshot + dry run and bring you the per-group report before any write.
