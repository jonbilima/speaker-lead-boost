-- Create coach_conversations table
CREATE TABLE public.coach_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  mode TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coach_usage table for tracking monthly usage
CREATE TABLE public.coach_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL, -- Format: '2026-01'
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(speaker_id, year_month)
);

-- Create indexes
CREATE INDEX idx_coach_conversations_speaker ON public.coach_conversations(speaker_id);
CREATE INDEX idx_coach_conversations_updated ON public.coach_conversations(updated_at DESC);
CREATE INDEX idx_coach_usage_speaker_month ON public.coach_usage(speaker_id, year_month);

-- Enable RLS
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for coach_conversations
CREATE POLICY "Users can view their own conversations" 
ON public.coach_conversations 
FOR SELECT 
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own conversations" 
ON public.coach_conversations 
FOR INSERT 
WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own conversations" 
ON public.coach_conversations 
FOR UPDATE 
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own conversations" 
ON public.coach_conversations 
FOR DELETE 
USING (auth.uid() = speaker_id);

-- RLS policies for coach_usage
CREATE POLICY "Users can view their own usage" 
ON public.coach_usage 
FOR SELECT 
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own usage" 
ON public.coach_usage 
FOR INSERT 
WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own usage" 
ON public.coach_usage 
FOR UPDATE 
USING (auth.uid() = speaker_id);

-- Trigger for updated_at
CREATE TRIGGER update_coach_conversations_updated_at
BEFORE UPDATE ON public.coach_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coach_usage_updated_at
BEFORE UPDATE ON public.coach_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();