-- Create tags table for opportunity tagging
CREATE TABLE public.pipeline_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tags"
ON public.pipeline_tags FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags"
ON public.pipeline_tags FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
ON public.pipeline_tags FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
ON public.pipeline_tags FOR DELETE USING (auth.uid() = user_id);

-- Add tags and archived columns to opportunity_scores
ALTER TABLE public.opportunity_scores 
ADD COLUMN IF NOT EXISTS tags UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Create index for faster tag queries
CREATE INDEX idx_pipeline_tags_user_id ON public.pipeline_tags(user_id);
CREATE INDEX idx_opportunity_scores_archived ON public.opportunity_scores(is_archived) WHERE is_archived = true;