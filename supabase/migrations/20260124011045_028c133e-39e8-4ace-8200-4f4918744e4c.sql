-- Create event_feedback table
CREATE TABLE public.event_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  booking_id UUID REFERENCES public.confirmed_bookings(id),
  event_name TEXT NOT NULL,
  event_date DATE,
  feedback_token TEXT UNIQUE NOT NULL,
  respondent_name TEXT,
  respondent_email TEXT,
  respondent_role TEXT DEFAULT 'organizer',
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  content_rating INTEGER CHECK (content_rating >= 1 AND content_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  engagement_rating INTEGER CHECK (engagement_rating >= 1 AND engagement_rating <= 5),
  would_recommend BOOLEAN,
  what_worked_well TEXT,
  what_to_improve TEXT,
  testimonial_quote TEXT,
  can_use_as_testimonial BOOLEAN DEFAULT false,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create performance_metrics table
CREATE TABLE public.performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  booking_id UUID REFERENCES public.confirmed_bookings(id),
  audience_size_actual INTEGER,
  engagement_score INTEGER CHECK (engagement_score >= 1 AND engagement_score <= 10),
  standing_ovation BOOLEAN DEFAULT false,
  qa_questions_count INTEGER DEFAULT 0,
  social_mentions INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  products_sold INTEGER DEFAULT 0,
  speaker_notes TEXT,
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
  audience_responsiveness INTEGER CHECK (audience_responsiveness >= 1 AND audience_responsiveness <= 5),
  what_went_well TEXT,
  what_to_improve TEXT,
  notes_for_next_time TEXT,
  personal_learnings TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback_requests table
CREATE TABLE public.feedback_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  booking_id UUID REFERENCES public.confirmed_bookings(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  token TEXT UNIQUE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_requests ENABLE ROW LEVEL SECURITY;

-- Event feedback policies
CREATE POLICY "Users can view their own feedback"
  ON public.event_feedback FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.event_feedback FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own feedback"
  ON public.event_feedback FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Public can view feedback by token"
  ON public.event_feedback FOR SELECT
  USING (feedback_token IS NOT NULL);

CREATE POLICY "Public can submit feedback via token"
  ON public.event_feedback FOR UPDATE
  USING (feedback_token IS NOT NULL);

-- Performance metrics policies
CREATE POLICY "Users can view their own metrics"
  ON public.performance_metrics FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own metrics"
  ON public.performance_metrics FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own metrics"
  ON public.performance_metrics FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own metrics"
  ON public.performance_metrics FOR DELETE
  USING (auth.uid() = speaker_id);

-- Feedback requests policies
CREATE POLICY "Users can view their own requests"
  ON public.feedback_requests FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own requests"
  ON public.feedback_requests FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own requests"
  ON public.feedback_requests FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own requests"
  ON public.feedback_requests FOR DELETE
  USING (auth.uid() = speaker_id);

-- Function to get public feedback by token
CREATE OR REPLACE FUNCTION public.get_feedback_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  speaker_id UUID,
  event_name TEXT,
  event_date DATE,
  feedback_token TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  speaker_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ef.id, 
    ef.speaker_id, 
    ef.event_name, 
    ef.event_date, 
    ef.feedback_token,
    ef.submitted_at,
    p.name as speaker_name
  FROM event_feedback ef
  JOIN profiles p ON p.id = ef.speaker_id
  WHERE ef.feedback_token = p_token;
$$;