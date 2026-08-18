CREATE TABLE public.opportunity_scores_backup_reasoncodes AS SELECT * FROM public.opportunity_scores;

ALTER TABLE public.opportunity_scores
  ADD COLUMN IF NOT EXISTS reason_codes text[] DEFAULT '{}'::text[];