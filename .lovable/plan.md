# Repair password recovery end to end

## Diagnosis

The reset inputs are disabled by `loading || !ready`. `ready` only changes after a `PASSWORD_RECOVERY`/`SIGNED_IN` event or an existing session is found. There is no finite verification state or error state, so a rejected, consumed, or missed recovery token leaves the page permanently disabled.

The current email links directly to the authentication `/verify` endpoint. Recent logs show the generated recovery token reaching that endpoint and then being rejected as `One-time token not found`, so the page opens without the temporary recovery session it requires. The page also does not process a recovery `token_hash` itself or display URL/session errors.

## Changes

1. **Make token exchange explicit and reliable**
   - Change recovery emails to point to the app’s reset page with the generated recovery token hash, instead of sending users through a directly consumable verification link.
   - On `/reset-password`, validate that token with the backend and establish the recovery session before enabling password fields.
   - Preserve compatibility with existing recovery links that arrive with a valid session or legacy hash.

2. **Replace the permanent disabled state**
   - Add a visible “Verifying reset link…” state while validation runs.
   - Enable the form only after a valid recovery session is confirmed.
   - Show a clear expired/used-link message and a route back to request a new link when validation fails.
   - Prevent ordinary signed-in sessions from being mistaken for verified password-recovery sessions.

3. **Verify the complete customer path**
   - Deploy the updated auth email function.
   - Request a fresh reset for a controlled account, open the exact generated link in a clean browser session, confirm the fields enable, enter and submit a new password, sign out, and sign back in with that password.
   - Confirm production recovery remains on `app.nextmic.ai` and inspect auth/function logs for successful token verification and password update.

## Scope and safety

Only the password-recovery email link and reset-password page will change. No tables, user records, payments, provisioning, or unrelated authentication flows will be modified. If no disposable test account is available, the final password-change check will stop before altering a real customer account and report the exact remaining manual confirmation.

## Revert

Restore `supabase/functions/auth-email/index.ts` and `src/pages/ResetPassword.tsx` to their prior versions, then redeploy `auth-email` and republish the frontend. No database rollback is required.
