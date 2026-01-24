-- ============================================================
-- SECURITY DOCUMENTATION FOR PUBLIC-FACING TABLES
-- These tables intentionally allow public INSERT for specific use cases
-- with abuse prevention enforced at the edge function level
-- ============================================================

-- package_views: Anonymous tracking for speaker package analytics
-- INTENTIONALLY PERMISSIVE: External visitors viewing speaker packages
-- must be logged without authentication. Rate limiting is enforced
-- at the edge function level (100 views/IP/hour).
COMMENT ON TABLE public.package_views IS 
  'Analytics tracking for speaker package views. INSERT is intentionally public to track anonymous visitors. Security controls: Rate limiting (100/IP/hour), package existence validation, and expiration checks enforced in track-package-view edge function.';

-- inbound_leads: Public lead capture from embed widget  
-- INTENTIONALLY PERMISSIVE: The embed widget on external websites
-- must accept leads from anonymous visitors. Abuse prevention includes:
-- - Rate limiting: 5 submissions/IP/day
-- - Email validation with regex
-- - Input sanitization (HTML stripping)
-- - Spam pattern detection
-- - Speaker existence validation
COMMENT ON TABLE public.inbound_leads IS 
  'Inbound leads from public embed widget. INSERT is intentionally public for anonymous visitors. Security controls: Rate limiting (5/IP/day), email validation, input sanitization, spam detection, and speaker verification enforced in submit-lead edge function.';