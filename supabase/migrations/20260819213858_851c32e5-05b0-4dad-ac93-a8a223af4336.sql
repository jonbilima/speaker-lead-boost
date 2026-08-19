
DO $$
DECLARE
  g record; sur record; los record; merged_ids uuid[]; n_groups int := 0; n_losers int := 0;
BEGIN
  CREATE TEMP TABLE _dg ON COMMIT DROP AS
  WITH base AS (
    SELECT o.*, regexp_replace(regexp_replace(lower(o.event_name), '^(the|a|an)\s+',''), '[^a-z0-9]+','','g') AS nname
    FROM public.opportunities o
    WHERE o.merged_into IS NULL AND o.event_date IS NOT NULL AND o.event_name IS NOT NULL
  ),
  k AS (SELECT b.*, b.nname||'|'||b.event_date::date::text AS gkey FROM base b),
  g AS (SELECT gkey FROM k GROUP BY gkey HAVING count(*)>1),
  act AS (
    SELECT k.*, (
      EXISTS(SELECT 1 FROM public.opportunity_scores s WHERE s.opportunity_id=k.id AND s.pipeline_stage IS NOT NULL AND s.pipeline_stage::text<>'new')
      OR EXISTS(SELECT 1 FROM public.opportunity_karma ka WHERE ka.opportunity_id=k.id)
      OR k.submitted_by IS NOT NULL) AS has_activity
    FROM k JOIN g USING (gkey)
  )
  SELECT a.id, a.gkey, a.nname, a.event_date, a.has_activity, a.source, a.event_url, a.created_at,
    CASE
      WHEN a.source IN ('manual','user_submitted') THEN 100
      WHEN a.event_url IS NULL THEN 10
      WHEN a.event_url ~* '(sessionize\.com)' THEN 70
      WHEN a.event_url ~* '(papercall|callingallpapers|conferencelist)' THEN 60
      WHEN a.event_url ~* '(eventbrite)' THEN 50
      WHEN a.event_url ~* '(meetup\.com)' THEN 30
      ELSE 80
    END AS trust,
    (CASE WHEN a.organizer_email IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN a.organizer_name IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN a.deadline IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN a.fee_estimate_min IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN a.location IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN a.vertical_slug IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN coalesce(length(a.description),0) > 80 THEN 1 ELSE 0 END
     + (SELECT count(*) FROM public.opportunity_topics t WHERE t.opportunity_id=a.id)) AS completeness
  FROM act a
  WHERE a.gkey IN (SELECT gkey FROM act GROUP BY gkey HAVING count(*) FILTER (WHERE has_activity) <= 1);

  FOR g IN SELECT DISTINCT gkey FROM _dg LOOP
    SELECT * INTO sur FROM _dg d WHERE d.gkey=g.gkey
      ORDER BY d.has_activity DESC, d.trust DESC, d.completeness DESC, d.created_at ASC LIMIT 1;

    merged_ids := ARRAY(SELECT id FROM _dg d WHERE d.gkey=g.gkey AND d.id <> sur.id);
    IF array_length(merged_ids,1) IS NULL THEN CONTINUE; END IF;

    -- enrich survivor (never downgrade a populated field), highest-trust loser first
    FOR los IN SELECT o.* FROM public.opportunities o JOIN _dg d ON d.id=o.id
               WHERE o.id = ANY(merged_ids) ORDER BY d.trust DESC, d.completeness DESC LOOP
      UPDATE public.opportunities s SET
        organizer_name        = coalesce(s.organizer_name, los.organizer_name),
        organizer_email       = coalesce(s.organizer_email, los.organizer_email),
        organizer_linkedin    = coalesce(s.organizer_linkedin, los.organizer_linkedin),
        organizer_phone       = coalesce(s.organizer_phone, los.organizer_phone),
        organization_website  = coalesce(s.organization_website, los.organization_website),
        description           = CASE WHEN coalesce(length(s.description),0) >= coalesce(length(los.description),0) THEN s.description ELSE los.description END,
        deadline              = coalesce(s.deadline, los.deadline),
        fee_estimate_min      = coalesce(s.fee_estimate_min, los.fee_estimate_min),
        fee_estimate_max      = coalesce(s.fee_estimate_max, los.fee_estimate_max),
        location              = coalesce(s.location, los.location),
        location_venue        = coalesce(s.location_venue, los.location_venue),
        audience_size         = coalesce(s.audience_size, los.audience_size),
        vertical_slug         = coalesce(s.vertical_slug, los.vertical_slug),
        timezone              = coalesce(s.timezone, los.timezone),
        event_end_date        = coalesce(s.event_end_date, los.event_end_date),
        covers_travel         = coalesce(s.covers_travel, los.covers_travel),
        covers_accommodation  = coalesce(s.covers_accommodation, los.covers_accommodation),
        ingest_source         = coalesce(s.ingest_source, los.ingest_source),
        raw_data = coalesce(s.raw_data,'{}'::jsonb) || jsonb_build_object('merged_from',
            coalesce(s.raw_data->'merged_from','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
              'id', los.id, 'event_name', los.event_name, 'event_url', los.event_url,
              'source', los.source, 'merged_at', now())))
      WHERE s.id = sur.id;
    END LOOP;

    -- union topic links
    INSERT INTO public.opportunity_topics (opportunity_id, topic_id)
    SELECT sur.id, t.topic_id FROM public.opportunity_topics t
    WHERE t.opportunity_id = ANY(merged_ids)
    ON CONFLICT DO NOTHING;

    -- union pipeline state (only onto untouched survivor rows)
    UPDATE public.opportunity_scores s SET
      pipeline_stage = l.pipeline_stage, viewed_at = coalesce(s.viewed_at, l.viewed_at),
      interested_at = coalesce(s.interested_at, l.interested_at),
      response_received_at = coalesce(s.response_received_at, l.response_received_at),
      accepted_at = coalesce(s.accepted_at, l.accepted_at),
      rejected_at = coalesce(s.rejected_at, l.rejected_at),
      completed_at = coalesce(s.completed_at, l.completed_at),
      rejection_reason = coalesce(s.rejection_reason, l.rejection_reason)
    FROM (
      SELECT DISTINCT ON (user_id) * FROM public.opportunity_scores
      WHERE opportunity_id = ANY(merged_ids) AND pipeline_stage IS NOT NULL AND pipeline_stage::text <> 'new'
      ORDER BY user_id, calculated_at DESC
    ) l
    WHERE s.opportunity_id = sur.id AND s.user_id = l.user_id
      AND (s.pipeline_stage IS NULL OR s.pipeline_stage::text = 'new');

    -- move karma
    UPDATE public.opportunity_karma k SET opportunity_id = sur.id
    WHERE k.opportunity_id = ANY(merged_ids);

    -- tombstone losers
    UPDATE public.opportunities SET merged_into = sur.id, is_active = false
    WHERE id = ANY(merged_ids);

    -- dedupe keys on survivor
    UPDATE public.opportunities SET
      event_fingerprint = coalesce(event_fingerprint, sur.nname||'|'||to_char(sur.event_date,'YYYY-MM-DD')),
      canonical_url = coalesce(canonical_url,
        regexp_replace(regexp_replace(lower(coalesce(event_url,'')), '^https?://(www\.)?',''), '/+$',''))
    WHERE id = sur.id AND event_url IS NOT NULL;

    n_groups := n_groups + 1;
    n_losers := n_losers + array_length(merged_ids,1);
  END LOOP;

  RAISE NOTICE 'merged % groups, % losers', n_groups, n_losers;
END $$;
