// Resolve aggregator-hosted opportunities (Sessionize, Eventbrite, PaperCall, Meetup, ...)
// to the organizer's own website, then run the full organizer crawl on that domain.
//
// Body:
//   { "limit": 100, "offset": 0 }        -> process active aggregator opportunities with no email
//   { "opportunity_ids": [...] }         -> targeted run
//   { "recrawl": true }                  -> ignore the organizer_contacts domain cache
//   { "dry_run": true }                  -> resolve + crawl but write nothing
//   { "no_render": true }                -> disable the Firecrawl render fallback
//
// Domain results are cached in organizer_contacts, so one organizer running ten
// events is crawled once. Listing->domain mappings are cached per opportunity in
// public.opportunity_organizer_domains.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crawlDomain, hostOf, isBlockedHost } from "../_shared/organizer-crawler.ts";
import { resolveListing } from "../_shared/aggregator-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const CACHE_DAYS_HIT = 90;
const CACHE_DAYS_MISS = 14;
const RESOLUTION_TTL_DAYS = 30;

interface Opp {
  id: string;
  event_name: string | null;
  event_url: string | null;
  organizer_email: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const recrawl = body.recrawl === true;
    const limit = Math.min(Number(body.limit ?? 100), 400);
    const offset = Math.max(Number(body.offset ?? 0), 0);
    const firecrawlKey = body.no_render === true
      ? undefined
      : Deno.env.get("FIRECRAWL_API_KEY") ?? undefined;

    // ---- 1. pick target opportunities -------------------------------------
    let query = supabase
      .from("opportunities")
      .select("id, event_name, event_url, organizer_email")
      .eq("is_active", true)
      .is("merged_into", null)
      .not("event_url", "is", null);

    if (Array.isArray(body.opportunity_ids) && body.opportunity_ids.length) {
      query = query.in("id", body.opportunity_ids);
    } else {
      query = query.is("organizer_email", null);
    }

    const { data: allRows, error: qErr } = await query.limit(3000);
    if (qErr) throw qErr;

    const aggregatorOpps: Opp[] = (allRows ?? []).filter((r) => {
      const h = hostOf(r.event_url as string);
      return !!h && isBlockedHost(h);
    }) as Opp[];

    // Skip opportunities we already resolved recently (unless recrawl).
    const { data: priorRows } = await supabase
      .from("opportunity_organizer_domains")
      .select("opportunity_id, resolved_domain, resolved_at")
      .in("opportunity_id", aggregatorOpps.slice(0, 1000).map((o) => o.id));
    const prior = new Map(
      (priorRows ?? []).map((r) => [r.opportunity_id as string, r]),
    );
    const priorFresh = (id: string) => {
      const p = prior.get(id);
      if (!p) return null;
      const ageDays = (Date.now() - new Date(p.resolved_at as string).getTime()) / 86400000;
      if (!recrawl && (p.resolved_domain || ageDays < RESOLUTION_TTL_DAYS)) return p;
      return null;
    };

    const targets = aggregatorOpps.slice(offset, offset + limit);

    // ---- 2. resolve listing -> organizer domain ---------------------------
    const oppDomain = new Map<string, string>();
    const resolutionRows: Record<string, unknown>[] = [];
    let resolvedFromCache = 0;
    let renderedCount = 0;

    const CONCURRENCY = 5;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (o) => {
        const cached = priorFresh(o.id);
        if (cached) {
          resolvedFromCache++;
          if (cached.resolved_domain) oppDomain.set(o.id, cached.resolved_domain as string);
          return;
        }
        const r = await resolveListing(o.event_url!, {
          eventName: o.event_name,
          firecrawlKey,
        });
        if (r.rendered) renderedCount++;
        if (r.resolved_domain) oppDomain.set(o.id, r.resolved_domain);
        resolutionRows.push({
          opportunity_id: o.id,
          listing_url: o.event_url,
          resolved_domain: r.resolved_domain,
          candidates: r.candidates,
          method: "aggregator_link",
          rendered: r.rendered,
          error: r.error,
          resolved_at: new Date().toISOString(),
        });
      }));
    }

    if (!dryRun && resolutionRows.length) {
      await supabase
        .from("opportunity_organizer_domains")
        .upsert(resolutionRows, { onConflict: "opportunity_id" });
    }

    // ---- 3. crawl each unique organizer domain (cache aware) --------------
    const domains = [...new Set([...oppDomain.values()])].filter((d) => !isBlockedHost(d));

    const { data: cachedContacts } = await supabase
      .from("organizer_contacts")
      .select("domain, email, last_attempt_at, status")
      .in("domain", domains.slice(0, 1000));
    const contactCache = new Map((cachedContacts ?? []).map((c) => [c.domain as string, c]));

    const fresh = (c: { last_attempt_at: string; status: string }) => {
      const age = (Date.now() - new Date(c.last_attempt_at).getTime()) / 86400000;
      const hit = c.status === "found_email" || c.status === "found_alt_path";
      return age < (hit ? CACHE_DAYS_HIT : CACHE_DAYS_MISS);
    };

    const toCrawl = recrawl
      ? domains
      : domains.filter((d) => {
        const c = contactCache.get(d);
        return !(c && fresh(c as never));
      });

    const crawlResults = [];
    for (let i = 0; i < toCrawl.length; i += CONCURRENCY) {
      const batch = toCrawl.slice(i, i + CONCURRENCY);
      const out = await Promise.all(
        batch.map((d) => crawlDomain(`https://${d}`, { firecrawlKey })),
      );
      crawlResults.push(...out);
    }

    const rows = crawlResults.map((r) => ({
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
    }

    // ---- 4. fill organizer_email where we now have one --------------------
    const emailByDomain = new Map<string, string>();
    for (const [d, c] of contactCache) if (c.email) emailByDomain.set(d, c.email as string);
    for (const r of rows) if (r.email) emailByDomain.set(r.domain, r.email);

    let filled = 0;
    const fills: { id: string; email: string }[] = [];
    for (const [oppId, domain] of oppDomain) {
      const email = emailByDomain.get(domain);
      if (!email) continue;
      fills.push({ id: oppId, email });
    }
    if (!dryRun) {
      for (const f of fills) {
        const { error, count } = await supabase
          .from("opportunities")
          .update({ organizer_email: f.email }, { count: "exact" })
          .eq("id", f.id)
          .is("organizer_email", null);
        if (!error && count) filled += count;
      }
    }

    const { count: activeTotal } = await supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("merged_into", null);
    const { count: activeWithEmail } = await supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("merged_into", null)
      .not("organizer_email", "is", null);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        aggregator_candidates: aggregatorOpps.length,
        attempted: targets.length,
        resolved_from_cache: resolvedFromCache,
        newly_resolved: resolutionRows.filter((r) => r.resolved_domain).length,
        resolution_failures: resolutionRows.filter((r) => !r.resolved_domain).length,
        listing_renders: renderedCount,
        unique_domains: domains.length,
        domains_crawled: rows.length,
        domains_skipped_cached: domains.length - toCrawl.length,
        domains_with_email: rows.filter((r) => r.email).length,
        opportunities_matched_to_email: fills.length,
        opportunities_email_filled: filled,
        active_total: activeTotal ?? null,
        active_with_email: activeWithEmail ?? null,
        coverage_pct: activeTotal
          ? Math.round(((activeWithEmail ?? 0) / activeTotal) * 1000) / 10
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("resolve-aggregator-organizers failed", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
