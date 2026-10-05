-- Private, self-sourced gigs ("Add my own gig").
--
-- Speakers book work outside NextMIC: website inquiries, local churches, word
-- of mouth. They want those in the same pipeline as everything else, with
-- packages, invoices and fee tracking, and they must never reach anyone else.
--
-- A private gig is an ordinary opportunities row plus one opportunity_scores
-- row for its owner. Every downstream feature (pipeline, packages, bookings,
-- invoices, pitches, applied_logs) hangs off that score row, so all of it works
-- unchanged. What changes is that "opportunities are shared" stops being
-- unconditional. That assumption is enforced in four places, all handled here:
--
--   1. RLS        - every active row was readable by every signed-in user.
--   2. Scoring    - a trigger scored every new active row for every speaker,
--                   which is how a row lands in someone's pipeline. All scoring
--                   goes through score_opportunity_matches, so one change there
--                   covers both triggers, both sweeps and the topic rescore.
--   3. Service-role writers (scrapers, organizer crawls, merges) bypass RLS.
--                   A guard trigger stops anyone but the owner changing a
--                   private row, except system deactivation.
--   4. Backstop   - a score row may only reference a private gig if it belongs
--                   to the owner. Enforced on opportunity_scores itself, so no
--                   current or future code path can put one in another
--                   speaker's pipeline, digest or package list.
--
-- Expiry still applies: private gigs are deactivated, never deleted.

-- 1. Ownership ---------------------------------------------------------------

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- A private row always has an owner; a shared row never does. Existing rows
-- are all shared with no owner, so this validates cleanly.
ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_private_has_owner;
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_private_has_owner CHECK (
    (is_private AND owner_user_id IS NOT NULL)
    OR (NOT is_private AND owner_user_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS opportunities_owner_private_idx
  ON public.opportunities (owner_user_id) WHERE is_private;

-- 2. RLS ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view active opportunities" ON public.opportunities;
CREATE POLICY "Authenticated users can view active opportunities"
  ON public.opportunities FOR SELECT TO authenticated
  USING (is_active = true AND (is_private = false OR owner_user_id = auth.uid()));

-- Owners may edit their own gig (the fee moves during negotiation). WITH CHECK
-- means an edit can never publish it or hand it to someone else.
DROP POLICY IF EXISTS "Owners can update their private gigs" ON public.opportunities;
CREATE POLICY "Owners can update their private gigs"
  ON public.opportunities FOR UPDATE TO authenticated
  USING (is_private AND owner_user_id = auth.uid())
  WITH CHECK (is_private AND owner_user_id = auth.uid());

-- If the old client-side manual-insert policy still exists, stop it creating
-- private rows: those go through add_private_gig only. Altered rather than
-- recreated, so a policy that was deliberately dropped stays dropped.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'opportunities'
      AND policyname = 'Users can submit manual opportunities'
  ) THEN
    ALTER POLICY "Users can submit manual opportunities" ON public.opportunities
      WITH CHECK (source = 'manual' AND is_verified = false
                  AND is_private = false AND owner_user_id IS NULL);
  END IF;
END $$;

-- 3. Scoring choke point -----------------------------------------------------
-- Verbatim copy of 20260818214846 with two changes, marked CHANGED: the opps
-- CTE carries ownership, and pairs only matches a private gig to its owner.

CREATE OR REPLACE FUNCTION public.score_opportunity_matches(
  p_user_id uuid DEFAULT NULL,
  p_opportunity_id uuid DEFAULT NULL,
  p_only_missing boolean DEFAULT false,
  p_limit integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH users AS (
    SELECT p.id AS user_id,
           p.fee_range_min,
           (SELECT count(*) FROM user_topics ut WHERE ut.user_id = p.id) AS topic_count
    FROM profiles p
    WHERE p_user_id IS NULL OR p.id = p_user_id
  ),
  opps AS (
    SELECT o.id, o.deadline, o.event_url, o.fee_estimate_min,
           o.is_private, o.owner_user_id,                                  -- CHANGED
           EXISTS (SELECT 1 FROM opportunity_topics ot WHERE ot.opportunity_id = o.id) AS has_topics
    FROM opportunities o
    WHERE o.is_active = true
      AND (p_opportunity_id IS NULL OR o.id = p_opportunity_id)
  ),
  pairs AS (
    SELECT u.user_id, o.id AS opportunity_id, o.deadline, o.event_url,
           o.fee_estimate_min, o.has_topics, u.fee_range_min AS user_fee_min,
           u.topic_count AS user_topic_count
    FROM users u
    CROSS JOIN opps o
    WHERE (NOT o.is_private OR o.owner_user_id = u.user_id)               -- CHANGED
      AND (NOT p_only_missing
           OR NOT EXISTS (
                SELECT 1 FROM opportunity_scores s
                WHERE s.opportunity_id = o.id AND s.user_id = u.user_id
              ))
    LIMIT p_limit
  ),
  calc AS (
    SELECT
      pr.*,
      EXISTS (
        SELECT 1 FROM opportunity_topics ot
        JOIN user_topics ut ON ut.topic_id = ot.topic_id AND ut.user_id = pr.user_id
        WHERE ot.opportunity_id = pr.opportunity_id
      ) AS topic_overlap
    FROM pairs pr
  ),
  comp AS (
    SELECT
      c.*,
      CASE WHEN c.topic_overlap THEN 80 ELSE 20 END::numeric AS topic_match_score,
      CASE WHEN c.user_fee_min IS NOT NULL
             AND COALESCE(c.fee_estimate_min, 0) >= c.user_fee_min * 0.8
           THEN 100 ELSE 60 END::numeric AS fee_alignment_score,
      CASE
        WHEN c.deadline IS NULL THEN 60
        WHEN CEIL(EXTRACT(EPOCH FROM (c.deadline - now())) / 86400.0) <= 7 THEN 100
        WHEN CEIL(EXTRACT(EPOCH FROM (c.deadline - now())) / 86400.0) <= 30 THEN 80
        WHEN CEIL(EXTRACT(EPOCH FROM (c.deadline - now())) / 86400.0) <= 90 THEN 60
        ELSE 40
      END::numeric AS deadline_urgency_score
    FROM calc c
  ),
  scored AS (
    SELECT
      cp.*,
      LEAST(100, GREATEST(1, ROUND(
        (cp.topic_match_score * 0.80 + cp.fee_alignment_score * 0.10 + cp.deadline_urgency_score * 0.05) / 0.95
      )))::numeric AS ai_score,
      (
        ARRAY[]::text[]
        || CASE
             WHEN cp.topic_overlap THEN ARRAY['topic_match_strong']
             WHEN NOT cp.has_topics THEN ARRAY['no_topics_tagged']
             ELSE ARRAY['topic_match_none']
           END
        || CASE WHEN cp.user_topic_count = 0 THEN ARRAY['speaker_topics_missing'] ELSE ARRAY[]::text[] END
        || CASE
             WHEN cp.user_fee_min IS NULL THEN ARRAY['fee_floor_not_set']
             WHEN cp.fee_estimate_min IS NULL THEN ARRAY['fee_not_listed']
             WHEN cp.fee_estimate_min >= cp.user_fee_min * 0.8 THEN ARRAY['fee_above_floor']
             ELSE ARRAY['fee_below_floor']
           END
        || CASE
             WHEN cp.deadline IS NULL THEN ARRAY['no_deadline_listed']
             WHEN CEIL(EXTRACT(EPOCH FROM (cp.deadline - now())) / 86400.0) <= 7 THEN ARRAY['deadline_tight']
             ELSE ARRAY['deadline_comfortable']
           END
        || CASE
             WHEN cp.event_url IS NOT NULL THEN ARRAY['public_cfp']
             ELSE ARRAY['cold_pitch_required']
           END
      ) AS reason_codes
    FROM comp cp
  ),
  ins AS (
    INSERT INTO opportunity_scores (
      opportunity_id, user_id, ai_score,
      topic_match_score, fee_alignment_score, deadline_urgency_score, reason_codes, calculated_at
    )
    SELECT s.opportunity_id, s.user_id, s.ai_score,
           s.topic_match_score, s.fee_alignment_score, s.deadline_urgency_score, s.reason_codes, now()
    FROM scored s
    ON CONFLICT (opportunity_id, user_id) DO UPDATE SET
      ai_score = EXCLUDED.ai_score,
      topic_match_score = EXCLUDED.topic_match_score,
      fee_alignment_score = EXCLUDED.fee_alignment_score,
      deadline_urgency_score = EXCLUDED.deadline_urgency_score,
      reason_codes = EXCLUDED.reason_codes,
      calculated_at = EXCLUDED.calculated_at
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  RETURN v_count;
END;
$function$;

-- 4. Guard: nobody but the owner changes a private gig -----------------------
-- Scrapers, organizer crawls and merges run as service role and bypass RLS.
-- Rather than trust every one of them to remember the rule, reject their edits
-- here. System deactivation (expiry, dead links) is the one change allowed,
-- because the rule is deactivate, never delete. Silent rather than raising so
-- one private row can never abort a scraper's whole batch.

CREATE OR REPLACE FUNCTION public.trg_guard_private_opportunity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deactivate boolean;
BEGIN
  IF OLD.is_private AND auth.uid() IS DISTINCT FROM OLD.owner_user_id THEN
    v_deactivate := (NEW.is_active IS FALSE AND OLD.is_active IS TRUE);
    NEW := OLD;
    IF v_deactivate THEN
      NEW.is_active := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_private_opportunity ON public.opportunities;
CREATE TRIGGER guard_private_opportunity
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.trg_guard_private_opportunity();

-- 5. Backstop: a private gig's score row belongs to its owner, full stop -----
-- The pipeline, digest, package list and GigScore all read opportunity_scores.
-- If this holds, none of them can show one speaker's private gig to another.
-- Raises, because reaching it means some code path is wrong and should fail
-- loudly rather than leak.

CREATE OR REPLACE FUNCTION public.trg_guard_private_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_private boolean;
  v_owner uuid;
BEGIN
  SELECT o.is_private, o.owner_user_id INTO v_private, v_owner
  FROM opportunities o WHERE o.id = NEW.opportunity_id;

  IF v_private AND v_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'opportunity % is a private gig belonging to another speaker', NEW.opportunity_id
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_private_score ON public.opportunity_scores;
CREATE TRIGGER guard_private_score
  BEFORE INSERT OR UPDATE OF opportunity_id, user_id ON public.opportunity_scores
  FOR EACH ROW EXECUTE FUNCTION public.trg_guard_private_score();

-- 6. Create one --------------------------------------------------------------
-- Atomic, and ownership comes from the session, never the request body. The
-- insert fires score_new_opportunity, which (after the change above) creates
-- exactly one score row: the owner's. This then sets the stage the speaker
-- chose, mirroring what dragging a card does in the pipeline.

CREATE OR REPLACE FUNCTION public.add_private_gig(
  p_event_name      text,
  p_organizer_name  text        DEFAULT NULL,
  p_organizer_email text        DEFAULT NULL,
  p_event_date      timestamptz DEFAULT NULL,
  p_location        text        DEFAULT NULL,
  p_is_virtual      boolean     DEFAULT false,
  p_topic           text        DEFAULT NULL,
  p_fee             numeric     DEFAULT NULL,
  p_stage           text        DEFAULT 'interested',
  p_notes           text        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_stage public.pipeline_stage;
  v_opp   uuid;
  v_match uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to add a gig.' USING ERRCODE = '28000';
  END IF;
  IF p_event_name IS NULL OR btrim(p_event_name) = '' THEN
    RAISE EXCEPTION 'Give the gig a name.' USING ERRCODE = '22023';
  END IF;
  IF p_fee IS NOT NULL AND p_fee < 0 THEN
    RAISE EXCEPTION 'The fee can''t be negative.' USING ERRCODE = '22023';
  END IF;
  -- Stages a speaker can genuinely be at. Not 'new': that means untouched.
  IF p_stage NOT IN ('interested', 'pitched', 'negotiating', 'accepted', 'completed') THEN
    RAISE EXCEPTION 'Unknown stage: %', p_stage USING ERRCODE = '22023';
  END IF;
  v_stage := p_stage::public.pipeline_stage;

  INSERT INTO opportunities (
    event_name, organizer_name, organizer_email, event_date, location,
    description, fee_estimate_min, fee_estimate_max,
    source, submitted_by, owner_user_id, is_private,
    is_verified, is_active, scraped_at, raw_data
  ) VALUES (
    left(btrim(p_event_name), 300),
    nullif(left(btrim(coalesce(p_organizer_name, '')), 200), ''),
    nullif(left(lower(btrim(coalesce(p_organizer_email, ''))), 320), ''),
    p_event_date,
    CASE WHEN p_is_virtual THEN 'Virtual'
         ELSE nullif(left(btrim(coalesce(p_location, '')), 300), '') END,
    nullif(left(btrim(coalesce(p_topic, '')), 300), ''),
    p_fee,
    p_fee,
    'private', v_uid, v_uid, true,
    true, true, now(),
    jsonb_build_object('private_gig', true, 'topic', p_topic, 'is_virtual', p_is_virtual)
  )
  RETURNING id INTO v_opp;

  UPDATE opportunity_scores
     SET pipeline_stage = v_stage,
         interested_at  = now(),
         accepted_at    = CASE WHEN v_stage IN ('accepted', 'completed') THEN now() END,
         completed_at   = CASE WHEN v_stage = 'completed' THEN now() END
   WHERE opportunity_id = v_opp AND user_id = v_uid
  RETURNING id INTO v_match;

  -- No profiles row means the scoring trigger skipped this speaker. Add the
  -- score row directly so the gig still lands in their pipeline.
  IF v_match IS NULL THEN
    INSERT INTO opportunity_scores (
      opportunity_id, user_id, pipeline_stage, calculated_at,
      interested_at, accepted_at, completed_at
    ) VALUES (
      v_opp, v_uid, v_stage, now(),
      now(),
      CASE WHEN v_stage IN ('accepted', 'completed') THEN now() END,
      CASE WHEN v_stage = 'completed' THEN now() END
    )
    RETURNING id INTO v_match;
  END IF;

  INSERT INTO outreach_activities (match_id, speaker_id, activity_type, notes)
  VALUES (v_match, v_uid, 'note', 'Added as a private gig');

  IF p_notes IS NOT NULL AND btrim(p_notes) <> '' THEN
    INSERT INTO outreach_activities (match_id, speaker_id, activity_type, notes)
    VALUES (v_match, v_uid, 'note', left(btrim(p_notes), 5000));
  END IF;

  RETURN jsonb_build_object('opportunity_id', v_opp, 'match_id', v_match);
END;
$function$;

REVOKE ALL ON FUNCTION public.add_private_gig(text, text, text, timestamptz, text, boolean, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_private_gig(text, text, text, timestamptz, text, boolean, text, numeric, text, text) TO authenticated;

-- Same hardening as 20260818214901 applied to the scoring triggers: trigger
-- functions are never callable by clients. Triggers still fire, since EXECUTE
-- is not checked at fire time. CREATE OR REPLACE above keeps that migration's
-- revokes on score_opportunity_matches intact.
REVOKE ALL ON FUNCTION public.trg_guard_private_opportunity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_guard_private_score() FROM PUBLIC, anon, authenticated;