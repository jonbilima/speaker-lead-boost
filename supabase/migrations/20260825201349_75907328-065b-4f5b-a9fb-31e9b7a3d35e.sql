CREATE TABLE public.organizer_contacts_backup_20260825 AS SELECT * FROM public.organizer_contacts;
ALTER TABLE public.organizer_contacts_backup_20260825 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.organizer_contacts_backup_20260825 TO service_role;
CREATE POLICY "svc only" ON public.organizer_contacts_backup_20260825 TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.opportunities_email_backup_20260825b AS SELECT id, organizer_email FROM public.opportunities;
ALTER TABLE public.opportunities_email_backup_20260825b ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.opportunities_email_backup_20260825b TO service_role;
CREATE POLICY "svc only" ON public.opportunities_email_backup_20260825b TO service_role USING (true) WITH CHECK (true);