-- Consolidate categories to match the 6 main categories
UPDATE public.topics 
SET category = 'Technology & Business' 
WHERE category IN ('Technology', 'Business', 'Industry', 'Marketing', 'Sales', 'Management', 'Culture');

-- Update Personal Development to Wellness category for consistency
UPDATE public.topics 
SET category = 'Wellness & Personal Development' 
WHERE category = 'Personal Development' AND name NOT IN ('Career Development', 'Public Speaking');

-- Move Career Development to Professional Skills
UPDATE public.topics 
SET category = 'Professional Skills' 
WHERE name = 'Career Development';

-- Move Public Speaking to Professional Skills
UPDATE public.topics 
SET category = 'Professional Skills' 
WHERE name = 'Public Speaking';

-- Move Productivity to Professional Skills
UPDATE public.topics 
SET category = 'Professional Skills' 
WHERE name = 'Productivity';

-- Insert any missing topics (will skip if already exists due to unique constraint)

-- Wellness & Personal Development (check for any missing)
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

-- Industry Verticals (check for any missing)
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
  ('Veterans / Military', 'Audience-Specific')
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
  ('Goal Setting', 'Professional Skills'),
  ('Productivity', 'Professional Skills'),
  ('Career Development', 'Professional Skills'),
  ('Public Speaking', 'Professional Skills')
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category;

-- Social & Cultural
INSERT INTO public.topics (name, category) VALUES
  ('Community Building', 'Social & Cultural'),
  ('Social Justice', 'Social & Cultural'),
  ('Environmental / Sustainability', 'Social & Cultural'),
  ('Future of Work', 'Social & Cultural'),
  ('Generational Differences', 'Social & Cultural'),
  ('Cultural Competency', 'Social & Cultural'),
  ('Diversity & Inclusion', 'Social & Cultural')
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category;