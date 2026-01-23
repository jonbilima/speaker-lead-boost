-- Fix 1: Restrict organizers table to show only organizers users have interacted with
DROP POLICY IF EXISTS "Authenticated users can view organizers" ON public.organizers;

CREATE POLICY "Users can view organizers they have interacted with"
ON public.organizers
FOR SELECT
USING (
  -- Users can see organizers of opportunities they've engaged with (pitched or beyond)
  EXISTS (
    SELECT 1 FROM opportunity_scores os
    JOIN opportunities o ON o.organizer_name = organizers.name
    WHERE os.user_id = auth.uid()
    AND os.pipeline_stage IN ('pitched', 'negotiating', 'accepted', 'completed')
  )
  -- Or organizers they have contacted via outreach
  OR EXISTS (
    SELECT 1 FROM outreach_activities oa
    JOIN opportunity_scores os ON os.id = oa.match_id
    JOIN opportunities o ON o.id = os.opportunity_id
    WHERE oa.speaker_id = auth.uid()
    AND o.organizer_name = organizers.name
  )
  -- Admins can see all
  OR has_role(auth.uid(), 'admin')
);

-- Fix 2: Restrict testimonial access - create a function for public testimonial access without email
DROP POLICY IF EXISTS "Anyone can view testimonials by token" ON public.testimonials;

CREATE POLICY "Anyone can view testimonials by token for submission"
ON public.testimonials
FOR SELECT
USING (
  request_token IS NOT NULL
);

-- Create a database function to get testimonials without email (for public display)
CREATE OR REPLACE FUNCTION public.get_public_testimonial(p_token text)
RETURNS TABLE (
  id uuid,
  speaker_id uuid,
  event_date date,
  rating integer,
  quote text,
  author_name text,
  author_title text,
  author_company text,
  author_photo_url text,
  event_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id, t.speaker_id, t.event_date, t.rating, t.quote, 
    t.author_name, t.author_title, t.author_company, t.author_photo_url, t.event_name
  FROM testimonials t
  WHERE t.request_token = p_token;
$$;