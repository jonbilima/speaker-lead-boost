-- Create inbound_leads table
CREATE TABLE public.inbound_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  event_name TEXT,
  event_date DATE,
  event_type TEXT,
  estimated_audience TEXT,
  budget_range TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'widget',
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inbound_leads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own leads
CREATE POLICY "Users can view their own leads"
  ON public.inbound_leads
  FOR SELECT
  USING (auth.uid() = speaker_id);

-- Policy: Users can update their own leads
CREATE POLICY "Users can update their own leads"
  ON public.inbound_leads
  FOR UPDATE
  USING (auth.uid() = speaker_id);

-- Policy: Users can delete their own leads
CREATE POLICY "Users can delete their own leads"
  ON public.inbound_leads
  FOR DELETE
  USING (auth.uid() = speaker_id);

-- Policy: Anyone can insert leads (for public widget)
CREATE POLICY "Anyone can insert leads"
  ON public.inbound_leads
  FOR INSERT
  WITH CHECK (true);

-- Policy: Public can view speaker profiles for widget
CREATE POLICY "Public can view public profiles"
  ON public.profiles
  FOR SELECT
  USING (is_public = true);

-- Add widget_settings column to profiles for customization
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS widget_settings JSONB DEFAULT '{"primary_color": "#8B5CF6", "show_photo": true, "show_topics": true, "show_availability": true}'::jsonb;