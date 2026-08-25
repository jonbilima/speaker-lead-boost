import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Only a hard "page is gone" counts as a failure. 403 is a bot block, 429 is
// rate limiting, 5xx and network errors are transient — none of them ever
// deactivate an opportunity.
const FAIL_STATUSES = new Set([404, 410]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function probe(url: string): Promise<string> {
  for (const method of ["HEAD", "GET"]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, {
        method,
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.status === 405 && method === "HEAD") continue;
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return String(res.status);
    } catch (e) {
      if (method === "GET") return `ERR:${(e as Error).name}`;
    }
  }
  return "ERR:Unknown";
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

  let limit = 200;
  let dryRun = false;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number") limit = Math.min(Math.max(body.limit, 1), 600);
    if (body?.dry_run === true) dryRun = true;
  } catch { /* no body */ }

  // Oldest-checked first so the whole active set rotates through over time.
  const { data: rows, error } = await supabase
    .from("opportunities")
    .select("id, event_url, link_check_results(last_checked_at, consecutive_failures)")
    .eq("is_active", true)
    .not("event_url", "is", null)
    .limit(600);

  if (error) {
    console.error("fetch error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  type Row = {
    id: string;
    event_url: string;
    link_check_results: { last_checked_at: string; consecutive_failures: number } | null;
  };

  const candidates = ((rows ?? []) as unknown as Row[])
    .filter((r) => typeof r.event_url === "string" && /^https?:\/\//i.test(r.event_url))
    .sort((a, b) => {
      const at = a.link_check_results?.last_checked_at ?? "";
      const bt = b.link_check_results?.last_checked_at ?? "";
      return at < bt ? -1 : at > bt ? 1 : 0;
    })
    .slice(0, limit);

  const deactivated: string[] = [];
  let failing = 0;
  let ok = 0;

  const CONCURRENCY = 10;
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        const status = await probe(row.event_url);
        const numeric = Number(status);
        const isFailure = !Number.isNaN(numeric) && FAIL_STATUSES.has(numeric);
        const prior = row.link_check_results?.consecutive_failures ?? 0;
        const streak = isFailure ? prior + 1 : 0;
        if (isFailure) failing++; else ok++;

        let deactivatedAt: string | null = null;
        if (streak >= 2 && !dryRun) {
          const { error: updErr } = await supabase
            .from("opportunities")
            .update({ is_active: false })
            .eq("id", row.id);
          if (updErr) {
            console.error("deactivate error", row.id, updErr.message);
          } else {
            deactivated.push(row.id);
            deactivatedAt = new Date().toISOString();
          }
        } else if (streak >= 2 && dryRun) {
          deactivated.push(row.id);
        }

        await supabase.from("link_check_results").upsert(
          {
            opportunity_id: row.id,
            url: row.event_url,
            last_status: status,
            consecutive_failures: streak,
            last_checked_at: new Date().toISOString(),
            ...(deactivatedAt ? { deactivated_at: deactivatedAt } : {}),
          },
          { onConflict: "opportunity_id" },
        );
      }),
    );
  }

  console.log(
    `link check: ${candidates.length} checked, ${ok} ok, ${failing} dead-page responses, ${deactivated.length} deactivated${dryRun ? " (dry run)" : ""}`,
  );

  return new Response(
    JSON.stringify({
      checked: candidates.length,
      ok,
      failing,
      deactivated: deactivated.length,
      deactivated_ids: deactivated,
      dry_run: dryRun,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
