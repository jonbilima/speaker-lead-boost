import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlApiKey) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log("Extracting opportunity from URL:", url);

    // Scrape the URL
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      throw new Error(`Failed to scrape URL: ${scrapeData.error || "Unknown error"}`);
    }

    const markdown = scrapeData.data?.markdown || "";
    const metadata = scrapeData.data?.metadata || {};

    if (!markdown) {
      return new Response(
        JSON.stringify({ success: false, error: "No content found at URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI to extract structured information
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting speaking opportunity information from web pages. 
Extract the following fields if present. Return ONLY valid JSON, no markdown or explanations.

Required format:
{
  "event_name": "string - the name of the event or conference",
  "organizer_name": "string or null - organization or person running it",
  "organizer_email": "string or null - contact email if found",
  "deadline": "string or null - CFP/submission deadline in YYYY-MM-DD format",
  "event_date": "string or null - event date in YYYY-MM-DD format",
  "event_end_date": "string or null - event end date if multi-day",
  "location": "string or null - city, venue, or 'Virtual'",
  "audience_size": "number or null - expected attendees",
  "description": "string - brief description of the opportunity (max 500 chars)",
  "topics": ["array", "of", "topic", "strings"],
  "fee_estimate_min": "number or null - speaker fee if mentioned",
  "fee_estimate_max": "number or null - speaker fee if mentioned",
  "covers_travel": "boolean or null",
  "covers_accommodation": "boolean or null"
}`,
          },
          {
            role: "user",
            content: `Extract speaking opportunity details from this page content:\n\nPage Title: ${metadata.title || "Unknown"}\n\n${markdown.slice(0, 8000)}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI extraction failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON from AI response
    let extracted;
    try {
      // Remove any markdown code blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      // Return basic info from metadata
      extracted = {
        event_name: metadata.title || "Unknown Event",
        description: metadata.description || null,
      };
    }

    console.log("Extracted opportunity:", extracted);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...extracted,
          event_url: url,
          source: "manual",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error extracting opportunity:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});