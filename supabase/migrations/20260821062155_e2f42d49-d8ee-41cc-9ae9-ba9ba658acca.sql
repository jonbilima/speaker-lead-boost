CREATE TABLE public.organizer_contacts (
  domain text PRIMARY KEY,
  confidence_tier text NOT NULL DEFAULT 'unreachable',
  status text NOT NULL DEFAULT 'not_found',
  email text,
  contact_type text,
  source_page text,
  strategy text,
  all_emails text[] NOT NULL DEFAULT '{}',
  named_staff jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_form_url text,
  contact_form_fields text[] NOT NULL DEFAULT '{}',
  linkedin_url text,
  phone text,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  physical_address text,
  paths_found text[] NOT NULL DEFAULT '{}',
  strategies_tried text[] NOT NULL DEFAULT '{}',
  render_used boolean NOT NULL DEFAULT false,
  pages_fetched integer NOT NULL DEFAULT 0,
  crawl_ms integer,
  error text,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizer_contacts_tier ON public.organizer_contacts (confidence_tier);
CREATE INDEX idx_organizer_contacts_last_attempt ON public.organizer_contacts (last_attempt_at);

GRANT SELECT ON public.organizer_contacts TO authenticated;
GRANT ALL ON public.organizer_contacts TO service_role;

ALTER TABLE public.organizer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read organizer contacts"
ON public.organizer_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages organizer contacts"
ON public.organizer_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_organizer_contacts_updated_at
BEFORE UPDATE ON public.organizer_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();