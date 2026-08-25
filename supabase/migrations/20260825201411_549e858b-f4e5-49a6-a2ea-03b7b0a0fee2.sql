CREATE TABLE public.organizer_contacts_staging_20260825 (
  domain text primary key,
  email text,
  confidence_tier text,
  status text,
  source_page text,
  strategy text,
  all_emails text[] not null default '{}',
  named_staff jsonb not null default '[]',
  contact_form_url text,
  phone text,
  socials jsonb not null default '{}',
  paths_found text[] not null default '{}',
  pages_fetched int not null default 0
);
GRANT ALL ON public.organizer_contacts_staging_20260825 TO service_role;
GRANT INSERT, SELECT ON public.organizer_contacts_staging_20260825 TO authenticated;
ALTER TABLE public.organizer_contacts_staging_20260825 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc only" ON public.organizer_contacts_staging_20260825 TO service_role USING (true) WITH CHECK (true);