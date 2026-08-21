// Temporary admin/service-only diagnostic: compares two ways of resolving the
// real organizer domain behind an Eventbrite listing.
//   A) Eventbrite API event/organizer endpoints (needs event ID from the URL)
//   B) Browser rendering of the event page -> organizer profile -> own website
// Body: { limit?: number, ids?: string[], mode?: "api" | "render" | "both" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BAD_HOSTS = [
  "eventbrite.", "evbuc.com", "evbqa", "eventbrite.co.uk", "facebook.", "twitter.", "x.com",
  "instagram.", "linkedin.", "youtube.", "tiktok.", "google.", "gstatic.", "googleapis.",
  "apple.com", "bit.ly", "t.co", "paypal.", "stripe.", "zoom.us", "meetup.com", "mailchi",
  "sessionize.com", "papercall.io", "hopin.", "ticketmaster.", "cvent.", "wixsite.com/_",
];

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
function usable(u: string): string | null {
  const h = hostOf(u);
  if (!h) return null;
  if (BAD_HOSTS.some((b) => h.includes(b))) return null;
  if (!h.includes(".")) return null;
  return h;
}
function eventIdFrom(url: string): string | null {
  const m = url.match(/-(\d{9,})(?:\?|$|\/)/) ?? url.match(/(\d{9,})/);
  return m ? m[1] : null;
}

async function fcScrape(key: string, url: string, formats: string[]) {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats, onlyMainContent: false, waitFor: 2500 }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { error: `${res.status}: ${JSON.stringify(j).slice(0, 200)}` };
  return j.data ?? j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const ebKey = Deno.env.get("EVENTBRITE_API_KEY");
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 20), 60);
    const offset = Math.max(Number(body.offset ?? 0), 0);
    const mode = String(body.mode ?? "both");

    let q = supabase
      .from("opportunities")
      .select("id, event_url, event_name")
      .eq("is_active", true)
      .is("merged_into", null)
      .ilike("event_url", "%eventbrite%")
      .order("id")
      .range(offset, offset + limit - 1);

    if (Array.isArray(body.ids) && body.ids.length) q = supabase
      .from("opportunities")
      .select("id, event_url, event_name")
      .in("id", body.ids);
    const { data: opps } = await q;

    const out: Record<string, unknown>[] = [];

    for (const o of opps ?? []) {
      const url = o.event_url as string;
      const row: Record<string, unknown> = {
        id: o.id,
        event_url: url,
        event_id: eventIdFrom(url),
      };

      // ---- A) Eventbrite API
      if (mode !== "render" && ebKey) {
        const eid = eventIdFrom(url);
        if (!eid) row.api = { status: "no_event_id" };
        else {
          try {
            const r = await fetch(
              `https://www.eventbriteapi.com/v3/events/${eid}/?expand=organizer,venue`,
              { headers: { Authorization: `Bearer ${ebKey}` } },
            );
            const j = await r.json().catch(() => ({}));
            if (!r.ok) {
              row.api = { status: `http_${r.status}`, detail: String(j?.error ?? "").slice(0, 80) };
            } else {
              const org = j.organizer ?? {};
              const cand: string[] = [];
              if (org.website) cand.push(org.website);
              const blob = `${org.description?.text ?? ""} ${org.long_description?.text ?? ""} ${j.description?.text ?? ""}`;
              for (const m of blob.matchAll(/https?:\/\/[^\s)"'<]+/g)) cand.push(m[0]);
              const domain = cand.map(usable).find(Boolean) ?? null;
              const emails = [...blob.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((m) => m[0]);
              row.api = {
                status: "ok",
                organizer_name: org.name ?? null,
                organizer_website: org.website ?? null,
                domain,
                emails: emails.slice(0, 3),
              };
            }
          } catch (e) {
            row.api = { status: "error", detail: String(e).slice(0, 120) };
          }
        }
      }

      // ---- B) Browser render
      if (mode !== "api" && fcKey) {
        try {
          const page = await fcScrape(fcKey, url, ["links", "markdown"]);
          if ((page as { error?: string }).error) {
            row.render = { status: "fetch_failed", detail: (page as { error: string }).error };
          } else {
            const links: string[] = (page as { links?: string[] }).links ?? [];
            const md: string = (page as { markdown?: string }).markdown ?? "";
            let domain = links.map(usable).find(Boolean) ?? null;
            const emails = [...md.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)]
              .map((m) => m[0])
              .filter((e) => !/eventbrite|sentry|example/i.test(e));
            let via = domain ? "event_page" : null;
            const orgLink = links.find((l) => /eventbrite\.[a-z.]+\/o\//i.test(l));
            if (!domain && orgLink) {
              const op = await fcScrape(fcKey, orgLink.split("?")[0], ["links", "markdown"]);
              const olinks: string[] = (op as { links?: string[] }).links ?? [];
              domain = olinks.map(usable).find(Boolean) ?? null;
              if (domain) via = "organizer_profile";
              const omd: string = (op as { markdown?: string }).markdown ?? "";
              for (const m of omd.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) {
                if (!/eventbrite|sentry/i.test(m[0])) emails.push(m[0]);
              }
            }
            row.render = {
              status: "ok",
              organizer_profile: orgLink ?? null,
              domain,
              via,
              emails: [...new Set(emails)].slice(0, 3),
            };
          }
        } catch (e) {
          row.render = { status: "error", detail: String(e).slice(0, 120) };
        }
      }

      out.push(row);
    }

    // Persist API-resolved organizer domains (apply mode only).
    let persisted = 0;
    if (body.apply === true) {
      const rows = out
        .filter((r) => (r.api as { domain?: string })?.domain)
        .map((r) => ({
          opportunity_id: r.id as string,
          aggregator: "eventbrite",
          aggregator_url: r.event_url as string,
          resolved_domain: (r.api as { domain: string }).domain,
          resolved_at: new Date().toISOString(),
        }));
      if (rows.length) {
        await supabase
          .from("aggregator_domain_resolution_20260821")
          .upsert(rows, { onConflict: "opportunity_id" });
        persisted = rows.length;
      }
      // Fill organizer_name only where it is currently empty.
      for (const r of out) {
        const name = (r.api as { organizer_name?: string })?.organizer_name;
        if (!name) continue;
        await supabase
          .from("opportunities")
          .update({ organizer_name: name })
          .eq("id", r.id as string)
          .is("organizer_name", null);
      }
    }

    const apiWins = out.filter((r) => (r.api as { domain?: string })?.domain).length;
    const renderWins = out.filter((r) => (r.render as { domain?: string })?.domain).length;
    const apiStatuses: Record<string, number> = {};
    for (const r of out) {
      const s = String((r.api as { status?: string })?.status ?? "skipped");
      apiStatuses[s] = (apiStatuses[s] ?? 0) + 1;
    }

    return new Response(
      JSON.stringify({
        tested: out.length,
        api_domains: apiWins,
        render_domains: renderWins,
        api_statuses: apiStatuses,
        persisted,
        domains: [
          ...new Set(
            out
              .map((r) => (r.api as { domain?: string })?.domain)
              .filter(Boolean) as string[],
          ),
        ],
        results: body.summary_only === true ? undefined : out,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
