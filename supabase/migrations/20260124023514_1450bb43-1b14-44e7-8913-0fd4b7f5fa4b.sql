-- Create waitlist table for landing page signups
CREATE TABLE public.waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'landing_page',
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT (public signups)
-- Security note: Rate limiting should be applied at application level
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist
  FOR INSERT
  WITH CHECK (true);

-- Only admins can view waitlist
CREATE POLICY "Admins can view waitlist"
  ON public.waitlist
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Only admins can update waitlist
CREATE POLICY "Admins can update waitlist"
  ON public.waitlist
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Only admins can delete from waitlist
CREATE POLICY "Admins can delete from waitlist"
  ON public.waitlist
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Add index for faster lookups
CREATE INDEX idx_waitlist_email ON public.waitlist(email);
CREATE INDEX idx_waitlist_referral_code ON public.waitlist(referral_code);

-- Add comment documenting the intentional public INSERT
COMMENT ON TABLE public.waitlist IS 
  'Email waitlist for product launch. INSERT is intentionally public for anonymous signups. Rate limiting should be applied at application level.';