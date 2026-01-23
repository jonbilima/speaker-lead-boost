-- Create watched_speakers table
CREATE TABLE public.watched_speakers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  watched_name TEXT NOT NULL,
  watched_linkedin_url TEXT,
  watched_website TEXT,
  watched_topics TEXT[] DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create watched_speaker_bookings table
CREATE TABLE public.watched_speaker_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  watched_speaker_id UUID NOT NULL REFERENCES public.watched_speakers(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  organization_name TEXT,
  event_date DATE,
  source_url TEXT,
  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.watched_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watched_speaker_bookings ENABLE ROW LEVEL SECURITY;

-- RLS policies for watched_speakers
CREATE POLICY "Users can view their own watched speakers"
  ON public.watched_speakers FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own watched speakers"
  ON public.watched_speakers FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own watched speakers"
  ON public.watched_speakers FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own watched speakers"
  ON public.watched_speakers FOR DELETE
  USING (auth.uid() = speaker_id);

-- RLS policies for watched_speaker_bookings
CREATE POLICY "Users can view bookings for their watched speakers"
  ON public.watched_speaker_bookings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.watched_speakers ws
    WHERE ws.id = watched_speaker_id AND ws.speaker_id = auth.uid()
  ));

CREATE POLICY "Users can insert bookings for their watched speakers"
  ON public.watched_speaker_bookings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.watched_speakers ws
    WHERE ws.id = watched_speaker_id AND ws.speaker_id = auth.uid()
  ));

CREATE POLICY "Users can update bookings for their watched speakers"
  ON public.watched_speaker_bookings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.watched_speakers ws
    WHERE ws.id = watched_speaker_id AND ws.speaker_id = auth.uid()
  ));

CREATE POLICY "Users can delete bookings for their watched speakers"
  ON public.watched_speaker_bookings FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.watched_speakers ws
    WHERE ws.id = watched_speaker_id AND ws.speaker_id = auth.uid()
  ));