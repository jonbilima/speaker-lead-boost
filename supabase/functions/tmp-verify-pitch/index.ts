// TEMPORARY verification helper. Creates a throwaway user, mints a session,
// calls generate-pitch for the given opportunity ids, then deletes the user.
// Gated by the x-cron-secret shared secret. Delete this function after use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.headers.get("x-cron-secret") !== Deno.env.get("EXPIRY_CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.opportunity_ids) ? body.opportunity_ids : [];

  const email = `pitch-verify-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID() + "Aa1!";
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Pitch Verification" },
  });
  if (createErr || !created.user) {
    return new Response(JSON.stringify({ error: createErr?.message ?? "create failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: unknown[] = [];
  try {
    const pub = createClient(url, anonKey);
    const { data: session, error: signInErr } = await pub.auth.signInWithPassword({ email, password });
    if (signInErr || !session.session) throw new Error(signInErr?.message ?? "sign in failed");
    const jwt = session.session.access_token;

    for (const id of ids) {
      const r = await fetch(`${url}/functions/v1/generate-pitch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ opportunity_id: id }),
      });
      const text = await r.text();
      let parsed: unknown = text.slice(0, 400);
      try {
        const j = JSON.parse(text);
        parsed = j.error
          ? { error: j.error }
          : {
              pitch_count: Array.isArray(j.pitches) ? j.pitches.length : 0,
              first_subject: j.pitches?.[0]?.subject_line ?? null,
              body_preview: (j.pitches?.[0]?.email_body ?? "").slice(0, 160),
            };
      } catch { /* keep raw preview */ }
      results.push({ opportunity_id: id, status: r.status, result: parsed });
    }
  } catch (e) {
    results.push({ error: String(e) });
  } finally {
    await admin.auth.admin.deleteUser(created.user.id);
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
