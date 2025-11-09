-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for application status
CREATE TYPE public.application_status AS ENUM ('applied', 'replied', 'booked', 'declined', 'pending');

-- Create enum for proficiency level
CREATE TYPE public.proficiency_level AS ENUM ('beginner', 'intermediate', 'expert');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  bio TEXT,
  fee_range_min NUMERIC DEFAULT 1000,
  fee_range_max NUMERIC DEFAULT 50000,
  past_talks TEXT[] DEFAULT '{}',
  linkedin_url TEXT,
  twitter_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create topics table
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on topics
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- RLS policies for topics (read-only for authenticated users)
CREATE POLICY "Authenticated users can view topics"
  ON public.topics FOR SELECT
  TO authenticated
  USING (true);

-- Create user_topics table
CREATE TABLE public.user_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  proficiency_level public.proficiency_level DEFAULT 'intermediate',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, topic_id)
);

-- Enable RLS on user_topics
ALTER TABLE public.user_topics ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_topics
CREATE POLICY "Users can view their own topics"
  ON public.user_topics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own topics"
  ON public.user_topics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own topics"
  ON public.user_topics FOR DELETE
  USING (auth.uid() = user_id);

-- Create opportunities table
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  organizer_name TEXT,
  organizer_email TEXT,
  description TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  fee_estimate_min NUMERIC,
  fee_estimate_max NUMERIC,
  event_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  audience_size INTEGER,
  event_url TEXT,
  source TEXT DEFAULT 'manual',
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on opportunities
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- RLS policies for opportunities
CREATE POLICY "Authenticated users can view active opportunities"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create opportunity_topics table
CREATE TABLE public.opportunity_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  relevance_score NUMERIC DEFAULT 1.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  UNIQUE(opportunity_id, topic_id)
);

-- Enable RLS on opportunity_topics
ALTER TABLE public.opportunity_topics ENABLE ROW LEVEL SECURITY;

-- RLS policies for opportunity_topics
CREATE POLICY "Authenticated users can view opportunity topics"
  ON public.opportunity_topics FOR SELECT
  TO authenticated
  USING (true);

-- Create opportunity_scores table
CREATE TABLE public.opportunity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  ai_score NUMERIC CHECK (ai_score >= 1 AND ai_score <= 100),
  ai_reason TEXT,
  topic_match_score NUMERIC,
  fee_alignment_score NUMERIC,
  deadline_urgency_score NUMERIC,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(opportunity_id, user_id)
);

-- Enable RLS on opportunity_scores
ALTER TABLE public.opportunity_scores ENABLE ROW LEVEL SECURITY;

-- RLS policies for opportunity_scores
CREATE POLICY "Users can view their own scores"
  ON public.opportunity_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scores"
  ON public.opportunity_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scores"
  ON public.opportunity_scores FOR UPDATE
  USING (auth.uid() = user_id);

-- Create pitches table
CREATE TABLE public.pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE NOT NULL,
  subject_line TEXT NOT NULL,
  email_body TEXT NOT NULL,
  tone TEXT DEFAULT 'professional',
  variant TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  edited BOOLEAN DEFAULT false
);

-- Enable RLS on pitches
ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;

-- RLS policies for pitches
CREATE POLICY "Users can view their own pitches"
  ON public.pitches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pitches"
  ON public.pitches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pitches"
  ON public.pitches FOR UPDATE
  USING (auth.uid() = user_id);

-- Create applied_logs table
CREATE TABLE public.applied_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  pitch_id UUID REFERENCES public.pitches(id) ON DELETE SET NULL,
  status public.application_status DEFAULT 'pending',
  notes TEXT
);

-- Enable RLS on applied_logs
ALTER TABLE public.applied_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for applied_logs
CREATE POLICY "Users can view their own applications"
  ON public.applied_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own applications"
  ON public.applied_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
  ON public.applied_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles (only admins can view)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to update profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert seed topics (30 common speaking topics)
INSERT INTO public.topics (name, category) VALUES
  ('Artificial Intelligence', 'Technology'),
  ('Machine Learning', 'Technology'),
  ('Leadership', 'Business'),
  ('Digital Marketing', 'Marketing'),
  ('Sales Strategy', 'Sales'),
  ('Productivity', 'Personal Development'),
  ('Blockchain', 'Technology'),
  ('Cybersecurity', 'Technology'),
  ('Remote Work', 'Business'),
  ('Diversity & Inclusion', 'Culture'),
  ('Customer Success', 'Business'),
  ('Entrepreneurship', 'Business'),
  ('SaaS', 'Technology'),
  ('Data Science', 'Technology'),
  ('Cloud Computing', 'Technology'),
  ('Innovation', 'Business'),
  ('Change Management', 'Business'),
  ('Team Building', 'Management'),
  ('Public Speaking', 'Personal Development'),
  ('Career Development', 'Personal Development'),
  ('Healthcare Tech', 'Industry'),
  ('Fintech', 'Industry'),
  ('E-commerce', 'Business'),
  ('Social Media', 'Marketing'),
  ('Content Marketing', 'Marketing'),
  ('SEO', 'Marketing'),
  ('Startup Growth', 'Business'),
  ('Product Management', 'Business'),
  ('Agile Methodology', 'Technology'),
  ('DevOps', 'Technology');

-- Insert seed opportunities (15 realistic examples)
INSERT INTO public.opportunities (event_name, organizer_name, organizer_email, description, deadline, fee_estimate_min, fee_estimate_max, event_date, location, audience_size, event_url, source, is_active) VALUES
  ('AI in Healthcare Summit 2025', 'MedTech Events', 'speakers@medtechevents.com', 'Annual summit exploring AI applications in healthcare. Looking for speakers with practical AI implementation experience in medical settings.', '2025-12-15 23:59:59', 5000, 10000, '2026-03-20 09:00:00', 'Austin, TX', 1200, 'https://aihealthcaresummit.com', 'eventbrite', true),
  ('SaaS Leadership Conference', 'SaaS Leaders', 'program@saasleaders.com', 'Three-day conference for SaaS executives. Seeking speakers on scaling, leadership, and building high-performing teams.', '2025-11-30 23:59:59', 8000, 15000, '2026-02-14 09:00:00', 'San Francisco, CA', 800, 'https://saasleadershipconf.com', 'twitter', true),
  ('Digital Marketing Expo', 'Marketing Pro Events', 'contact@marketingproevents.com', 'Large expo covering all aspects of digital marketing. Looking for case studies and tactical sessions.', '2025-12-01 23:59:59', 3000, 8000, '2026-03-05 10:00:00', 'New York, NY', 2000, 'https://digitalmarketingexpo.com', 'eventbrite', true),
  ('Women in Tech Symposium', 'Tech Diversity Group', 'speakers@techdiversity.org', 'Virtual symposium celebrating women in technology. Seeking diverse voices sharing career journeys and technical expertise.', '2025-11-20 23:59:59', 2000, 5000, '2026-01-28 10:00:00', 'Remote', 500, 'https://womenintechsymposium.com', 'sessionize', true),
  ('Startup Pitch Workshop', 'Boston Startup Hub', 'events@bostonstartup.com', 'Workshop helping early-stage founders refine their pitch. Need experienced entrepreneurs who have raised capital.', '2025-11-25 23:59:59', 1000, 3000, '2026-01-15 14:00:00', 'Boston, MA', 150, 'https://bostonstartup.com/pitch-workshop', 'manual', true),
  ('Cybersecurity Leadership Forum', 'InfoSec Institute', 'speakers@infosecinstitute.com', 'Executive forum on cybersecurity strategy and leadership. Looking for CISOs and security leaders.', '2025-12-10 23:59:59', 10000, 20000, '2026-04-10 09:00:00', 'Washington, DC', 600, 'https://cybersecurityforum.com', 'twitter', true),
  ('E-commerce Growth Summit', 'Commerce Events', 'team@commerceevents.com', 'Summit focused on scaling e-commerce businesses. Need speakers with proven growth tactics and case studies.', '2025-11-28 23:59:59', 4000, 9000, '2026-02-20 09:00:00', 'Los Angeles, CA', 1000, 'https://ecommercegrowthsummit.com', 'eventbrite', true),
  ('Remote Work Revolution', 'Future of Work Conference', 'speakers@futureofwork.com', 'Conference exploring the future of remote and hybrid work. Seeking innovative workplace leaders.', '2025-12-05 23:59:59', 3500, 7000, '2026-03-12 10:00:00', 'Denver, CO', 700, 'https://remoteworkrev.com', 'sessionize', true),
  ('Data Science Conference', 'Analytics Association', 'program@analyticsassoc.org', 'Technical conference for data scientists and ML engineers. Looking for hands-on technical talks with code examples.', '2025-11-22 23:59:59', 5000, 12000, '2026-02-28 09:00:00', 'Seattle, WA', 900, 'https://datascienceconf.org', 'eventbrite', true),
  ('Sales Excellence Summit', 'Sales Training Institute', 'events@salestraining.com', 'Summit for sales leaders and teams. Need speakers with modern sales methodologies and real results.', '2025-12-08 23:59:59', 6000, 12000, '2026-03-25 09:00:00', 'Chicago, IL', 1500, 'https://salesexcellencesummit.com', 'twitter', true),
  ('Innovation & Product Summit', 'Product Leaders Network', 'speakers@productleaders.net', 'Summit for product managers and innovators. Seeking speakers on product strategy, discovery, and design thinking.', '2025-11-18 23:59:59', 4500, 10000, '2026-01-30 09:00:00', 'Portland, OR', 650, 'https://innovationproductsummit.com', 'sessionize', true),
  ('Blockchain & Web3 Conference', 'Crypto Events Global', 'team@cryptoevents.com', 'Conference covering blockchain technology and Web3 applications. Need technical and business-focused speakers.', '2025-12-20 23:59:59', 7000, 15000, '2026-04-18 10:00:00', 'Miami, FL', 1100, 'https://blockchainweb3conf.com', 'twitter', true),
  ('Customer Success Summit', 'CS Leaders Forum', 'contact@csleaders.com', 'Summit for customer success professionals. Looking for speakers with innovative CS strategies and metrics.', '2025-11-27 23:59:59', 3000, 7000, '2026-02-10 09:00:00', 'Nashville, TN', 550, 'https://customersuccesssummit.com', 'eventbrite', true),
  ('Fintech Innovation Forum', 'Financial Tech Association', 'speakers@fintechassoc.org', 'Forum exploring fintech innovation and regulation. Need speakers from fintech companies and financial institutions.', '2025-12-12 23:59:59', 8000, 18000, '2026-04-05 09:00:00', 'New York, NY', 850, 'https://fintechinnovationforum.com', 'sessionize', true),
  ('DevOps & Cloud Summit', 'Tech Infrastructure Group', 'program@techinfra.com', 'Technical summit for DevOps engineers and cloud architects. Seeking deep technical talks on infrastructure and automation.', '2025-11-24 23:59:59', 5500, 11000, '2026-02-22 10:00:00', 'San Jose, CA', 750, 'https://devopscloudsummit.com', 'eventbrite', true);

-- Link opportunities to topics
INSERT INTO public.opportunity_topics (opportunity_id, topic_id, relevance_score)
SELECT 
  o.id,
  t.id,
  1.0
FROM public.opportunities o
CROSS JOIN public.topics t
WHERE 
  (o.event_name LIKE '%AI%' AND t.name IN ('Artificial Intelligence', 'Machine Learning', 'Healthcare Tech')) OR
  (o.event_name LIKE '%SaaS%' AND t.name IN ('SaaS', 'Leadership', 'Startup Growth')) OR
  (o.event_name LIKE '%Marketing%' AND t.name IN ('Digital Marketing', 'Content Marketing', 'SEO', 'Social Media')) OR
  (o.event_name LIKE '%Women in Tech%' AND t.name IN ('Diversity & Inclusion', 'Career Development', 'Leadership')) OR
  (o.event_name LIKE '%Startup%' AND t.name IN ('Entrepreneurship', 'Startup Growth', 'Public Speaking')) OR
  (o.event_name LIKE '%Cybersecurity%' AND t.name IN ('Cybersecurity', 'Leadership', 'Cloud Computing')) OR
  (o.event_name LIKE '%E-commerce%' AND t.name IN ('E-commerce', 'Digital Marketing', 'Sales Strategy')) OR
  (o.event_name LIKE '%Remote Work%' AND t.name IN ('Remote Work', 'Leadership', 'Change Management')) OR
  (o.event_name LIKE '%Data Science%' AND t.name IN ('Data Science', 'Machine Learning', 'Artificial Intelligence')) OR
  (o.event_name LIKE '%Sales%' AND t.name IN ('Sales Strategy', 'Leadership', 'Customer Success')) OR
  (o.event_name LIKE '%Product%' AND t.name IN ('Product Management', 'Innovation', 'Agile Methodology')) OR
  (o.event_name LIKE '%Blockchain%' AND t.name IN ('Blockchain', 'Innovation', 'Fintech')) OR
  (o.event_name LIKE '%Customer Success%' AND t.name IN ('Customer Success', 'Sales Strategy', 'Leadership')) OR
  (o.event_name LIKE '%Fintech%' AND t.name IN ('Fintech', 'Blockchain', 'Innovation')) OR
  (o.event_name LIKE '%DevOps%' AND t.name IN ('DevOps', 'Cloud Computing', 'Agile Methodology'));

-- Create indexes for performance
CREATE INDEX idx_opportunity_scores_user_score ON public.opportunity_scores(user_id, ai_score DESC);
CREATE INDEX idx_opportunities_deadline_active ON public.opportunities(deadline, is_active);
CREATE INDEX idx_applied_logs_user_opportunity ON public.applied_logs(user_id, opportunity_id);
CREATE INDEX idx_user_topics_user ON public.user_topics(user_id);
CREATE INDEX idx_opportunity_topics_opportunity ON public.opportunity_topics(opportunity_id);