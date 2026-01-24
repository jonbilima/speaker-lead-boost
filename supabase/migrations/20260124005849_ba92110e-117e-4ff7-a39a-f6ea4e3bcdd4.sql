-- Create speeches table
CREATE TABLE public.speeches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  title TEXT,
  topic TEXT,
  target_audience TEXT,
  duration_minutes INTEGER DEFAULT 30,
  speech_type TEXT DEFAULT 'keynote',
  industry_context TEXT,
  key_message TEXT,
  desired_outcome TEXT,
  outline JSONB DEFAULT '[]'::jsonb,
  full_script TEXT,
  talking_points JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  word_count INTEGER DEFAULT 0,
  estimated_duration INTEGER DEFAULT 0,
  selected_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create story_bank table
CREATE TABLE public.story_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  title TEXT NOT NULL,
  story_text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}'::text[],
  used_in_speeches UUID[] DEFAULT '{}'::uuid[],
  times_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote_library table
CREATE TABLE public.quote_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  quote_text TEXT NOT NULL,
  attribution TEXT,
  source TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.speeches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_library ENABLE ROW LEVEL SECURITY;

-- Speeches RLS policies
CREATE POLICY "Users can view their own speeches"
  ON public.speeches FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own speeches"
  ON public.speeches FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own speeches"
  ON public.speeches FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own speeches"
  ON public.speeches FOR DELETE
  USING (auth.uid() = speaker_id);

-- Story Bank RLS policies
CREATE POLICY "Users can view their own stories"
  ON public.story_bank FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own stories"
  ON public.story_bank FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own stories"
  ON public.story_bank FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own stories"
  ON public.story_bank FOR DELETE
  USING (auth.uid() = speaker_id);

-- Quote Library RLS policies
CREATE POLICY "Users can view their own quotes"
  ON public.quote_library FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own quotes"
  ON public.quote_library FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own quotes"
  ON public.quote_library FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own quotes"
  ON public.quote_library FOR DELETE
  USING (auth.uid() = speaker_id);

-- Add updated_at trigger for speeches
CREATE TRIGGER update_speeches_updated_at
  BEFORE UPDATE ON public.speeches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();