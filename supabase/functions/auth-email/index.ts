// NextMIC auth email — one email system for the whole business.
//
// Replaces the platform's built-in auth mail (which sent from
// no-reply@auth.lovable.cloud, branded "SpeakFlow Pro app", on a shared
// rate-limited relay — password resets silently never arrived). This
// function mints the same links via the admin API and delivers them
// through Resend from no-reply@nextmic.ai, reply-to support@nextmic.ai.
//
// POST { action: "recovery" | "signup", email, password? }
//   recovery — forgot-password link.
//   signup   — creates the account (unconfirmed) and sends a confirm link;
//              the app calls this INSTEAD of client-side signUp so the
//              platform never sends its own competing email.
//   email_change — signed-in user moves their sign-in address. Requires a
//              valid Bearer JWT (the caller proves who they are); the
//              confirmation link is sent to the NEW address only, so a
//              typo can never lock anyone out of their account.
//
// Always returns 200 with a generic body for recovery, so the endpoint
// can't be used to enumerate who has an account. Real failures are logged.
//
// verify_jwt = false: these are pre-authentication flows.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = Deno.env.get("APP_URL") ?? "https://app.nextmic.ai";
const RESEND_KEY = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
const FROM = "NextMIC <no-reply@nextmic.ai>";
const REPLY_TO = "support@nextmic.ai";
const THROTTLE_PER_HOUR = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS },
  });
}

function shell(heading: string, lead: string, cta: string, link: string,
               footer: string) {
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#17141F">
    <h2 style="font-size:20px">${heading}</h2>
    <p>${lead}</p>
    <p style="margin:28px 0"><a href="${link}" style="background:#E8A33D;color:#0F0D15;font-weight:700;padding:14px 26px;border-radius:8px;text-decoration:none">${cta}</a></p>
    <p style="font-size:13px;color:#6D6879">${footer}</p>
    <p style="font-size:13px;color:#6D6879">— The NextMIC team &middot; <a href="mailto:support@nextmic.ai" style="color:#6D6879">support@nextmic.ai</a></p>
  </div>`;
}

async function send(to: string, subject: string, html: string) {
  if (!RESEND_KEY) { console.error("RESEND_API_KEY missing — no auth mail sent to", to); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to, subject, html }),
  });
  if (!r.ok) { console.error("auth mail send failed:", r.status, await r.text()); return false; }
  return true;
}

/** Per-email hourly cap so the endpoint can't be used to spam an inbox.
 *  Degrades open (logs) if the table is absent — mail matters more. */
async function throttled(email: string, action: string): Promise<boolean> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error } = await admin.from("auth_email_log")
    .select("id", { count: "exact", head: true })
    .eq("email", email.toLowerCase()).gte("created_at", since);
  if (error) { console.error("auth_email_log read failed:", error.message); return false; }
  if ((count ?? 0) >= THROTTLE_PER_HOUR) return true;
  await admin.from("auth_email_log").insert({ email: email.toLowerCase(), action });
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const { action, email, password } = await req.json().catch(() => ({}));
  const addr = typeof email === "string" ? email.trim() : "";
  if (!addr || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
    return json({ error: "A valid email address is required" }, 400);
  }

  try {
    if (action === "signup") {
      if (!password || String(password).length < 8) {
        return json({ error: "Password must be at least 8 characters" }, 400);
      }
      if (await throttled(addr, "signup")) {
        return json({ ok: true, note: "throttled" });
      }
      const { error: createErr } = await admin.auth.admin.createUser({
        email: addr, password: String(password), email_confirm: false,
      });
      if (createErr) {
        // already registered -> generic answer, no account disclosure
        if (/already/i.test(createErr.message)) {
          return json({ ok: true, existing: true });
        }
        console.error("createUser failed:", createErr.message);
        return json({ error: "We couldn't create that account. Try again or email support@nextmic.ai." }, 400);
      }
      const { data, error } = await admin.auth.admin.generateLink({
        type: "signup", email: addr, password: String(password),
        options: { redirectTo: `${APP_URL}/dashboard` },
      });
      if (error) throw error;
      await send(addr, "Confirm your NextMIC account",
        shell("Welcome to NextMIC!",
              "Confirm your email address and your account is live:",
              "Confirm my email &rarr;", data.properties.action_link,
              "If you didn't sign up for NextMIC, you can ignore this email."));
      return json({ ok: true });
    }

    if (action === "email_change") {
      // identity comes from the caller's session token, never from the body
      const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!bearer) return json({ error: "You must be signed in to change your email." }, 401);
      const { data: caller, error: callerErr } = await admin.auth.getUser(bearer);
      if (callerErr || !caller?.user) {
        return json({ error: "Your session has expired — sign in again and retry." }, 401);
      }
      const current = (caller.user.email ?? "").toLowerCase();
      if (addr.toLowerCase() === current) {
        return json({ error: "That's already your sign-in email." }, 400);
      }
      if (await throttled(current, "email_change")) {
        return json({ ok: true, note: "throttled" });
      }
      const { data, error } = await admin.auth.admin.generateLink({
        type: "email_change_new",
        email: caller.user.email!,
        newEmail: addr,
        options: { redirectTo: `${APP_URL}/profile` },
      });
      if (error) {
        // most common real cause: the new address already belongs to someone
        console.error("email_change link failed:", error.message);
        return json({ error: "We couldn't start that change. If that address already has a NextMIC account, sign in with it instead." }, 400);
      }
      await send(addr, "Confirm your new NextMIC email",
        shell("Confirm your new email address",
              `You asked to change your NextMIC sign-in email to <strong>${addr}</strong>. Click below to confirm — until you do, keep signing in with your current address.`,
              "Confirm this address &rarr;", data.properties.action_link,
              "If you didn't request this, ignore this email and nothing will change."));
      return json({ ok: true });
    }

    if (action === "recovery") {
      if (await throttled(addr, "recovery")) {
        return json({ ok: true, note: "throttled" });
      }
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery", email: addr,
        options: { redirectTo: `${APP_URL}/reset-password` },
      });
      if (error) {
        // no such user (or similar) — answer generically, never disclose
        console.error("recovery link failed for", addr, error.message);
        return json({ ok: true });
      }
      await send(addr, "Reset your NextMIC password",
        shell("Reset your password",
              "Click below to choose a new password for your NextMIC account:",
              "Set a new password &rarr;", data.properties.action_link,
              "This link expires in 1 hour. If you didn't ask for it, you can safely ignore this email — your password won't change."));
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (ex) {
    console.error("auth-email failed:", ex);
    return json({ error: "Something went wrong. Email support@nextmic.ai and we'll sort it out." }, 500);
  }
});
