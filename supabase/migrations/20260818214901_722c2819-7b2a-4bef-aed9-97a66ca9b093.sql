REVOKE ALL ON FUNCTION public.score_opportunity_matches(uuid, uuid, boolean, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.score_opportunity_for_all_users(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.score_missing_opportunities(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_score_new_opportunity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_rescore_changed_opportunity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_rescore_opportunity_topics() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.score_opportunity_matches(uuid, uuid, boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.score_opportunity_for_all_users(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.score_missing_opportunities(integer) TO service_role;