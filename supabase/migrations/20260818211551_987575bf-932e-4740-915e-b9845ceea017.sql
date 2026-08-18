CREATE OR REPLACE FUNCTION public.score_opportunities_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
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
      )))::numeric AS ai_score
    FROM calc c
  ),
  ins AS (
    INSERT INTO opportunity_scores (
      opportunity_id, user_id, ai_score,
      topic_match_score, fee_alignment_score, deadline_urgency_score, calculated_at
    )
    SELECT s.opportunity_id, p_user_id, s.ai_score,
           s.topic_match_score, s.fee_alignment_score, s.deadline_urgency_score, now()
    FROM scored s
    ON CONFLICT (opportunity_id, user_id) DO UPDATE SET
      ai_score = EXCLUDED.ai_score,
      topic_match_score = EXCLUDED.topic_match_score,
      fee_alignment_score = EXCLUDED.fee_alignment_score,
      deadline_urgency_score = EXCLUDED.deadline_urgency_score,
      calculated_at = EXCLUDED.calculated_at
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.score_opportunities_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_opportunities_for_user(uuid) TO service_role;