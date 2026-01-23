-- Create application_packages table
CREATE TABLE public.application_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.opportunity_scores(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  tracking_code TEXT NOT NULL UNIQUE,
  package_title TEXT NOT NULL,
  cover_message TEXT,
  included_assets UUID[] DEFAULT '{}',
  include_bio BOOLEAN DEFAULT true,
  include_headshot BOOLEAN DEFAULT true,
  include_one_sheet BOOLEAN DEFAULT false,
  include_video BOOLEAN DEFAULT false,
  custom_note TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create package_views table
CREATE TABLE public.package_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.application_packages(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('opened', 'bio_viewed', 'headshot_downloaded', 'one_sheet_downloaded', 'video_played', 'contact_clicked')),
  viewer_ip TEXT,
  viewer_country TEXT,
  viewer_city TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on tracking_code for fast lookups
CREATE INDEX idx_packages_tracking_code ON public.application_packages(tracking_code);
CREATE INDEX idx_package_views_package_id ON public.package_views(package_id);
CREATE INDEX idx_packages_speaker_id ON public.application_packages(speaker_id);

-- Enable RLS
ALTER TABLE public.application_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_views ENABLE ROW LEVEL SECURITY;

-- RLS policies for application_packages
CREATE POLICY "Users can view their own packages" 
ON public.application_packages 
FOR SELECT 
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own packages" 
ON public.application_packages 
FOR INSERT 
WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own packages" 
ON public.application_packages 
FOR UPDATE 
USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own packages" 
ON public.application_packages 
FOR DELETE 
USING (auth.uid() = speaker_id);

-- Public can view packages by tracking code (for the public page)
CREATE POLICY "Public can view packages by tracking code" 
ON public.application_packages 
FOR SELECT 
USING (true);

-- RLS policies for package_views - speakers can view their package stats
CREATE POLICY "Users can view their package views" 
ON public.package_views 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.application_packages 
    WHERE application_packages.id = package_views.package_id 
    AND application_packages.speaker_id = auth.uid()
  )
);

-- Anyone can insert package views (tracking)
CREATE POLICY "Anyone can insert package views" 
ON public.package_views 
FOR INSERT 
WITH CHECK (true);