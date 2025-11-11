-- Create scraping logs table
CREATE TABLE public.scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running',
  opportunities_found INTEGER DEFAULT 0,
  opportunities_inserted INTEGER DEFAULT 0,
  opportunities_updated INTEGER DEFAULT 0,
  error_message TEXT,
  last_page_scraped INTEGER
);

-- Enable RLS
ALTER TABLE public.scraping_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view scraping logs
CREATE POLICY "Admins can view scraping logs"
ON public.scraping_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add indexes for performance
CREATE INDEX idx_scraping_logs_source_started ON public.scraping_logs(source, started_at DESC);
CREATE INDEX idx_opportunities_url ON public.opportunities(event_url);
CREATE INDEX idx_opportunities_source_scraped ON public.opportunities(source, scraped_at DESC);
CREATE INDEX idx_opportunities_active_deadline ON public.opportunities(is_active, deadline) WHERE is_active = true;