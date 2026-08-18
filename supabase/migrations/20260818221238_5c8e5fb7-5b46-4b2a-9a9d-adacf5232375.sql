CREATE TABLE IF NOT EXISTS public.verticals (
  slug text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.verticals TO authenticated, anon;
GRANT ALL ON public.verticals TO service_role;
ALTER TABLE public.verticals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verticals are readable by everyone" ON public.verticals FOR SELECT USING (true);

INSERT INTO public.verticals (slug, label, sort_order) VALUES
  ('business','Corporate & Business Leadership',1),
  ('sales_marketing','Sales & Marketing',2),
  ('faith','Faith & Church',3),
  ('healthcare','Healthcare & Medical Associations',4),
  ('technology','Technology & AI',5),
  ('education','Education (K-12 & Higher Ed)',6),
  ('hr_workplace','Human Resources & Workplace Culture',7),
  ('finance','Finance & Accounting',8),
  ('nonprofit','Nonprofit & Associations',9),
  ('real_estate','Real Estate & Construction',10)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_verticals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vertical_slug text NOT NULL REFERENCES public.verticals(slug) ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vertical_slug)
);
CREATE INDEX IF NOT EXISTS user_verticals_user_id_idx ON public.user_verticals(user_id);
GRANT SELECT, INSERT, DELETE ON public.user_verticals TO authenticated;
GRANT ALL ON public.user_verticals TO service_role;
ALTER TABLE public.user_verticals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own verticals" ON public.user_verticals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own verticals" ON public.user_verticals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own verticals" ON public.user_verticals FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS vertical_slug text REFERENCES public.verticals(slug) ON UPDATE CASCADE;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS ingest_source text;
CREATE INDEX IF NOT EXISTS opportunities_vertical_slug_idx ON public.opportunities(vertical_slug);
CREATE INDEX IF NOT EXISTS opportunities_ingest_source_idx ON public.opportunities(ingest_source);

CREATE TABLE IF NOT EXISTS public.opportunities_vertical_backup_20260818 AS
SELECT id, vertical_slug, ingest_source FROM public.opportunities;

UPDATE public.opportunities o SET
  ingest_source = 'ingest-leads',
  vertical_slug = CASE lower(trim(o.raw_data->>'vertical_tag'))
    WHEN 'corporate and business leadership' THEN 'business'
    WHEN 'sales and marketing' THEN 'sales_marketing'
    WHEN 'faith and church' THEN 'faith'
    WHEN 'healthcare and medical associations' THEN 'healthcare'
    WHEN 'technology and ai' THEN 'technology'
    WHEN 'education and k-12/higher ed' THEN 'education'
    WHEN 'human resources and workplace culture' THEN 'hr_workplace'
    WHEN 'finance and accounting' THEN 'finance'
    WHEN 'nonprofit and associations' THEN 'nonprofit'
    WHEN 'real estate and construction' THEN 'real_estate'
    ELSE NULL END
WHERE o.raw_data ? 'application_link' AND o.raw_data ? 'event_name';