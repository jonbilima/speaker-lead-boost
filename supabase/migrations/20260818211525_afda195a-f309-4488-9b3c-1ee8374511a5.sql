CREATE TABLE public.opportunity_scores_backup_20260817 AS SELECT * FROM public.opportunity_scores;
ALTER TABLE public.opportunity_scores_backup_20260817 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.opportunity_scores_backup_20260817 TO service_role;