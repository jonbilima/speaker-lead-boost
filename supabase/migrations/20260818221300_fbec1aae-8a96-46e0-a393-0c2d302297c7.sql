ALTER TABLE public.opportunities_vertical_backup_20260818 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunities_vertical_backup_20260818 FROM anon, authenticated;
GRANT ALL ON public.opportunities_vertical_backup_20260818 TO service_role;