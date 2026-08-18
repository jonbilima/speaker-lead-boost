CREATE OR REPLACE FUNCTION public.score_opportunities_for_user(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_user_topic_count integer;
BEGIN
  SELECT count(*) INTO v_user_topic_count FROM user_topics ut WHERE ut.user_id = p_user_id;

  WITH prof AS (
    SELECT p.id, p.fee_range_min
    FROM profiles p
    WHERE p.id = p_user_id
  ),
  utopics AS (
    SELECT ut.topic_id FROM user_topics ut WHERE ut.user_id = p_user_id
  ),
  calc AS (
    SELECT
      o.id AS opportunity_id,
      o.deadline,
      o.event_url,
      o.organizer_email,
      o.fee_estimate_min,
      prof.fee_range_min AS user_fee_min,
      EXISTS (SELECT 1 FROM opportunity_topics ot WHERE ot.opportunity_id = o.id) AS has_topics,
      EXISTS (
        SELECT 1 FROM opportunity_topics ot
        JOIN utopics u ON u.topic_id = ot.topic_id
        WHERE ot.opportunity_id = o.id
      ) AS topic_overlap,
      CASE WHEN EXISTS (
        SELECT 1 FROM opportunity_topics ot
        JOIN utopics u ON u.topic_id = ot.topic_id
        WHERE ot.opportunity_id = o.id
      ) THEN 80 ELSE 20 END::numeric AS topic_match_score,
      CASE WHEN prof.fee_range_min IS NOT NULL
             AND COALESCE(o.fee_estimate_min, 0) >= prof.fee_range_min * 0.8
           THEN 100 ELSE 60 END::numeric AS fee_alignment_score,
      CASE
        WHEN o.deadline IS NULL THEN 60
        WHEN CEIL(EXTRACT(EPOCH FROM (o.deadline - now())) / 86400.0) <= 7 THEN 100
        WHEN CEIL(EXTRACT(EPOCH FROM (o.deadline - now())) / 86400.0) <= 30 THEN 80
        WHEN CEIL(EXTRACT(EPOCH FROM (o.deadline - now())) / 86400.0) <= 90 THEN 60
        ELSE 40
      END::numeric AS deadline_urgency_score
    FROM opportunities o
    CROSS JOIN prof
    WHERE o.is_active = true
  ),
  scored AS (
    SELECT
      c.*,
      LEAST(100, GREATEST(1, ROUND(
        (c.topic_match_score * 0.80 + c.fee_alignment_score * 0.10 + c.deadline_urgency_score * 0.05) / 0.95
      )))::numeric AS ai_score,
      (
        ARRAY[]::text[]
        -- topic fit
        || CASE
             WHEN c.topic_overlap THEN ARRAY['topic_match_strong']
             WHEN NOT c.has_topics THEN ARRAY['no_topics_tagged']
             ELSE ARRAY['topic_match_none']
           END
        || CASE WHEN v_user_topic_count = 0 THEN ARRAY['speaker_topics_missing'] ELSE ARRAY[]::text[] END
        -- fee fit
        || CASE
             WHEN c.user_fee_min IS NULL THEN ARRAY['fee_floor_not_set']
             WHEN c.fee_estimate_min IS NULL THEN ARRAY['fee_not_listed']
             WHEN c.fee_estimate_min >= c.user_fee_min * 0.8 THEN ARRAY['fee_above_floor']
             ELSE ARRAY['fee_below_floor']
           END
        -- deadline
        || CASE
             WHEN c.deadline IS NULL THEN ARRAY['no_deadline_listed']
             WHEN CEIL(EXTRACT(EPOCH FROM (c.deadline - now())) / 86400.0) <= 7 THEN ARRAY['deadline_tight']
             ELSE ARRAY['deadline_comfortable']
           END
        -- speaker access
        || CASE
             WHEN c.event_url IS NOT NULL THEN ARRAY['public_cfp']
             ELSE ARRAY['cold_pitch_required']
           END
      ) AS reason_codes
    FROM calc c
  ),
  ins AS (
    INSERT INTO opportunity_scores (
      opportunity_id, user_id, ai_score,
      topic_match_score, fee_alignment_score, deadline_urgency_score, reason_codes, calculated_at
    )
    SELECT s.opportunity_id, p_user_id, s.ai_score,
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