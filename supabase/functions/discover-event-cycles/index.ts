// Next-cycle date discovery.
// Crawls organizer domains for *published* future event dates and call-for-
// speakers status, and stores them with a last-confirmed timestamp.
// Admin / service-role only. Pure fetch + parse + optional browser render — no AI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchPage, hostOf, isBlockedHost, isJsShell, renderPage } from "../_shared/organizer-crawler.ts";
import { buildSignals, CYCLE_PROBE_PATHS, type PageInput } from "../_shared/event-date-extractor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface DomainOutcome {
  domain: string;
  pages_fetched: number;
  render_used: boolean;
  signals: number;
  has_future_date: boolean;
  cfp_open: boolean;
  status: string;
  error: string | null;
}

async function crawlCycle(
  domain: string,
  opts: { firecrawlKey?: string; maxPages: number },
): Promise<{ pages: PageInput[]; render_used: boolean; error: string | null }> {
  const pages: PageInput[] = [];
  let render_used = false;
  let error: string | null = null;
  const started = Date.now();

  for (const path of CYCLE_PROBE_PATHS) {
    if (pages.length >= opts.maxPages) break;
    if (Date.now() - started > 55_000) break;
    const url = `https://${domain}${path}`;
    const isHomepage = path === "/";
    const got = await fetchPage(url, 20_000);

    if (got?.html && got.status < 400) {
      // JS-shell sites (the largest commercial conferences) publish the next
      // date only after render — pay for a render on the homepage / CFP page.
      if (isJsShell(got.html) && opts.firecrawlKey && !render_used && (isHomepage || /cfp|call-for|speak/.test(path))) {
        const rendered = await renderPage(url, opts.firecrawlKey);
        render_used = true;
        if (rendered?.html) {
          pages.push({ url, html: rendered.html.slice(0, 400_000), isHomepage, rendered: true });
          continue;
        }
      }
      pages.push({ url, html: got.html.slice(0, 400_000), isHomepage, rendered: false });
    } else if (isHomepage) {
      if (opts.firecrawlKey && !render_used) {
        const rendered = await renderPage(url, opts.firecrawlKey);
        render_used = true;
        if (rendered?.html) {
          pages.push({ url, html: rendered.html.slice(0, 400_000), isHomepage: true, rendered: true });
        } else {
          error = "homepage_unreachable";
        }
      } else {
        error = "homepage_unreachable";
      }
    }
  }

  return { pages, render_used, error };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Authorization: service-role bearer token, cron secret, or an admin user.
  const auth = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const cronSecret = req.headers.get("x-cron-secret");
  let allowed = auth === serviceKey || (!!cronSecret && cronSecret === Deno.env.get("EXPIRY_CRON_SECRET"));
  if (!allowed && auth) {
    const { data: { user } } = await supabase.auth.getUser(auth);
    if (user) {
      const { data: role } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      allowed = !!role;
    }
  }
  if (!allowed) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const limit = Math.min(Number(body.limit ?? 25), 100);
    const offset = Math.max(Number(body.offset ?? 0), 0);
    const maxPages = Math.min(Number(body.max_pages ?? 8), 12);
    const firecrawlKey = body.no_render === true
      ? undefined
      : Deno.env.get("FIRECRAWL_API_KEY") ?? undefined;

    let domains: string[] = Array.isArray(body.domains) ? body.domains : [];

    if (!domains.length) {
      // Every organizer domain with at least one expired opportunity.
      const { data: opps } = await supabase
        .from("opportunities")
        .select("organizer_email, event_url, deadline, event_date, id")
        .is("merged_into", null)
        .limit(5000);
      const { data: resolved } = await supabase
        .from("opportunity_organizer_domains")
        .select("opportunity_id, resolved_domain");
      const resolvedMap = new Map((resolved ?? []).map((r) => [r.opportunity_id, r.resolved_domain]));

      const today = new Date().toISOString().slice(0, 10);
      const set = new Set<string>();
      for (const o of opps ?? []) {
        const expired = (o.deadline && o.deadline < today) || (o.event_date && o.event_date < today);
        if (!expired) continue;
        const d = (o.organizer_email as string | null)?.split("@")[1] ??
          resolvedMap.get(o.id) ??
          hostOf((o.event_url as string) ?? "");
        if (d && !isBlockedHost(d)) set.add(d.toLowerCase());
      }
      domains = [...set].sort();
    }

    const total = domains.length;
    const slice = domains.slice(offset, offset + limit);
    const outcomes: DomainOutcome[] = [];
    const now = new Date().toISOString();

    for (const domain of slice) {
      const { pages, render_used, error } = await crawlCycle(domain, { firecrawlKey, maxPages });
      const signals = pages.length ? buildSignals(domain, pages) : [];

      if (!dryRun && signals.length) {
        const rows = signals.map((s) => ({
          domain,
          event_name: s.event_name,
          event_slug: s.event_slug,
          next_event_date: s.next_event_date,
          next_event_date_end: s.next_event_date_end,
          next_event_date_text: s.next_event_date_text,
          date_confidence: s.date_confidence,
          date_source_url: s.date_source_url,
          date_confirmed_at: s.next_event_date ? now : null,
          cfp_status: s.cfp_status,
          cfp_url: s.cfp_url,
          cfp_deadline: s.cfp_deadline,
          cfp_source_url: s.cfp_source_url,
          cfp_confirmed_at: s.cfp_status === "unknown" ? null : now,
          site_shape: s.site_shape,
          render_used: s.render_used || render_used,
          raw_evidence: { evidence: s.evidence },
        }));
        await supabase.from("organizer_event_signals").upsert(rows, { onConflict: "domain,event_slug" });
      }

      const outcome: DomainOutcome = {
        domain,
        pages_fetched: pages.length,
        render_used,
        signals: signals.length,
        has_future_date: signals.some((s) => !!s.next_event_date),
        cfp_open: signals.some((s) => s.cfp_status === "open"),
        status: error ?? (signals.length ? "ok" : "no_signal"),
        error,
      };
      outcomes.push(outcome);

      if (!dryRun) {
        await supabase.from("organizer_crawl_runs").insert({
          domain,
          pages_fetched: pages.length,
          render_used,
          signals_found: signals.length,
          status: outcome.status,
          error,
        });
      }
    }

    const withDate = outcomes.filter((o) => o.has_future_date).length;
    const withOpenCfp = outcomes.filter((o) => o.cfp_open).length;

    return json({
      success: true,
      dry_run: dryRun,
      total_domains: total,
      offset,
      crawled: outcomes.length,
      future_date_hits: withDate,
      future_date_rate: outcomes.length ? Math.round((withDate / outcomes.length) * 100) : 0,
      open_cfp_hits: withOpenCfp,
      open_cfp_rate: outcomes.length ? Math.round((withOpenCfp / outcomes.length) * 100) : 0,
      rendered: outcomes.filter((o) => o.render_used).length,
      results: outcomes,
    });
  } catch (e) {
    console.error("discover-event-cycles failed", e);
    return json({ error: String(e) }, 500);
  }
});
