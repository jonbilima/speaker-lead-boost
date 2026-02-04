import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FilterState {
  industries: string[];
  types: string[];
  feeRanges: string[];
  deadlines: string[];
  search: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all saved searches with notifications enabled
    const { data: savedSearches, error: searchError } = await supabase
      .from("saved_searches")
      .select("*, profiles(email, full_name)")
      .eq("notify_new_matches", true);

    if (searchError) throw searchError;

    console.log(`Found ${savedSearches?.length || 0} saved searches with notifications enabled`);

    const results = [];

    for (const search of savedSearches || []) {
      const filters = search.filters as FilterState;
      const lastNotified = search.last_notified_at || search.created_at;

      // Build query for matching opportunities
      let query = supabase
        .from("opportunities")
        .select("id, event_name")
        .eq("is_active", true)
        .gt("created_at", lastNotified);

      // Apply fee range filter
      if (filters.feeRanges && filters.feeRanges.length > 0) {
        const feeConditions = filters.feeRanges.map((range: string) => {
          if (range === "$1-3k") return "fee_estimate_max.gte.1000,fee_estimate_max.lte.3000";
          if (range === "$3-5k") return "fee_estimate_max.gt.3000,fee_estimate_max.lte.5000";
          if (range === "$5-10k") return "fee_estimate_max.gt.5000,fee_estimate_max.lte.10000";
          if (range === "$10k+") return "fee_estimate_max.gt.10000";
          return null;
        }).filter(Boolean);

        // Apply first fee condition (simplified - full implementation would use OR)
        const firstCondition = feeConditions[0];
        if (firstCondition) {
          const [min, max] = firstCondition.split(",");
          if (min && min.includes("gte")) {
            query = query.gte("fee_estimate_max", parseInt(min.split(".")[2]));
          }
          if (max && max.includes("lte")) {
            query = query.lte("fee_estimate_max", parseInt(max.split(".")[2]));
          }
        }
      }

      // Apply search filter
      if (filters.search) {
        query = query.or(`event_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data: newOpportunities, error: oppError } = await query;

      if (oppError) {
        console.error(`Error querying for search ${search.id}:`, oppError);
        continue;
      }

      const matchCount = newOpportunities?.length || 0;

      if (matchCount > 0) {
        console.log(`Found ${matchCount} new matches for search "${search.name}"`);

        // Send notification email
        const profile = search.profiles;
        if (profile?.email) {
          try {
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            if (resendApiKey) {
              const oppList = newOpportunities
                .slice(0, 5)
                .map((o: any) => `• ${o.event_name}`)
                .join("\n");

              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify({
                  from: "NextMic <notifications@nextmic.io>",
                  to: profile.email,
                  subject: `${matchCount} new opportunities match "${search.name}"`,
                  html: `
                    <h2>New Opportunities Found!</h2>
                    <p>Hi ${profile.full_name || "there"},</p>
                    <p>Your saved search "<strong>${search.name}</strong>" found ${matchCount} new matching opportunities:</p>
                    <pre style="background: #f5f5f5; padding: 16px; border-radius: 8px;">${oppList}</pre>
                    ${matchCount > 5 ? `<p>...and ${matchCount - 5} more</p>` : ""}
                    <p><a href="${Deno.env.get("SITE_URL") || "https://nextmic.io"}/find">View all matches →</a></p>
                  `,
                }),
              });
            }
          } catch (emailError) {
            console.error("Failed to send notification email:", emailError);
          }
        }

        // Update last notified timestamp
        await supabase
          .from("saved_searches")
          .update({ last_notified_at: new Date().toISOString() })
          .eq("id", search.id);

        results.push({
          searchId: search.id,
          searchName: search.name,
          newMatches: matchCount,
          notified: true,
        });
      }

      // Update results count
      const { count } = await supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      await supabase
        .from("saved_searches")
        .update({ results_count: count || 0 })
        .eq("id", search.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedSearches: savedSearches?.length || 0,
        notificationsSent: results.filter((r) => r.notified).length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error checking saved search matches:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
