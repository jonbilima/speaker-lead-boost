-- Per-email throttle ledger for the custom auth-email function.
-- Service-role only; no client access.
CREATE TABLE public.auth_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_email_log_email_time ON public.auth_email_log (email, created_at DESC);
ALTER TABLE public.auth_email_log ENABLE ROW LEVEL SECURITY;