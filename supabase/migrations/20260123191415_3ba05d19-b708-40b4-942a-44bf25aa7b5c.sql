-- Create testimonials table
CREATE TABLE public.testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_title TEXT,
  author_company TEXT,
  author_email TEXT,
  author_photo_url TEXT,
  event_name TEXT,
  event_date DATE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_featured BOOLEAN DEFAULT false,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'requested', 'imported')),
  request_token TEXT UNIQUE,
  request_sent_at TIMESTAMP WITH TIME ZONE,
  request_opened_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- RLS policies for speakers to manage their own testimonials
CREATE POLICY "Users can view their own testimonials"
  ON public.testimonials FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own testimonials"
  ON public.testimonials FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own testimonials"
  ON public.testimonials FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own testimonials"
  ON public.testimonials FOR DELETE
  USING (auth.uid() = speaker_id);

-- Policy for public testimonial submission via token
CREATE POLICY "Anyone can view testimonials by token"
  ON public.testimonials FOR SELECT
  USING (request_token IS NOT NULL);

-- Policy to allow anonymous updates for testimonial submission
CREATE POLICY "Anyone can submit testimonial via token"
  ON public.testimonials FOR UPDATE
  USING (request_token IS NOT NULL AND quote IS NULL)
  WITH CHECK (request_token IS NOT NULL);

-- Create index for token lookups
CREATE INDEX idx_testimonials_request_token ON public.testimonials(request_token) WHERE request_token IS NOT NULL;

-- Create index for featured testimonials
CREATE INDEX idx_testimonials_featured ON public.testimonials(speaker_id, is_featured) WHERE is_featured = true;