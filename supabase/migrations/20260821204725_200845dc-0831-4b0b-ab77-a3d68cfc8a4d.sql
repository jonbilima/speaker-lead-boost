GRANT SELECT ON public.aggregator_domain_resolution_20260821 TO authenticated;
CREATE POLICY "Authenticated users can read resolved organizer domains"
ON public.aggregator_domain_resolution_20260821
FOR SELECT TO authenticated
USING (true);