-- Create email digest preferences table
CREATE TABLE public.email_digest_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  send_day TEXT NOT NULL DEFAULT 'monday' CHECK (send_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  send_time TIME NOT NULL DEFAULT '09:00:00',
  include_new_matches BOOLEAN NOT NULL DEFAULT true,
  include_deadlines BOOLEAN NOT NULL DEFAULT true,
  include_follow_ups BOOLEAN NOT NULL DEFAULT true,
  include_pipeline_summary BOOLEAN NOT NULL DEFAULT true,
  include_market_insights BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(speaker_id)
);

-- Create email digest logs table
CREATE TABLE public.email_digest_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_id TEXT,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_digest_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_digest_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_digest_preferences
CREATE POLICY "Users can view their own digest preferences"
  ON public.email_digest_preferences FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own digest preferences"
  ON public.email_digest_preferences FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own digest preferences"
  ON public.email_digest_preferences FOR UPDATE
  USING (auth.uid() = speaker_id);

-- RLS policies for email_digest_logs
CREATE POLICY "Users can view their own digest logs"
  ON public.email_digest_logs FOR SELECT
  USING (auth.uid() = speaker_id);

-- Create trigger for updating updated_at
CREATE TRIGGER update_email_digest_preferences_updated_at
  BEFORE UPDATE ON public.email_digest_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create digest preferences for new users
CREATE OR REPLACE FUNCTION public.create_default_digest_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.email_digest_preferences (speaker_id)
  VALUES (NEW.id)
  ON CONFLICT (speaker_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create preferences when profile is created
CREATE TRIGGER create_digest_preferences_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_digest_preferences();

-- Create index for efficient cron queries
CREATE INDEX idx_email_digest_preferences_enabled ON public.email_digest_preferences(is_enabled, send_day, send_time);
CREATE INDEX idx_email_digest_logs_speaker_sent ON public.email_digest_logs(speaker_id, sent_at DESC);