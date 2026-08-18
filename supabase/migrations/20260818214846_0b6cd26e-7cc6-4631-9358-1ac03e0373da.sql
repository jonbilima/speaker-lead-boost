-- Shared deterministic scoring core.
-- p_user_id NULL        => all speakers
-- p_opportunity_id NULL => all active opportunities
-- p_only_missing TRUE   => only insert pairs that have no score row yet
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
    WHERE NOT p_only_missing
       OR NOT EXISTS (
            SELECT 1 FROM opportunity_scores s
            WHERE s.opportunity_id = o.id AND s.user_id = u.user_id
          )
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

-- Score a single opportunity for every speaker.
CREATE OR REPLACE FUNCTION public.score_opportunity_for_all_users(p_opportunity_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.score_opportunity_matches(NULL, p_opportunity_id, false, NULL);
$function$;

-- Safety-net sweep: fill in missing (opportunity, user) score rows only, bounded per run.
CREATE OR REPLACE FUNCTION public.score_missing_opportunities(p_limit integer DEFAULT 50000)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.score_opportunity_matches(NULL, NULL, true, p_limit);
$function$;

-- Trigger: score brand-new active opportunities for every speaker immediately.
CREATE OR REPLACE FUNCTION public.trg_score_new_opportunity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_active IS TRUE THEN
    PERFORM public.score_opportunity_for_all_users(NEW.id);
  END IF;
  RETURN NULL;
END;
$function$;

-- Trigger: invalidate + recompute when scoring-relevant fields change.
-- Guarded by IS DISTINCT FROM so no-op writes do no work.
CREATE OR REPLACE FUNCTION public.trg_rescore_changed_opportunity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  IF NEW.fee_estimate_min IS DISTINCT FROM OLD.fee_estimate_min
     OR NEW.fee_estimate_max IS DISTINCT FROM OLD.fee_estimate_max
     OR NEW.deadline IS DISTINCT FROM OLD.deadline
     OR (NEW.is_active IS TRUE AND OLD.is_active IS DISTINCT FROM TRUE)
  THEN
    PERFORM public.score_opportunity_for_all_users(NEW.id);
  END IF;

  RETURN NULL;
END;
$function$;

-- Trigger: topic tag added/removed on an opportunity.
CREATE OR REPLACE FUNCTION public.trg_rescore_opportunity_topics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_opp uuid := COALESCE(NEW.opportunity_id, OLD.opportunity_id);
BEGIN
  IF v_opp IS NOT NULL THEN
    PERFORM public.score_opportunity_for_all_users(v_opp);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS score_new_opportunity ON public.opportunities;
CREATE TRIGGER score_new_opportunity
AFTER INSERT ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.trg_score_new_opportunity();

DROP TRIGGER IF EXISTS rescore_changed_opportunity ON public.opportunities;
CREATE TRIGGER rescore_changed_opportunity
AFTER UPDATE OF fee_estimate_min, fee_estimate_max, deadline, is_active
ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.trg_rescore_changed_opportunity();

DROP TRIGGER IF EXISTS rescore_opportunity_topics ON public.opportunity_topics;
CREATE TRIGGER rescore_opportunity_topics
AFTER INSERT OR DELETE ON public.opportunity_topics
FOR EACH ROW EXECUTE FUNCTION public.trg_rescore_opportunity_topics();