CREATE TABLE IF NOT EXISTS public.opportunity_topics_backup_20260818 AS
SELECT * FROM public.opportunity_topics;

WITH alias(kw, topic) AS (VALUES
 ('artificial intelligence','Artificial Intelligence'),('genai','Artificial Intelligence'),('ai/ml','Artificial Intelligence'),('ai summit','Artificial Intelligence'),
 ('machine learning','Machine Learning'),
 ('devops','DevOps'),
 ('cloud','Cloud Computing'),('aws','Cloud Computing'),('serverless','Cloud Computing'),('kubernetes','Cloud Computing'),('containers','Cloud Computing'),
 ('cybersecurity','Cybersecurity'),
 ('data','Data Science'),
 ('leadership','Leadership'),
 ('executive','Executive Presence'),
 ('sales','Sales Strategy'),
 ('marketing','Digital Marketing'),
 ('church','Faith-Based / Spiritual'),('ministry','Faith-Based / Spiritual'),('faith','Faith-Based / Spiritual'),
 ('medical','Healthcare'),('healthcare','Healthcare'),
 ('finance','Financial Services'),('financial','Financial Services'),('accounting','Financial Services'),
 ('diversity','Diversity & Inclusion'),('inclusion','Diversity & Inclusion'),
 ('higher education','Higher Education'),('education','Education'),('k-12','Education'),
 ('property management','Real Estate'),('real estate','Real Estate'),
 ('workplace culture','Team Building'),
 ('nonprofit','Nonprofit / Social Impact'),('association','Nonprofit / Social Impact'),
 ('startup','Startup Growth'),('entrepreneur','Entrepreneurship'),('innovation','Innovation'),
 ('product management','Product Management'),('agile','Agile Methodology'),('blockchain','Blockchain'),
 ('fintech','Fintech'),('e-commerce','E-commerce'),('ecommerce','E-commerce'),('saas','SaaS'),
 ('remote work','Remote Work'),('mental health','Mental Health'),('wellness','Wellness'),
 ('public speaking','Public Speaking'),('storytelling','Storytelling'),('manufacturing','Manufacturing'),
 ('government','Government / Public Sector'),('public sector','Government / Public Sector'),
 ('performance','Productivity'),('networking','Networking'),('resilience','Resilience'),('motivation','Motivation')
),
src AS (
  SELECT id, lower(trim(raw_data->>'topic_or_industry')) AS val
  FROM public.opportunities
  WHERE nullif(trim(raw_data->>'topic_or_industry'),'') IS NOT NULL
)
INSERT INTO public.opportunity_topics (opportunity_id, topic_id)
SELECT DISTINCT s.id, t.id
FROM src s
JOIN alias a ON s.val LIKE '%' || a.kw || '%'
JOIN public.topics t ON t.name = a.topic
ON CONFLICT (opportunity_id, topic_id) DO NOTHING;