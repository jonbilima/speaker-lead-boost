-- Create calendar_connections table for storing Google Calendar OAuth tokens
CREATE TABLE public.calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  calendar_id TEXT DEFAULT 'primary',
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_sync_speaking BOOLEAN NOT NULL DEFAULT true,
  show_external_events BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(speaker_id, provider)
);

-- Add index for faster lookups
CREATE INDEX idx_calendar_connections_speaker ON public.calendar_connections(speaker_id);

-- Enable RLS
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only manage their own connections
CREATE POLICY "Users can view their own calendar connections"
ON public.calendar_connections FOR SELECT
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own calendar connections"
ON public.calendar_connections FOR INSERT
WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own calendar connections"
ON public.calendar_connections FOR UPDATE
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own calendar connections"
ON public.calendar_connections FOR DELETE
USING (auth.uid() = speaker_id);

-- Add sync_status column to speaker_calendar for tracking sync state
ALTER TABLE public.speaker_calendar 
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'local',
ADD COLUMN IF NOT EXISTS sync_error TEXT,
ADD COLUMN IF NOT EXISTS external_source TEXT;

-- Add trigger for updated_at
CREATE TRIGGER update_calendar_connections_updated_at
BEFORE UPDATE ON public.calendar_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment explaining the table
COMMENT ON TABLE public.calendar_connections IS 'Stores OAuth tokens for Google Calendar integration per user';