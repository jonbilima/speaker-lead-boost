CREATE TABLE IF NOT EXISTS public.user_verticals_backup_20260818 AS SELECT * FROM public.user_verticals;
ALTER TABLE public.user_verticals_backup_20260818 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_verticals_backup_20260818 TO service_role;

ALTER TABLE public.user_verticals
  ADD COLUMN IF NOT EXISTS is_inferred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;