
-- =============================================
-- PHASE 1: CREATE NEW ENUMS
-- =============================================

-- Pipeline stages for opportunity tracking
CREATE TYPE public.pipeline_stage AS ENUM (
  'new', 'researching', 'interested', 'pitched', 
  'negotiating', 'accepted', 'rejected', 'completed'
);

-- Activity types for outreach tracking
CREATE TYPE public.activity_type AS ENUM (
  'email_sent', 'email_received', 'call', 'meeting', 
  'note', 'follow_up', 'social_interaction'
);

-- Asset types for speaker materials
CREATE TYPE public.asset_type AS ENUM (
  'headshot', 'speaker_reel', 'one_sheet', 'slide_deck', 
  'video', 'audio', 'document', 'other'
);

-- Calendar entry types
CREATE TYPE public.calendar_entry_type AS ENUM (
  'speaking_engagement', 'travel', 'prep', 'meeting', 
  'follow_up', 'blocked', 'other'
);

-- Organization types for organizers
CREATE TYPE public.organization_type AS ENUM (
  'conference', 'corporate', 'association', 'university', 
  'nonprofit', 'government', 'media', 'other'
);

-- Experience levels for fee benchmarks
CREATE TYPE public.experience_level AS ENUM (
  'emerging', 'established', 'professional', 'celebrity'
);

-- Event types for fee benchmarks
CREATE TYPE public.event_type AS ENUM (
  'conference', 'corporate_keynote', 'workshop', 'webinar', 
  'panel', 'podcast', 'training', 'other'
);

-- =============================================
-- PHASE 2: UPDATE EXISTING TABLES
-- =============================================

-- 2A. Update profiles table (speaker_profiles)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS industries text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS audience_types text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_speaking integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_talks_given integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notable_clients text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS speaker_reel_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS one_sheet_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_country text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS willing_to_travel boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS travel_regions text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_digest boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_slug ON public.profiles(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_public ON public.profiles(is_public) WHERE is_public = true;

-- 2B. Update opportunities table (events)
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS organizer_linkedin text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS organizer_phone text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS organization_website text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS event_end_date timestamp with time zone;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS location_venue text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS seniority_level text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS covers_travel boolean;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS covers_accommodation boolean;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS raw_data jsonb;

CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON public.opportunities(deadline) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_opportunities_event_date ON public.opportunities(event_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_featured ON public.opportunities(is_featured) WHERE is_featured = true;

-- 2C. Update opportunity_scores table (opportunity_matches)
ALTER TABLE public.opportunity_scores ADD COLUMN IF NOT EXISTS pipeline_stage public.pipeline_stage DEFAULT 'new';
ALTER TABLE public.opportunity_scores ADD COLUMN IF NOT EXISTS viewed_at timestamp with time zone;
ALTER TABLE public.opportunity_scores ADD COLUMN IF NOT EXISTS interested_at timestamp with time zone;
ALTER TABLE public.opportunity_scores ADD COLUMN IF NOT EXISTS response_received_at timestamp with time zone;
ALTER TABLE public.opportunity_scores ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone;
ALTER TABLE public.opportunity_scores ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;
ALTER TABLE public.opportunity_scores ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
ALTER TABLE public.opportunity_scores ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_opportunity_scores_pipeline ON public.opportunity_scores(user_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_opportunity_scores_user_score ON public.opportunity_scores(user_id, ai_score DESC);

-- =============================================
-- PHASE 3: CREATE NEW TABLES
-- =============================================

-- 3A. past_talks table
CREATE TABLE public.past_talks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_name text,
  event_date date,
  audience_size integer,
  video_url text,
  slides_url text,
  testimonial text,
  testimonial_author text,
  testimonial_role text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.past_talks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own past talks"
  ON public.past_talks FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own past talks"
  ON public.past_talks FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own past talks"
  ON public.past_talks FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own past talks"
  ON public.past_talks FOR DELETE
  USING (auth.uid() = speaker_id);

CREATE INDEX idx_past_talks_speaker ON public.past_talks(speaker_id);

-- 3B. outreach_activities table
CREATE TABLE public.outreach_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.opportunity_scores(id) ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type public.activity_type NOT NULL,
  subject text,
  body text,
  notes text,
  email_message_id text,
  email_sent_at timestamp with time zone,
  email_opened_at timestamp with time zone,
  email_clicked_at timestamp with time zone,
  email_replied_at timestamp with time zone,
  follow_up_date date,
  follow_up_completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities"
  ON public.outreach_activities FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own activities"
  ON public.outreach_activities FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own activities"
  ON public.outreach_activities FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own activities"
  ON public.outreach_activities FOR DELETE
  USING (auth.uid() = speaker_id);

CREATE INDEX idx_outreach_speaker ON public.outreach_activities(speaker_id);
CREATE INDEX idx_outreach_match ON public.outreach_activities(match_id);
CREATE INDEX idx_outreach_follow_up ON public.outreach_activities(follow_up_date) WHERE follow_up_completed = false;

-- 3C. speaker_assets table
CREATE TABLE public.speaker_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_type public.asset_type NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  title text,
  description text,
  is_primary boolean DEFAULT false,
  view_count integer DEFAULT 0,
  download_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.speaker_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets"
  ON public.speaker_assets FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own assets"
  ON public.speaker_assets FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own assets"
  ON public.speaker_assets FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own assets"
  ON public.speaker_assets FOR DELETE
  USING (auth.uid() = speaker_id);

CREATE INDEX idx_assets_speaker ON public.speaker_assets(speaker_id);
CREATE INDEX idx_assets_type ON public.speaker_assets(speaker_id, asset_type);

-- 3D. speaker_calendar table
CREATE TABLE public.speaker_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  match_id uuid REFERENCES public.opportunity_scores(id) ON DELETE SET NULL,
  title text NOT NULL,
  entry_type public.calendar_entry_type NOT NULL DEFAULT 'speaking_engagement',
  start_date date NOT NULL,
  end_date date,
  start_time time,
  end_time time,
  all_day boolean DEFAULT false,
  location text,
  is_virtual boolean DEFAULT false,
  meeting_url text,
  google_calendar_id text,
  reminder_days_before integer DEFAULT 7,
  color text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.speaker_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar"
  ON public.speaker_calendar FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own calendar entries"
  ON public.speaker_calendar FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own calendar entries"
  ON public.speaker_calendar FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own calendar entries"
  ON public.speaker_calendar FOR DELETE
  USING (auth.uid() = speaker_id);

CREATE INDEX idx_calendar_speaker ON public.speaker_calendar(speaker_id);
CREATE INDEX idx_calendar_dates ON public.speaker_calendar(speaker_id, start_date, end_date);

-- 3E. organizers table (shared CRM)
CREATE TABLE public.organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  linkedin_url text,
  phone text,
  organization_name text,
  organization_website text,
  organization_type public.organization_type,
  events_organized integer DEFAULT 0,
  speakers_booked_last_year integer,
  last_booking_date date,
  topics text[] DEFAULT '{}',
  typical_fee_min numeric,
  typical_fee_max numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view organizers"
  ON public.organizers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert organizers"
  ON public.organizers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update organizers"
  ON public.organizers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete organizers"
  ON public.organizers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_organizers_email ON public.organizers(email);
CREATE INDEX idx_organizers_org ON public.organizers(organization_name);

-- 3F. speaker_bookings table (competitive intelligence)
CREATE TABLE public.speaker_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_name text NOT NULL,
  speaker_linkedin text,
  speaker_website text,
  speaker_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  organizer_name text,
  organization_name text,
  booking_announced_date date,
  event_date date,
  source_url text,
  source_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.speaker_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bookings"
  ON public.speaker_bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert bookings"
  ON public.speaker_bookings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bookings"
  ON public.speaker_bookings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_bookings_speaker ON public.speaker_bookings(speaker_name);
CREATE INDEX idx_bookings_event ON public.speaker_bookings(event_name);
CREATE INDEX idx_bookings_date ON public.speaker_bookings(event_date);

-- 3G. fee_benchmarks table (market data)
CREATE TABLE public.fee_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_level public.experience_level NOT NULL,
  topic_category text,
  event_type public.event_type NOT NULL,
  region text,
  audience_size_bucket text,
  fee_p25 numeric,
  fee_median numeric,
  fee_p75 numeric,
  fee_p90 numeric,
  data_points integer DEFAULT 0,
  last_updated timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view benchmarks"
  ON public.fee_benchmarks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert benchmarks"
  ON public.fee_benchmarks FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update benchmarks"
  ON public.fee_benchmarks FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_benchmarks_lookup ON public.fee_benchmarks(experience_level, event_type, topic_category);
