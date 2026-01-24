import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Meetup's public GraphQL endpoint
const MEETUP_GRAPHQL_URL = "https://www.meetup.com/gql";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log the scraping attempt
    const { data: log } = await supabase
      .from("scraping_logs")
      .insert({
        source: "meetup",
        status: "running",
      })
      .select()
      .single();

    console.log("Starting Meetup scrape via Firecrawl...");

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlApiKey) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    // Search for speaking/presentation events via Firecrawl search
    const searchQueries = [
      "call for speakers meetup 2025",
      "seeking keynote speaker conference 2025",
      "submit speaker proposal event 2025",
    ];

    const opportunities: Array<{
      event_name: string;
      event_url: string;
      description: string | null;
      location: string | null;
      event_date: string | null;
    }> = [];

    for (const query of searchQueries) {
      try {
        const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `site:meetup.com ${query}`,
            limit: 10,
          }),
        });

        const searchData = await searchResponse.json();

        if (searchResponse.ok && searchData.data) {
          for (const result of searchData.data) {
            // Skip if not a meetup event page
            if (!result.url?.includes("meetup.com/")) continue;
            if (result.url?.includes("/members/") || result.url?.includes("/about/")) continue;

            opportunities.push({
              event_name: result.title || "Meetup Event",
              event_url: result.url,
              description: result.description?.slice(0, 500) || null,
              location: null,
              event_date: null,
            });
          }
        }
      } catch (e) {
        console.error(`Search failed for query: ${query}`, e);
      }

      // Rate limit between searches
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Deduplicate by URL
    const uniqueOpps = opportunities.filter(
      (opp, index, self) => index === self.findIndex((o) => o.event_url === opp.event_url)
    );

    console.log(`Found ${uniqueOpps.length} unique Meetup opportunities`);

    // Insert opportunities
    let inserted = 0;
    let updated = 0;

    for (const opp of uniqueOpps) {
      const { data: existing } = await supabase
        .from("opportunities")
        .select("id")
        .eq("event_url", opp.event_url)
        .single();

      if (existing) {
        updated++;
      } else {
        const { error: insertError } = await supabase
          .from("opportunities")
          .insert({
            event_name: opp.event_name,
            event_url: opp.event_url,
            description: opp.description,
            location: opp.location,
            event_date: opp.event_date,
            source: "meetup",
            is_active: true,
            is_verified: false,
            scraped_at: new Date().toISOString(),
          });

        if (!insertError) {
          inserted++;
        }
      }
    }

    // Update log
    if (log) {
      await supabase
        .from("scraping_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          opportunities_found: uniqueOpps.length,
          opportunities_inserted: inserted,
          opportunities_updated: updated,
        })
        .eq("id", log.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: uniqueOpps.length,
        inserted,
        updated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scraping Meetup:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});