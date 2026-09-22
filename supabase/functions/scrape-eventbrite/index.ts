import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { validateAuth, unauthorizedResponse, forbiddenResponse, corsHeaders, isInternalServiceCall } from "../_shared/auth.ts";

// Eventbrite retired the public /v3/events/search/ endpoint for third-party
// tokens (it now answers 404 NOT_FOUND for every query), and /v3/organizers/
// {id}/events/ returns an empty list for organizers the token does not own.
// Discovery therefore happens against Eventbrite's public search pages via
// Firecrawl; each discovered event is then hydrated through the still-working
// /v3/events/{id}/ detail endpoint so the stored record holds real API data.

const SEARCH_PAGES = [
  "https://www.eventbrite.com/d/online/call-for-speakers/",
  "https://www.eventbrite.com/d/united-states/call-for-speakers/",
  "https://www.eventbrite.com/d/online/call-for-proposals/",
  "https://www.eventbrite.com/d/united-states/speaker-conference/",
];

const MAX_EVENTS_PER_RUN = 40;

interface DiscoveryOutcome {
  page: string;
  urls: string[];
  error?: string;
}

function eventIdFrom(url: string): string | null {
  const m = url.match(/-(\d{9,})(?:\?|$|\/)/) ?? url.match(/(\d{9,})/);
  return m ? m[1] : null;
}

function cleanUrl(url: string): string {
  return url.split("?")[0];
}

async function discover(firecrawlKey: string, page: string): Promise<DiscoveryOutcome> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: page, formats: ["links"], onlyMainContent: false, waitFor: 3000 }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { page, urls: [], error: `Firecrawl ${res.status}: ${JSON.stringify(json).slice(0, 200)}` };
    }
    const data = (json as { data?: { links?: string[] } }).data ?? (json as { links?: string[] });
    const links: string[] = (data as { links?: string[] }).links ?? [];
    const urls = [...new Set(
      links.filter((l) => /eventbrite\.com\/e\//i.test(l)).map(cleanUrl),
    )];
    if (urls.length === 0) {
      return { page, urls: [], error: "No event links found on search page (layout may have changed)" };
    }
    return { page, urls };
  } catch (e) {
    return { page, urls: [], error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authentication and require admin role
  const internal = isInternalServiceCall(req);
  const auth = internal ? { user: { id: 'internal' }, error: null, isAdmin: true } : await validateAuth(req);
  if (auth.error || !auth.user) {
    return unauthorizedResponse(auth.error || 'Unauthorized');
  }
  if (!auth.isAdmin) {
    return forbiddenResponse('Admin access required to run scraping functions');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const eventbriteKey = Deno.env.get('EVENTBRITE_API_KEY');
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!eventbriteKey || !firecrawlKey) {
    const missing = [!eventbriteKey && 'EVENTBRITE_API_KEY', !firecrawlKey && 'FIRECRAWL_API_KEY']
      .filter(Boolean).join(', ');
    await supabase.from('scraping_logs').insert({
      source: 'eventbrite',
      status: 'failed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      opportunities_found: 0,
      opportunities_inserted: 0,
      opportunities_updated: 0,
      error_message: `${missing} not configured`,
    });
    return new Response(
      JSON.stringify({ error: `${missing} not configured` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let logId: string | null = null;

  try {
    console.log('Starting Eventbrite scraping...');

    const { data: logData, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        source: 'eventbrite',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) throw logError;
    logId = logData.id;

    // ---- 1. Discover event URLs from Eventbrite's public search pages
    const outcomes: DiscoveryOutcome[] = [];
    for (const page of SEARCH_PAGES) {
      const outcome = await discover(firecrawlKey, page);
      outcomes.push(outcome);
      console.log(`${page}: ${outcome.urls.length} links${outcome.error ? ` (${outcome.error})` : ''}`);
      await new Promise((r) => setTimeout(r, 500));
    }

    const discoveryErrors = outcomes.filter((o) => o.error);
    const candidateUrls = [...new Set(outcomes.flatMap((o) => o.urls))].slice(0, MAX_EVENTS_PER_RUN);

    // Every search page failed or produced nothing -> this is a failure, not a clean run.
    if (candidateUrls.length === 0) {
      const message = `Eventbrite discovery returned zero events across all ${SEARCH_PAGES.length} search pages. ` +
        discoveryErrors.map((o) => `${o.page} -> ${o.error}`).join(' | ');
      await supabase
        .from('scraping_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          opportunities_found: 0,
          opportunities_inserted: 0,
          opportunities_updated: 0,
          error_message: message.slice(0, 2000),
        })
        .eq('id', logId);

      return new Response(
        JSON.stringify({ success: false, found: 0, inserted: 0, updated: 0, error: message }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- 2. Hydrate each event through the Eventbrite detail API
    let inserted = 0;
    let updated = 0;
    let hydrated = 0;
    let apiFailures = 0;
    let lastApiError: string | null = null;

    for (const url of candidateUrls) {
      const eid = eventIdFrom(url);
      if (!eid) continue;

      try {
        const res = await fetch(
          `https://www.eventbriteapi.com/v3/events/${eid}/?expand=organizer,venue`,
          { headers: { Authorization: `Bearer ${eventbriteKey}` } },
        );
        const event = await res.json().catch(() => ({}));
        if (!res.ok) {
          apiFailures++;
          lastApiError = `event ${eid}: HTTP ${res.status} ${String((event as { error?: string })?.error ?? '').slice(0, 60)}`;
          continue;
        }
        hydrated++;

        const eventUrl = cleanUrl((event as { url?: string }).url ?? url);

        const { data: existing } = await supabase
          .from('opportunities')
          .select('id')
          .eq('event_url', eventUrl)
          .maybeSingle();

        // Location from the expanded venue
        let location: string | null = null;
        const venue = (event as { venue?: { address?: Record<string, string> } }).venue;
        if (venue?.address) {
          const parts = [venue.address.city, venue.address.region, venue.address.country].filter(Boolean);
          location = parts.join(', ') || null;
        }
        if (!location && (event as { online_event?: boolean }).online_event) location = 'Online';

        const start = (event as { start?: { utc?: string; local?: string } }).start;
        const organizer = (event as { organizer?: { name?: string } }).organizer;
        const description = (event as { description?: { text?: string }; summary?: string }).description?.text
          ?? (event as { summary?: string }).summary ?? null;

        const opportunityData = {
          event_name: (event as { name?: { text?: string } }).name?.text || 'Unnamed Event',
          event_url: eventUrl,
          // Eventbrite always states an explicit start timestamp; never invent one.
          deadline: start?.utc ? new Date(start.utc).toISOString() : null,
          location,
          description,
          organizer_name: organizer?.name ?? null,
          organizer_email: null, // not provided by the API
          event_date: start?.local ? new Date(start.local).toISOString() : null,
          audience_size: (event as { capacity?: number }).capacity ?? null,
          fee_estimate_min: null,
          fee_estimate_max: null,
          source: 'eventbrite',
          scraped_at: new Date().toISOString(),
          is_active: true,
        };

        if (existing) {
          await supabase
            .from('opportunities')
            .update({ scraped_at: new Date().toISOString() })
            .eq('id', existing.id);
          updated++;
        } else {
          await supabase.from('opportunities').insert(opportunityData);
          inserted++;
        }
      } catch (error) {
        apiFailures++;
        lastApiError = error instanceof Error ? error.message : String(error);
        console.error(`Error processing event ${eid}:`, error);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    // Discovery worked but nothing could be hydrated -> failure, not a clean run.
    const zeroResult = hydrated === 0;
    const warnings: string[] = [];
    if (discoveryErrors.length) {
      warnings.push(`${discoveryErrors.length}/${SEARCH_PAGES.length} search pages failed`);
    }
    if (apiFailures) warnings.push(`${apiFailures} event lookups failed (last: ${lastApiError})`);

    await supabase
      .from('scraping_logs')
      .update({
        status: zeroResult ? 'failed' : (discoveryErrors.length ? 'partial' : 'success'),
        completed_at: new Date().toISOString(),
        opportunities_found: hydrated,
        opportunities_inserted: inserted,
        opportunities_updated: updated,
        error_message: zeroResult
          ? `Discovered ${candidateUrls.length} event links but hydrated none. ${warnings.join('; ')}`.slice(0, 2000)
          : (warnings.length ? warnings.join('; ').slice(0, 2000) : null),
      })
      .eq('id', logId);

    console.log(`Eventbrite scraping complete: ${inserted} inserted, ${updated} updated`);

    return new Response(
      JSON.stringify({
        success: !zeroResult,
        discovered: candidateUrls.length,
        found: hydrated,
        inserted,
        updated,
        warnings,
      }),
      {
        status: zeroResult ? 502 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Eventbrite scraping error:', error);

    if (logId) {
      await supabase
        .from('scraping_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
