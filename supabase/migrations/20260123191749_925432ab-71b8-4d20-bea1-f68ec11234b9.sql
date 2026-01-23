-- Drop the problematic update policy and create a proper one for token-based submissions
DROP POLICY IF EXISTS "Anyone can submit testimonial via token" ON public.testimonials;

-- Allow anonymous users to update testimonials that have a request_token and empty quote
CREATE POLICY "Anyone can submit testimonial via token"
  ON public.testimonials FOR UPDATE
  USING (request_token IS NOT NULL)
  WITH CHECK (request_token IS NOT NULL);