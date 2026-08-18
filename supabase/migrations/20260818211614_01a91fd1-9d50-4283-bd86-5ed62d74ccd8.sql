CREATE TABLE public.scoring_run_20260817 (
  user_id uuid PRIMARY KEY,
  rows_written integer NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  duration_ms numeric
);
ALTER TABLE public.scoring_run_20260817 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.scoring_run_20260817 TO service_role;

DO $$
DECLARE
  r record;
  t0 timestamptz;
  n integer;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.opportunity_scores LOOP
    t0 := clock_timestamp();
    n := public.score_opportunities_for_user(r.user_id);
    INSERT INTO public.scoring_run_20260817 (user_id, rows_written, duration_ms)
    VALUES (r.user_id, n, EXTRACT(EPOCH FROM (clock_timestamp() - t0)) * 1000);
  END LOOP;
END $$;