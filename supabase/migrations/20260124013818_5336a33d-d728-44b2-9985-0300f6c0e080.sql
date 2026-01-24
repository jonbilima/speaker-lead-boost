-- Add timezone and include_revenue_update columns to email_digest_preferences
ALTER TABLE public.email_digest_preferences 
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS include_revenue_update boolean NOT NULL DEFAULT true;

-- Add more fields to email_digest_logs for better tracking
ALTER TABLE public.email_digest_logs 
ADD COLUMN IF NOT EXISTS opportunities_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS deadlines_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS follow_ups_count integer DEFAULT 0;