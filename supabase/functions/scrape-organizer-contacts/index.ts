// Organizer contact discovery — domain-cached, multi-path crawler.
// Modes:
//   { "url": "https://example.com/cfp" }            -> crawl one domain (cache aware)
//   { "urls": [...] }                                -> crawl many
//   { "backfill": true, "limit": 50 }                -> crawl all organizer-owned domains in inventory
//   add "dry_run": true to skip all writes
//   add "no_render": true to disable the browser-render fallback (cheap mode)
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
    // Opportunity organizer_email backfill is opt-in only.
    const fillOpportunities = body.fill_opportunities === true;
    const limit = Math.min(Number(body.limit ?? 50), 300);
    const offset = Math.max(Number(body.offset ?? 0), 0);
    const firecrawlKey = body.no_render === true
      ? undefined
      : Deno.env.get("FIRECRAWL_API_KEY") ?? undefined;


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
      const hit = c.status === "found_email" || c.status === "found_alt_path";
      return age < (hit ? CACHE_DAYS_HIT : CACHE_DAYS_MISS);
    };

    const toCrawl = targets.filter((u) => {
      const h = hostOf(u);
      if (!h || isBlockedHost(h)) return false;
      const c = cacheMap.get(h);
      return !(c && fresh(c as never));
    }).slice(0, limit);

    const results = [];
    const CONCURRENCY = 5;
    for (let i = 0; i < toCrawl.length; i += CONCURRENCY) {
      const batch = toCrawl.slice(i, i + CONCURRENCY);
      const out = await Promise.all(batch.map((u) => crawlDomain(u, { firecrawlKey })));
      results.push(...out);
    }

    const rows = results.map((r) => ({
      domain: r.domain,
      confidence_tier: r.confidence_tier,
      status: r.status,
      email: r.best?.email ?? null,
      contact_type: r.best?.contact_type ?? null,
      source_page: r.best?.source_page ?? null,
      strategy: r.best?.strategy ?? null,
      all_emails: r.hits.map((h) => h.email),
      named_staff: r.named_staff,
      contact_form_url: r.form?.url ?? null,
      contact_form_fields: r.form?.fields ?? [],
      linkedin_url: r.linkedin_url,
      phone: r.phone,
      socials: r.socials,
      physical_address: r.physical_address,
      paths_found: r.paths_found,
      strategies_tried: r.strategies_tried,
      render_used: r.render_used,
      pages_fetched: r.pages_fetched,
      crawl_ms: r.crawl_ms,
      error: r.error,
      last_attempt_at: new Date().toISOString(),
    }));

    if (!dryRun && rows.length) {
      await supabase.from("organizer_contacts").upsert(rows, { onConflict: "domain" });
      // Fill organizer_email only where it is currently empty (never overwrite).
      for (const row of rows.filter((r) => r.email)) {
        await supabase
          .from("opportunities")
          .update({ organizer_email: row.email })
          .is("organizer_email", null)
          .eq("is_active", true)
          .ilike("event_url", `%${row.domain}%`);
      }
    }

    const count = (key: keyof typeof rows[number]) => {
      const out: Record<string, number> = {};
      for (const r of rows) {
        const v = String(r[key] ?? "null");
        out[v] = (out[v] ?? 0) + 1;
      }
      return out;
    };
    const emailHits = rows.filter((r) => r.email).length;
    const anyPath = rows.filter((r) => r.paths_found.length > 0).length;
    const byStrategy: Record<string, number> = {};
    for (const r of rows) if (r.strategy) byStrategy[r.strategy] = (byStrategy[r.strategy] ?? 0) + 1;
    const pathCounts: Record<string, number> = {};
    for (const r of rows) {
      for (const p of r.paths_found) pathCounts[p] = (pathCounts[p] ?? 0) + 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        targets: targets.length,
        crawled: rows.length,
        skipped_cached: targets.length - toCrawl.length,
        email_hits: emailHits,
        email_rate: rows.length ? Math.round((emailHits / rows.length) * 100) : 0,
        any_path_hits: anyPath,
        any_path_rate: rows.length ? Math.round((anyPath / rows.length) * 100) : 0,
        by_confidence_tier: count("confidence_tier"),
        by_status: count("status"),
        by_strategy: byStrategy,
        by_path: pathCounts,
        render_used_count: rows.filter((r) => r.render_used).length,
        total_pages_fetched: rows.reduce((a, r) => a + r.pages_fetched, 0),
        avg_crawl_ms: rows.length
          ? Math.round(rows.reduce((a, r) => a + (r.crawl_ms ?? 0), 0) / rows.length)
          : 0,
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
