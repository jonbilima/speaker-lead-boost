REVOKE ALL ON public.opportunity_scores_backup_reasoncodes FROM anon, authenticated;
ALTER TABLE public.opportunity_scores_backup_reasoncodes ENABLE ROW LEVEL SECURITY;