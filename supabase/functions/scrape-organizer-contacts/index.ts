// Organizer contact discovery — domain-cached, multi-strategy crawler.
// Modes:
//   { "url": "https://example.com/cfp" }            -> crawl one domain (cache aware)
//   { "urls": [...] }                                -> crawl many
//   { "backfill": true, "limit": 50 }                -> crawl all organizer-owned domains in inventory
//   add "dry_run": true to skip all writes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  crawlDomain,
  hostOf,
  isBlockedHost,
} from "../_shared/organizer-crawler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-ingest-token",
};

const CACHE_DAYS_HIT = 90;
const CACHE_DAYS_MISS = 14;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const limit = Math.min(Number(body.limit ?? 50), 300);

    let targets: string[] = [];
    if (body.url) targets = [body.url];
    else if (Array.isArray(body.urls)) targets = body.urls;
    else if (body.backfill) {
      const { data } = await supabase
        .from("opportunities")
        .select("event_url")
        .eq("is_active", true)
        .is("merged_into", null)
        .not("event_url", "is", null)
        .limit(5000);
      const byDomain = new Map<string, string>();
      for (const r of data ?? []) {
        const h = hostOf(r.event_url as string);
        if (!h || isBlockedHost(h)) continue;
        if (!byDomain.has(h)) byDomain.set(h, r.event_url as string);
      }
      targets = [...byDomain.values()];
    }

    // Domain-level cache
    const domains = [...new Set(targets.map((u) => hostOf(u)).filter(Boolean))] as string[];
    const { data: cached } = await supabase
      .from("organizer_contacts")
      .select("domain, email, last_attempt_at, status")
      .in("domain", domains.slice(0, 1000));
    const cacheMap = new Map((cached ?? []).map((c) => [c.domain, c]));

    const fresh = (c: { last_attempt_at: string; status: string }) => {
      const age = (Date.now() - new Date(c.last_attempt_at).getTime()) / 86400000;
      return age < (c.status === "found" ? CACHE_DAYS_HIT : CACHE_DAYS_MISS);
    };

    const toCrawl = targets.filter((u) => {
      const h = hostOf(u);
      if (!h || isBlockedHost(h)) return false;
      const c = cacheMap.get(h);
      return !(c && fresh(c as never));
    }).slice(0, limit);

    const results = [];
    const CONCURRENCY = 6;
    for (let i = 0; i < toCrawl.length; i += CONCURRENCY) {
      const batch = toCrawl.slice(i, i + CONCURRENCY);
      const out = await Promise.all(batch.map((u) => crawlDomain(u)));
      results.push(...out);
    }

    const rows = results.map((r) => ({
      domain: r.domain,
      email: r.best?.email ?? null,
      contact_type: r.best?.contact_type ?? null,
      source_page: r.best?.source_page ?? null,
      strategy: r.best?.strategy ?? null,
      all_emails: r.hits.map((h) => h.email),
      strategies_tried: r.strategies_tried,
      pages_fetched: r.pages_fetched,
      status: r.best ? "found" : (r.error ?? "not_found"),
      last_attempt_at: new Date().toISOString(),
    }));

    if (!dryRun && rows.length) {
      await supabase.from("organizer_contacts").upsert(rows, { onConflict: "domain" });
      // Backfill organizer_email on opportunities that have none (never overwrite)
      for (const row of rows.filter((r) => r.email)) {
        await supabase
          .from("opportunities")
          .update({ organizer_email: row.email })
          .is("organizer_email", null)
          .eq("is_active", true)
          .ilike("event_url", `%${row.domain}%`);
      }
    }

    const hits = rows.filter((r) => r.email).length;
    const byStrategy: Record<string, number> = {};
    for (const r of rows) if (r.strategy) byStrategy[r.strategy] = (byStrategy[r.strategy] ?? 0) + 1;

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        targets: targets.length,
        crawled: rows.length,
        skipped_cached: targets.length - toCrawl.length,
        hits,
        hit_rate: rows.length ? Math.round((hits / rows.length) * 100) : 0,
        by_strategy: byStrategy,
        results: rows,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scrape-organizer-contacts failed", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
