
DO $$
DECLARE r record; total int := 0;
BEGIN
  FOR r IN SELECT DISTINCT merged_into AS id FROM public.opportunities WHERE merged_into IS NOT NULL LOOP
    total := total + public.score_opportunity_for_all_users(r.id);
  END LOOP;
  RAISE NOTICE 'rescored % rows', total;
END $$;
