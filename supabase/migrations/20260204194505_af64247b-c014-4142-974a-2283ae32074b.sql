-- Insert new topics organized by category
-- First update existing topics to have proper categories
UPDATE public.topics SET category = 'Technology & Business' WHERE category IS NULL;

-- Wellness & Personal Development
INSERT INTO public.topics (name, category) VALUES
  ('Wellness', 'Wellness & Personal Development'),
  ('Mindfulness', 'Wellness & Personal Development'),
  ('Motivation', 'Wellness & Personal Development'),
  ('Self-Worth', 'Wellness & Personal Development'),
  ('Self-Awareness', 'Wellness & Personal Development'),
  ('Mental Health', 'Wellness & Personal Development'),
  ('Work-Life Balance', 'Wellness & Personal Development'),
  ('Stress Management', 'Wellness & Personal Development'),
  ('Personal Growth', 'Wellness & Personal Development'),
  ('Resilience', 'Wellness & Personal Development')
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category;

-- Industry Verticals
INSERT INTO public.topics (name, category) VALUES
  ('Healthcare', 'Industry Verticals'),
  ('Education', 'Industry Verticals'),
  ('Higher Education', 'Industry Verticals'),
  ('Faith-Based / Spiritual', 'Industry Verticals'),
  ('Nonprofit / Social Impact', 'Industry Verticals'),
  ('Government / Public Sector', 'Industry Verticals'),
  ('Manufacturing', 'Industry Verticals'),
  ('Real Estate', 'Industry Verticals'),
  ('Legal', 'Industry Verticals'),
  ('Financial Services', 'Industry Verticals')
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category;

-- Audience-Specific
INSERT INTO public.topics (name, category) VALUES
  ('Youth Speaker / Gen Z', 'Audience-Specific'),
  ('Men''s Events', 'Audience-Specific'),
  ('Women''s Events', 'Audience-Specific'),
  ('Parents & Families', 'Audience-Specific'),
  ('Seniors / Retirement', 'Audience-Specific'),
  ('Veterans / Military', 'Audience-Specific'),
  ('LGBTQ+', 'Audience-Specific'),
  ('First-Generation Professionals', 'Audience-Specific')
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category;

-- Professional Skills
INSERT INTO public.topics (name, category) VALUES
  ('Communication Skills', 'Professional Skills'),
  ('Conflict Resolution', 'Professional Skills'),
  ('Negotiation', 'Professional Skills'),
  ('Networking', 'Professional Skills'),
  ('Personal Branding', 'Professional Skills'),
  ('Executive Presence', 'Professional Skills'),
  ('Emotional Intelligence', 'Professional Skills'),
  ('Storytelling', 'Professional Skills'),
  ('Time Management', 'Professional Skills'),
  ('Goal Setting', 'Professional Skills')
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category;

-- Social & Cultural
INSERT INTO public.topics (name, category) VALUES
  ('Community Building', 'Social & Cultural'),
  ('Social Justice', 'Social & Cultural'),
  ('Environmental / Sustainability', 'Social & Cultural'),
  ('Future of Work', 'Social & Cultural'),
  ('Generational Differences', 'Social & Cultural'),
  ('Cultural Competency', 'Social & Cultural')
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category;

-- Add unique constraint on name if not exists (for ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'topics_name_key'
  ) THEN
    ALTER TABLE public.topics ADD CONSTRAINT topics_name_key UNIQUE (name);
  END IF;
END $$;

-- Add custom_topics column to profiles for user-created topics
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_topics TEXT[] DEFAULT '{}';