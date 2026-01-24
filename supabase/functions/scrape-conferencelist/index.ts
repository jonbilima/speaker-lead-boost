import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlApiKey) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log the scraping attempt
    const { data: log, error: logError } = await supabase
      .from("scraping_logs")
      .insert({
        source: "conferencelist",
        status: "running",
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create log:", logError);
    }

    console.log("Starting conferencelist.io scrape...");

    // Scrape the CFP page
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://conferencelist.io",
        formats: ["markdown", "links"],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      throw new Error(`Firecrawl error: ${scrapeData.error || "Unknown error"}`);
    }

    console.log("Scraped conferencelist.io, found links:", scrapeData.data?.links?.length || 0);

    // Parse the markdown to extract conference information
    const markdown = scrapeData.data?.markdown || "";
    const links = scrapeData.data?.links || [];

    // Simple extraction of conference-like patterns
    // Format: Conference Name - Date - Location - CFP Deadline
    const conferencePattern = /#{2,3}\s*\[?([^\]\n]+)\]?[^\n]*\n(?:.*?(?:deadline|cfp|submit).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s*\d{4}))?/gi;
    
    const opportunities: Array<{
      event_name: string;
      deadline: string | null;
      event_url: string | null;
      location: string | null;
      source: string;
    }> = [];

    // Extract CFP-related links
    const cfpLinks = links.filter((link: string) => 
      link.includes("cfp") || 
      link.includes("call-for") ||
      link.includes("speaker") ||
      link.includes("submit")
    );

    // For each CFP link, try to extract event name from URL
    for (const link of cfpLinks.slice(0, 20)) { // Limit to 20 to avoid rate limits
      try {
        const urlParts = new URL(link);
        const pathParts = urlParts.pathname.split("/").filter(Boolean);
        const eventName = pathParts
          .filter(p => !["cfp", "call-for-papers", "submit", "speakers"].includes(p.toLowerCase()))
          .map(p => p.replace(/-/g, " "))
          .map(p => p.charAt(0).toUpperCase() + p.slice(1))
          .join(" ");

        if (eventName && eventName.length > 3) {
          opportunities.push({
            event_name: eventName,
            deadline: null,
            event_url: link,
            location: null,
            source: "conferencelist",
          });
        }
      } catch (e) {
        // Skip invalid URLs
      }
    }

    console.log(`Extracted ${opportunities.length} potential opportunities`);

    // Insert or update opportunities
    let inserted = 0;
    let updated = 0;

    for (const opp of opportunities) {
      // Check if exists by URL
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
            deadline: opp.deadline,
            location: opp.location,
            source: "conferencelist",
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
          opportunities_found: opportunities.length,
          opportunities_inserted: inserted,
          opportunities_updated: updated,
        })
        .eq("id", log.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: opportunities.length,
        inserted,
        updated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scraping conferencelist:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});