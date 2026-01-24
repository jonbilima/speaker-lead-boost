-- Add community sharing columns to opportunity_scores
ALTER TABLE public.opportunity_scores 
ADD COLUMN IF NOT EXISTS shared_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS shared_by UUID REFERENCES auth.users(id);

-- Add submitted_by to track who submitted manual opportunities
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS submitted_by UUID,
ADD COLUMN IF NOT EXISTS karma_awarded BOOLEAN DEFAULT false;

-- Create opportunity_karma table to track user contributions
CREATE TABLE IF NOT EXISTS public.opportunity_karma (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'submitted', 'verified', 'shared'
  points INTEGER NOT NULL DEFAULT 1,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on karma
ALTER TABLE public.opportunity_karma ENABLE ROW LEVEL SECURITY;

-- Users can view their own karma
CREATE POLICY "Users can view their own karma"
  ON public.opportunity_karma
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own karma (awarded by system)
CREATE POLICY "Users can insert own karma"
  ON public.opportunity_karma
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all karma
CREATE POLICY "Admins can view all karma"
  ON public.opportunity_karma
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Add tracking keywords to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tracking_keywords TEXT[] DEFAULT '{}';

-- Create index for community shared opportunities
CREATE INDEX IF NOT EXISTS idx_opportunity_scores_shared ON public.opportunity_scores(shared_at) WHERE shared_at IS NOT NULL;

-- Add comment
COMMENT ON TABLE public.opportunity_karma IS 
  'Tracks user contributions to the opportunity database. Points awarded for submitting, getting verified, and sharing opportunities.';