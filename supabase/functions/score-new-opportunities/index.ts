import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Bounded work per run: at most this many (opportunity, user) score rows are written.
const MAX_ROWS_PER_RUN = 50000;

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
  const startedAt = Date.now();

  // Safety net only. New opportunities are normally scored on insert by the
  // score_new_opportunity trigger; this fills gaps left by trigger-bypassing
  // writes (restores, bulk loads) and by profiles created after a scoring run.
  // Only missing (opportunity, user) pairs are written — existing scores and all
  // pipeline data are untouched.
  const { data, error } = await supabase.rpc("score_missing_opportunities", {
    p_limit: MAX_ROWS_PER_RUN,
  });

  if (error) {
    console.error("score_missing_opportunities failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const scored = typeof data === "number" ? data : 0;
  const durationMs = Date.now() - startedAt;
  console.log(`scored ${scored} missing rows in ${durationMs}ms (cap ${MAX_ROWS_PER_RUN})`);

  return new Response(
    JSON.stringify({
      scored_count: scored,
      capped: scored >= MAX_ROWS_PER_RUN,
      duration_ms: durationMs,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
