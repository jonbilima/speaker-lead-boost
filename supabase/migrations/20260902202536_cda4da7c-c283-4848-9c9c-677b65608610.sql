CREATE TABLE public.organizer_event_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL,
  event_name text,
  event_slug text NOT NULL,
  next_event_date date,
  next_event_date_end date,
  next_event_date_text text,
  date_confidence text CHECK (date_confidence IN ('explicit_date','month_year','year_only')),
  date_source_url text,
  date_confirmed_at timestamptz,
  cfp_status text NOT NULL DEFAULT 'unknown' CHECK (cfp_status IN ('open','announced_not_open','closed','unknown')),
  cfp_url text,
  cfp_deadline date,
  cfp_source_url text,
  cfp_confirmed_at timestamptz,
  site_shape text CHECK (site_shape IN ('standing_cfp_url','homepage_next_date','multi_event_calendar')),
  render_used boolean NOT NULL DEFAULT false,
  raw_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, event_slug)
);

CREATE INDEX idx_oes_domain ON public.organizer_event_signals (domain);
CREATE INDEX idx_oes_next_date ON public.organizer_event_signals (next_event_date);

GRANT SELECT ON public.organizer_event_signals TO authenticated;
GRANT ALL ON public.organizer_event_signals TO service_role;

ALTER TABLE public.organizer_event_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read event signals"
ON public.organizer_event_signals FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_organizer_event_signals_updated_at
BEFORE UPDATE ON public.organizer_event_signals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.organizer_crawl_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL,
  pages_fetched integer NOT NULL DEFAULT 0,
  render_used boolean NOT NULL DEFAULT false,
  signals_found integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok',
  error text,
  ran_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocr_domain ON public.organizer_crawl_runs (domain);

GRANT SELECT ON public.organizer_crawl_runs TO authenticated;
GRANT ALL ON public.organizer_crawl_runs TO service_role;

ALTER TABLE public.organizer_crawl_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read crawl runs"
ON public.organizer_crawl_runs FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_organizer_crawl_runs_updated_at
BEFORE UPDATE ON public.organizer_crawl_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();