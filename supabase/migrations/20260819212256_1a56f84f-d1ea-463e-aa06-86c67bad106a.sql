ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS event_fingerprint text,
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_canonical_url ON public.opportunities (canonical_url) WHERE canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_event_fingerprint ON public.opportunities (event_fingerprint) WHERE event_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_merged_into ON public.opportunities (merged_into) WHERE merged_into IS NOT NULL;