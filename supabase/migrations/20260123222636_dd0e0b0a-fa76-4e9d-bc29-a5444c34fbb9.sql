-- Enable pg_cron and pg_net extensions for scheduled scraping
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Allow manual opportunity submissions (update RLS policy)
-- First drop the existing policy if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can submit manual opportunities') THEN
        DROP POLICY "Users can submit manual opportunities" ON public.opportunities;
    END IF;
END $$;

-- Create policy for authenticated users to insert manual opportunities
CREATE POLICY "Users can submit manual opportunities"
ON public.opportunities
FOR INSERT
WITH CHECK (source = 'manual' AND is_verified = false);

-- Add a status column update check for partial scrapes
-- The scraping_logs table already exists, no changes needed

-- Note: The actual cron.schedule calls need to be run separately with INSERT