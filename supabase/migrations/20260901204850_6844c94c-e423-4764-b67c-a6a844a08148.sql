ALTER TABLE public.application_packages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS emailed_to text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

ALTER TABLE public.application_packages
  DROP CONSTRAINT IF EXISTS application_packages_status_check;

ALTER TABLE public.application_packages
  ADD CONSTRAINT application_packages_status_check
  CHECK (status IN ('created','emailed','shared'));

UPDATE public.application_packages SET status = 'created' WHERE status IS DISTINCT FROM 'created';