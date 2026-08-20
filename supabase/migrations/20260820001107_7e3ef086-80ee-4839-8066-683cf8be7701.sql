
ALTER VIEW public.v_source_yield SET (security_invoker = on);
ALTER VIEW public.v_source_yield_daily SET (security_invoker = on);

CREATE POLICY "Admins can view all opportunities"
ON public.opportunities FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all opportunity scores"
ON public.opportunity_scores FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
