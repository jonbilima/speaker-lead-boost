-- =====================================================
-- SECURITY FIX: Update RLS policies for 3 tables
-- Change from USING (true) to require authentication
-- =====================================================

-- 1. FEE_BENCHMARKS: Restrict to authenticated users only
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view topics" ON public.fee_benchmarks;
DROP POLICY IF EXISTS "Authenticated users can view benchmarks" ON public.fee_benchmarks;

-- Create new restrictive policy
CREATE POLICY "Authenticated users can view fee benchmarks"
ON public.fee_benchmarks
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Add comment explaining the policy
COMMENT ON TABLE public.fee_benchmarks IS 'Fee benchmark data for speaker pricing intelligence. Access restricted to authenticated users only.';

-- 2. OPPORTUNITY_TOPICS: Restrict to authenticated users only
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view opportunity topics" ON public.opportunity_topics;

-- Create new restrictive policy
CREATE POLICY "Authenticated users can view opportunity topics"
ON public.opportunity_topics
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Add comment explaining the policy
COMMENT ON TABLE public.opportunity_topics IS 'Links opportunities to topics. Access restricted to authenticated users only.';

-- 3. SPEAKER_BOOKINGS: Restrict to authenticated users only
-- Keep readable by all authenticated users for market intelligence
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view bookings" ON public.speaker_bookings;

-- Create new restrictive policy
CREATE POLICY "Authenticated users can view speaker bookings"
ON public.speaker_bookings
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Add comment explaining the policy
COMMENT ON TABLE public.speaker_bookings IS 'Public speaker booking records for market intelligence. Readable by all authenticated users to support competitive analysis features.';

-- =====================================================
-- ADD COMMENTS TO INTENTIONALLY PUBLIC TABLES
-- Documenting why these tables have public access
-- =====================================================

-- 4. APPLICATION_PACKAGES: Public for shareable package viewing
COMMENT ON TABLE public.application_packages IS 'Speaker application packages. SELECT is public to allow organizers to view shared packages via tracking links without authentication.';

-- 5. PACKAGE_VIEWS: Public for anonymous tracking
COMMENT ON TABLE public.package_views IS 'Analytics tracking for package views. INSERT is public to allow anonymous tracking when organizers view packages. Rate limited via edge function (100/IP/hour).';

-- 6. INBOUND_LEADS: Public for embed widget submissions
COMMENT ON TABLE public.inbound_leads IS 'Inbound inquiry leads from embed widgets. INSERT is public to allow anonymous submissions from speaker websites. Rate limited via edge function (5/IP/24hrs) with spam detection.';

-- 7. TOPICS: Public reference data
COMMENT ON TABLE public.topics IS 'Reference data for speaking topics/categories. SELECT is public as this is non-sensitive reference data needed for opportunity matching.';