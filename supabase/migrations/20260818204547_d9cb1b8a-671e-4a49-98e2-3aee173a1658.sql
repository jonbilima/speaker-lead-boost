CREATE TABLE public.opportunities_backup_20260817 AS SELECT * FROM public.opportunities;
GRANT ALL ON public.opportunities_backup_20260817 TO service_role;
ALTER TABLE public.opportunities_backup_20260817 ENABLE ROW LEVEL SECURITY;