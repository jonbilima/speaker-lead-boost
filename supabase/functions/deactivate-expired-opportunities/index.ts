import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SKIP_WORDS = ["rolling", "ongoing", "continual", "continuous", "tbd", "open"];

function hasSkipWord(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SKIP_WORDS.some((w) => v.includes(w));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("EXPIRY_CRON_SECRET") ?? "";
  const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  const provided = (req.headers.get("x-cron-secret") ?? "").trim();
  const authorized =
    (cronSecret !== "" && provided !== "" && timingSafeEqual(provided, cronSecret)) ||
    (bearer !== "" && timingSafeEqual(bearer, serviceKey));
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const now = new Date();

  const { data, error } = await supabase
    .from("opportunities")
    .select("id, deadline, event_date, raw_data")
    .eq("is_active", true);

  if (error) {
    console.error("fetch error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expired: string[] = [];
  let skippedRolling = 0;

  for (const row of data ?? []) {
    const raw = (row.raw_data ?? {}) as Record<string, unknown>;
    if (
      hasSkipWord(raw.application_deadline) ||
      hasSkipWord(raw.deadline) ||
      hasSkipWord(raw.days_until_deadline)
    ) {
      skippedRolling++;
      continue;
    }

    const reference = row.deadline ?? (row.deadline == null ? row.event_date : null);
    if (!reference) continue;
    const when = new Date(reference as string);
    if (isNaN(when.getTime())) continue;
    if (when < now) expired.push(row.id as string);
  }

  let deactivated = 0;
  for (let i = 0; i < expired.length; i += 200) {
    const chunk = expired.slice(i, i + 200);
    const { error: updErr } = await supabase
      .from("opportunities")
      .update({ is_active: false })
      .in("id", chunk);
    if (updErr) {
      console.error("update error", updErr);
      return new Response(JSON.stringify({ error: updErr.message, deactivated }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    deactivated += chunk.length;
  }

  console.log(`deactivated ${deactivated}, skipped rolling ${skippedRolling}`);
  return new Response(
    JSON.stringify({ checked: data?.length ?? 0, deactivated, skipped_rolling: skippedRolling }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
