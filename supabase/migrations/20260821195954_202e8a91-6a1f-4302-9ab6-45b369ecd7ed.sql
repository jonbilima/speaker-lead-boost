CREATE TABLE IF NOT EXISTS public.aggregator_domain_resolution_20260821 (
  opportunity_id uuid NOT NULL,
  aggregator text NOT NULL,
  aggregator_url text NOT NULL,
  resolved_domain text,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id)
);
GRANT ALL ON public.aggregator_domain_resolution_20260821 TO service_role;
ALTER TABLE public.aggregator_domain_resolution_20260821 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view aggregator resolution log"
ON public.aggregator_domain_resolution_20260821
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));