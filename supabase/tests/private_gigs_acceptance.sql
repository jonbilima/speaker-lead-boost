-- NextMIC "Add my own gig" acceptance test.
--
-- SAFE TO RUN ON PRODUCTION. Everything happens inside one block that is
-- rolled back at the end, so it leaves no rows, no gigs, nothing.
--
-- How to read the result: the script deliberately finishes with an error whose
-- message starts "RESULTS". That error is what performs the rollback. Read the
-- PASS/FAIL lines inside it. The last line says whether everything passed.
--
-- It plays two speakers, A and B. By default it uses the two oldest profiles;
-- because nothing persists, neither of them is affected. To use specific test
-- accounts instead, put their auth user ids in the two lines marked OVERRIDE.

DO $test$
DECLARE
  a        uuid;
  b        uuid;
  gig      uuid;
  match_a  uuid;
  pub      uuid;
  res      jsonb;
  n        int;
  v_name   text;
  v_email  text;
  v_merged uuid;
  v_active boolean;
  v_fee    numeric;
  v_stage  text;
  log      text := '';
  fails    int  := 0;
BEGIN
  -- Ordinary speakers only: an admin account could pass checks through some
  -- other policy and hide a real leak.
  SELECT p.id INTO a FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin')
   ORDER BY p.created_at NULLS LAST, p.id LIMIT 1;
  SELECT p.id INTO b FROM public.profiles p
   WHERE p.id <> a
     AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin')
   ORDER BY p.created_at NULLS LAST, p.id LIMIT 1;
  -- a := '00000000-0000-0000-0000-000000000000';   -- OVERRIDE: speaker A
  -- b := '00000000-0000-0000-0000-000000000000';   -- OVERRIDE: speaker B
  IF a IS NULL OR b IS NULL THEN
    RAISE EXCEPTION 'RESULTS: need at least two profiles to run this test';
  END IF;

  ------------------------------------------------------------------ speaker A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;

  res := public.add_private_gig(
    'ZZ acceptance test gig', 'Test Contact', 'Test.Contact@Example.com',
    now() + interval '30 days', NULL, true, 'Leadership', 2500, 'negotiating', 'test note');
  gig     := (res->>'opportunity_id')::uuid;
  match_a := (res->>'match_id')::uuid;

  IF gig IS NOT NULL AND match_a IS NOT NULL THEN
    log := log || E'\nPASS  A adds a private gig';
  ELSE
    log := log || E'\nFAIL  A adds a private gig'; fails := fails + 1;
  END IF;

  SELECT count(*) INTO n FROM public.opportunities WHERE id = gig;
  IF n = 1 THEN log := log || E'\nPASS  A can see it';
  ELSE log := log || format(E'\nFAIL  A can see it (rows: %s)', n); fails := fails + 1; END IF;

  SELECT pipeline_stage::text INTO v_stage FROM public.opportunity_scores
   WHERE opportunity_id = gig AND user_id = a;
  IF v_stage = 'negotiating' THEN log := log || E'\nPASS  it sits in A''s pipeline at the stage A chose';
  ELSE log := log || format(E'\nFAIL  A''s pipeline stage (got %s)', coalesce(v_stage, 'none')); fails := fails + 1; END IF;

  SELECT count(*) INTO n FROM public.outreach_activities WHERE match_id = match_a;
  IF n >= 2 THEN log := log || E'\nPASS  creation note and A''s own note are logged';
  ELSE log := log || format(E'\nFAIL  activity notes (rows: %s)', n); fails := fails + 1; END IF;

  -- The fee moves during negotiation; the owner must be able to change it.
  UPDATE public.opportunities SET fee_estimate_min = 2000, fee_estimate_max = 2000 WHERE id = gig;
  SELECT fee_estimate_min INTO v_fee FROM public.opportunities WHERE id = gig;
  IF v_fee = 2000 THEN log := log || E'\nPASS  A can edit the fee';
  ELSE log := log || format(E'\nFAIL  A can edit the fee (got %s)', v_fee); fails := fails + 1; END IF;

  -- An owner edit must never be able to publish the gig.
  BEGIN
    UPDATE public.opportunities SET is_private = false, owner_user_id = NULL WHERE id = gig;
    log := log || E'\nFAIL  A cannot publish it by editing (update went through)'; fails := fails + 1;
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  A cannot publish it by editing';
  END;

  ------------------------------------------------------------------ speaker B
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', b::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM public.opportunities WHERE id = gig;
  IF n = 0 THEN log := log || E'\nPASS  B cannot fetch it by id';
  ELSE log := log || E'\nFAIL  B CAN FETCH A''S GIG BY ID'; fails := fails + 1; END IF;

  SELECT count(*) INTO n FROM public.opportunities WHERE event_name ILIKE '%acceptance test gig%';
  IF n = 0 THEN log := log || E'\nPASS  B cannot find it by searching';
  ELSE log := log || E'\nFAIL  B CAN FIND A''S GIG IN SEARCH'; fails := fails + 1; END IF;

  SELECT count(*) INTO n FROM public.opportunity_scores WHERE opportunity_id = gig;
  IF n = 0 THEN log := log || E'\nPASS  it is not in B''s pipeline, digest or package list';
  ELSE log := log || E'\nFAIL  A''S GIG IS IN B''S PIPELINE'; fails := fails + 1; END IF;

  UPDATE public.opportunities SET event_name = 'changed by B' WHERE id = gig;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN log := log || E'\nPASS  B cannot edit it';
  ELSE log := log || E'\nFAIL  B EDITED A''S GIG'; fails := fails + 1; END IF;

  BEGIN
    INSERT INTO public.opportunity_scores (opportunity_id, user_id) VALUES (gig, b);
    log := log || E'\nFAIL  B FORCED A''S GIG INTO B''S PIPELINE'; fails := fails + 1;
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  B cannot force it into B''s own pipeline';
  END;

  ------------------------------------------------- system (service role, no user)
  -- This is how scrapers, organizer crawls, merges and the scoring sweeps run.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  PERFORM public.score_opportunity_for_all_users(gig);
  PERFORM public.score_opportunity_matches(NULL, gig, true, NULL);
  SELECT count(*) INTO n FROM public.opportunity_scores WHERE opportunity_id = gig;
  IF n = 1 THEN log := log || E'\nPASS  rescoring everyone still scores it for A only';
  ELSE log := log || format(E'\nFAIL  RESCORING FANNED IT OUT (score rows: %s)', n); fails := fails + 1; END IF;

  -- A scraper or organizer crawl trying to overwrite it, or a merge absorbing it.
  SELECT id INTO v_merged FROM public.opportunities WHERE id <> gig AND NOT is_private LIMIT 1;
  UPDATE public.opportunities
     SET event_name = 'scraper overwrite', organizer_email = 'scraped@example.com', merged_into = v_merged
   WHERE id = gig;
  SELECT event_name, organizer_email, merged_into INTO v_name, v_email, v_merged
    FROM public.opportunities WHERE id = gig;
  IF v_name = 'ZZ acceptance test gig' AND v_email = 'test.contact@example.com' AND v_merged IS NULL THEN
    log := log || E'\nPASS  scrapers, crawls and merges cannot change it';
  ELSE log := log || format(E'\nFAIL  SYSTEM CHANGED A''S GIG (%s / %s / merged %s)', v_name, v_email, v_merged); fails := fails + 1; END IF;

  -- Expiry: deactivate, never delete.
  UPDATE public.opportunities SET is_active = false WHERE id = gig;
  SELECT is_active INTO v_active FROM public.opportunities WHERE id = gig;
  IF v_active IS FALSE THEN log := log || E'\nPASS  expiry can still deactivate it';
  ELSE log := log || E'\nFAIL  expiry could not deactivate it'; fails := fails + 1; END IF;

  -- Regression: shared opportunities must still reach every speaker.
  INSERT INTO public.opportunities (event_name, is_active, source)
  VALUES ('ZZ acceptance test shared opportunity', true, 'acceptance_test')
  RETURNING id INTO pub;
  SELECT count(*) INTO n FROM public.opportunity_scores WHERE opportunity_id = pub AND user_id IN (a, b);
  IF n = 2 THEN log := log || E'\nPASS  shared opportunities still reach both speakers';
  ELSE log := log || format(E'\nFAIL  SHARED OPPORTUNITY SCORING BROKE (reached %s of 2)', n); fails := fails + 1; END IF;

  RAISE EXCEPTION 'RESULTS (rolled back, nothing was saved)%',
    log || CASE WHEN fails = 0 THEN E'\n\nALL PASSED'
                ELSE format(E'\n\n%s FAILED: do not ship', fails) END;
END
$test$;
