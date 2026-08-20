ALTER TABLE public.opportunities_meetup_backup_20260820 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetup_purge_retained_20260820 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunities_meetup_backup_20260820 FROM anon, authenticated;
REVOKE ALL ON public.meetup_purge_retained_20260820 FROM anon, authenticated;
GRANT ALL ON public.opportunities_meetup_backup_20260820 TO service_role;
GRANT ALL ON public.meetup_purge_retained_20260820 TO service_role;