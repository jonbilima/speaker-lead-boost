ALTER TABLE public.opportunity_topics_backup_20260818 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_topics_backup_20260818 FROM anon, authenticated;
GRANT ALL ON public.opportunity_topics_backup_20260818 TO service_role;