-- Create follow_up_reminders table
CREATE TABLE public.follow_up_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  match_id UUID NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('first', 'second', 'final')),
  due_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.follow_up_reminders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own reminders"
  ON public.follow_up_reminders
  FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own reminders"
  ON public.follow_up_reminders
  FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own reminders"
  ON public.follow_up_reminders
  FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own reminders"
  ON public.follow_up_reminders
  FOR DELETE
  USING (auth.uid() = speaker_id);

-- Add follow-up interval settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN follow_up_interval_1 INTEGER DEFAULT 7,
ADD COLUMN follow_up_interval_2 INTEGER DEFAULT 14,
ADD COLUMN follow_up_interval_3 INTEGER DEFAULT 21;

-- Create index for efficient queries
CREATE INDEX idx_follow_up_reminders_speaker_due ON public.follow_up_reminders(speaker_id, due_date) WHERE is_completed = false;