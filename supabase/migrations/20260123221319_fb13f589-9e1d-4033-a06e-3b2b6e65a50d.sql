-- Create email_logs table
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_preview TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  related_type TEXT,
  related_id UUID,
  resend_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own email logs"
  ON public.email_logs FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own email logs"
  ON public.email_logs FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

-- Add email configuration columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_reply_to TEXT,
ADD COLUMN IF NOT EXISTS email_signature TEXT,
ADD COLUMN IF NOT EXISTS email_bcc_self BOOLEAN DEFAULT false;