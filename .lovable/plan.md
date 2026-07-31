# Deploy Box Office webhook + idempotency table

Both pieces already exist in the repo. This pass applies them to the live backend as-is.

## 1. Database
Apply the existing migration `supabase/migrations/20260731200000_boxoffice_events.sql` verbatim:
- Creates `boxoffice_events` (id, type, processed_at) as the idempotency ledger.
- RLS enabled with no policies — only the service role touches it, which is correct for a webhook ledger.

## 2. Edge function
Deploy `supabase/functions/boxoffice-webhook` using the committed code, no rewrite. It handles:
- `POST /boxoffice-webhook` — HMAC-signed engine events: `purchase.completed` (create account + Resend welcome/set-password email) and `access.revoked` (ban account, deferring future-dated cancellations).
- `POST /boxoffice-webhook/claim` — thank-you page flow: validates the session token with the engine, sets the buyer's password, returns a magiclink redirect.

`supabase/config.toml` already has `[functions.boxoffice-webhook] verify_jwt = false`, which the route-level HMAC/hook-secret auth requires. No config change needed.

## 3. Secrets
`RESEND_API_KEY` is already set. Missing and required before the function works:
- `BOXOFFICE_HOOK_SECRET` — shared with the engine's fulfillment webhook config (also used for the server-to-server claim call).

Optional overrides (defaults are hardcoded in the function, so only needed if they differ): `ENGINE_URL` (defaults to the Railway engine URL), `APP_URL` (defaults to `https://app.nextmic.ai`).

I'll request `BOXOFFICE_HOOK_SECRET` during implementation.

## 4. Verification
- Confirm the table exists after the migration runs.
- Confirm the function deploys and responds `401 bad signature` to an unsigned POST (proves routing + signature checks are live) and `400` to a claim call with no body.
- Report the webhook URL to register in the engine's fulfillment config.

No frontend changes.
