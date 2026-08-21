ALTER TABLE public.opportunities_nonus_backup_20260821 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunities_nonus_backup_20260821 FROM anon, authenticated;
GRANT ALL ON public.opportunities_nonus_backup_20260821 TO service_role;