CREATE TABLE IF NOT EXISTS public.pitch_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opportunity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pitch_generation_log_user_created
  ON public.pitch_generation_log (user_id, created_at DESC);

GRANT SELECT ON public.pitch_generation_log TO authenticated;
GRANT ALL ON public.pitch_generation_log TO service_role;

ALTER TABLE public.pitch_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pitch generation log"
  ON public.pitch_generation_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);