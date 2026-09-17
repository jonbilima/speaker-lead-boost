CREATE TABLE IF NOT EXISTS public.opportunities_contact_backup_20260917 AS
SELECT id, organizer_email, organizer_name, created_at FROM public.opportunities;

ALTER TABLE public.opportunities_contact_backup_20260917 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read contact backup 20260917"
  ON public.opportunities_contact_backup_20260917
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.opportunities_contact_backup_20260917 TO authenticated;
GRANT ALL ON public.opportunities_contact_backup_20260917 TO service_role;

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS organizer_contact_url text;

UPDATE public.opportunities
SET organizer_email = nullif(trim(raw_data->>'organizer_contact_email'),'')
WHERE coalesce(trim(organizer_email),'') = ''
  AND nullif(trim(raw_data->>'organizer_contact_email'),'') IS NOT NULL;

UPDATE public.opportunities
SET organizer_name = nullif(trim(raw_data->>'organizer_contact_name'),'')
WHERE coalesce(trim(organizer_name),'') = ''
  AND nullif(trim(raw_data->>'organizer_contact_name'),'') IS NOT NULL;

UPDATE public.opportunities
SET organizer_contact_url = nullif(trim(raw_data->>'organizer_contact_url'),'')
WHERE coalesce(trim(organizer_contact_url),'') = ''
  AND nullif(trim(raw_data->>'organizer_contact_url'),'') IS NOT NULL;