REVOKE ALL ON public.opportunities_mailto_backup_20260825 FROM anon, authenticated;
REVOKE ALL ON public.opportunities_deadlink_backup_20260825 FROM anon, authenticated;
GRANT ALL ON public.opportunities_mailto_backup_20260825 TO service_role;
GRANT ALL ON public.opportunities_deadlink_backup_20260825 TO service_role;
ALTER TABLE public.opportunities_mailto_backup_20260825 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities_deadlink_backup_20260825 ENABLE ROW LEVEL SECURITY;