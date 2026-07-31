// Box Office fulfillment receiver + thank-you provisioning for NextMIC.
//
// Routes (verify_jwt = false; each route carries its own auth):
//   POST /boxoffice-webhook          — signed engine events:
//     purchase.completed -> create the buyer's account + send the
//       set-password welcome email (Resend).
//     access.revoked     -> ban the account (immediately for
//       refund/chargeback/subscription_deleted; user_canceled with a
//       future effective_at is acknowledged and left to the final
//       revocation the engine sends at period end).
//   POST /boxoffice-webhook/claim    — thank-you page set-password flow:
//     { session_token, password } -> engine validates + single-uses the
//     token (server-to-server, shared hook secret) -> account created
//     with that password -> returns a magiclink redirect so the buyer
//     lands in the app logged in.
//
// Secrets: BOXOFFICE_HOOK_SECRET (shared with the engine's fulfillment
// webhook config), RESEND_API_KEY (send-only). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENGINE_URL = Deno.env.get("ENGINE_URL") ??
  "https://engine-production-51cb.up.railway.app";
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.nextmic.ai";
// Normalize whatever paste format the secrets UI received — bare value,
// NAME=value, quoted, trailing newline. Two debugging rounds taught us the
// secret arrives however humans paste it; extract the whsec_ token itself.
function normalizeSecret(raw: string): string {
  const m = /whsec_[0-9a-f]+/.exec(raw);
  return m ? m[0] : raw.trim();
}
const HOOK_SECRET = normalizeSecret(Deno.env.get("BOXOFFICE_HOOK_SECRET") ?? "");
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FUNNEL_ID = "nextmic-challenge";

const CORS = {
  "Access-Control-Allow-Origin": "https://launch.nextmic.ai",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// --- signature verification (engine's t=<ts>,v1=<hmac> over "{t}.{body}") ---

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(header: string | null, body: string): Promise<boolean> {
  if (!header || !HOOK_SECRET) return false;
  const m = /t=(\d+),\s*v1=([0-9a-f]+)/.exec(header);
  if (!m) return false;
  const [_, t, v1] = m;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expect = await hmacHex(HOOK_SECRET, `${t}.${body}`);
  // constant-time-ish compare
  if (expect.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

// --- idempotency ledger (table optional; degrade loudly if missing) ---

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const { data, error } = await admin.from("boxoffice_events")
    .select("id").eq("id", eventId).maybeSingle();
  if (error) { console.error("boxoffice_events read failed (run migration):", error.message); return false; }
  return !!data;
}

async function markProcessed(eventId: string, type: string) {
  const { error } = await admin.from("boxoffice_events")
    .insert({ id: eventId, type });
  if (error) console.error("boxoffice_events write failed:", error.message);
}

// --- provisioning core ---

async function findUserByEmail(email: string) {
  // listUsers has no email filter pre-v2; use the paged filter API
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const target = email.trim().toLowerCase();
  return data.users.find((u) => (u.email ?? "").toLowerCase() === target) ?? null;
}

async function ensureUser(email: string, name: string | null, products: string[],
                          password?: string) {
  const existing = await findUserByEmail(email);
  const meta = { name: name ?? email, boxoffice_products: products, boxoffice: true };
  if (existing) {
    const attrs: Record<string, unknown> = {
      user_metadata: { ...existing.user_metadata, ...meta },
      ban_duration: "none",
    };
    if (password) attrs.password = password;
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, attrs);
    if (error) throw error;
    return data.user;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, email_confirm: true, user_metadata: meta,
    ...(password ? { password } : {}),
  });
  if (error) throw error;
  return data.user;
}

async function setPasswordLink(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery", email,
    options: { redirectTo: `${APP_URL}/` },
  });
  if (error) throw error;
  return data.properties.action_link;
}

async function sendWelcomeEmail(email: string, name: string | null, link: string) {
  if (!RESEND_KEY) { console.error("RESEND_API_KEY missing — welcome email skipped for", email); return; }
  const first = (name ?? "").trim().split(/\s+/)[0] || "there";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: "NextMIC <receipts@nextmic.ai>",
      reply_to: "support@nextmic.ai",
      to: email,
      subject: "Your NextMIC login — set your password",
      html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#17141F">
        <h2 style="font-size:20px">Welcome to NextMIC, ${first}!</h2>
        <p>Your account is ready. One step left — set your password and you're in:</p>
        <p style="margin:28px 0"><a href="${link}" style="background:#E8A33D;color:#0F0D15;font-weight:700;padding:14px 26px;border-radius:8px;text-decoration:none">Set my password &rarr;</a></p>
        <p style="font-size:13px;color:#6D6879">This link is personal to you. If you didn't buy the Booked in 5 Challenge, reply to this email.</p>
        <p style="font-size:13px;color:#6D6879">— The NextMIC team &middot; support@nextmic.ai</p>
      </div>`,
    }),
  });
  if (!r.ok) console.error("welcome email failed:", r.status, await r.text());
}

// --- event handlers ---

async function handlePurchaseCompleted(evt: any) {
  const d = evt.data ?? {};
  const email = d.email;
  if (!email) return { ok: false, error: "no email in payload" };
  const products = (d.products ?? []).map((p: any) => p.ref ?? p);
  const user = await ensureUser(email, d.name ?? null, products);
  const link = await setPasswordLink(email);
  await sendWelcomeEmail(email, d.name ?? null, link);
  return { ok: true, user_id: user.id, provisioned: true };
}

async function handleAccessRevoked(evt: any) {
  const d = evt.data ?? {};
  const email = d.email;
  if (!email) return { ok: true, note: "no email; nothing to revoke" };
  if (d.reason === "user_canceled" && d.effective_at &&
      new Date(d.effective_at).getTime() > Date.now()) {
    return { ok: true, note: `cancel acknowledged; access until ${d.effective_at}` };
  }
  const user = await findUserByEmail(email);
  if (!user) return { ok: true, note: "no account to revoke" };
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    ban_duration: "876000h",
  });
  if (error) throw error;
  return { ok: true, banned: user.id };
}

// --- thank-you claim flow ---

async function handleClaim(req: Request): Promise<Response> {
  const { session_token, password } = await req.json().catch(() => ({}));
  if (!session_token || !password || String(password).length < 8) {
    return json({ error: "session_token and a password of 8+ characters are required" }, 400);
  }
  const r = await fetch(`${ENGINE_URL}/api/provision/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json",
               "X-BoxOffice-Hook-Secret": HOOK_SECRET },
    body: JSON.stringify({ funnel_id: FUNNEL_ID, token: session_token }),
  });
  if (r.status === 409) return json({ error: "This link was already used. Check your email for your login link." }, 409);
  if (!r.ok) return json({ error: "We couldn't verify your purchase — your login email is on its way instead." }, 400);
  const claim = await r.json();
  const user = await ensureUser(claim.email, claim.name ?? null,
                                claim.products ?? [], String(password));
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink", email: claim.email,
    options: { redirectTo: `${APP_URL}/` },
  });
  if (error) return json({ ok: true, user_id: user.id, redirect: `${APP_URL}/` });
  return json({ ok: true, user_id: user.id, redirect: data.properties.action_link });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const url = new URL(req.url);

  if (url.pathname.endsWith("/claim")) return handleClaim(req);

  // signed engine events
  const body = await req.text();
  const ok = await verifySignature(req.headers.get("X-BoxOffice-Signature"), body);
  // TEMPORARY diagnostic while wiring up: reveals only the configured
  // secret's LENGTH (0 = not set), never its content. Remove once green.
  if (!ok) return json({ error: "bad signature", secret_len: HOOK_SECRET.length }, 401);
  const evt = JSON.parse(body);
  if (evt.mode && evt.mode !== "live") return json({ ok: true, note: "test-mode event ignored" });
  if (await alreadyProcessed(evt.id)) return json({ ok: true, note: "duplicate" });

  try {
    let result;
    if (evt.type === "purchase.completed") result = await handlePurchaseCompleted(evt);
    else if (evt.type === "access.revoked") result = await handleAccessRevoked(evt);
    else result = { ok: true, note: `ignored type ${evt.type}` };
    await markProcessed(evt.id, evt.type);
    return json(result);
  } catch (ex) {
    console.error("handler failed:", ex);
    return json({ error: String(ex) }, 500); // engine retries with backoff
  }
});
