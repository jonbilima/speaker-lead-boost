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
    const { packageId, eventType } = await req.json();

    if (!packageId || !eventType) {
      throw new Error("Missing packageId or eventType");
    }

    const validEventTypes = ['opened', 'bio_viewed', 'headshot_downloaded', 'one_sheet_downloaded', 'video_played', 'contact_clicked'];
    if (!validEventTypes.includes(eventType)) {
      throw new Error("Invalid event type");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get viewer info from headers
    const userAgent = req.headers.get("user-agent") || null;
    const forwardedFor = req.headers.get("x-forwarded-for");
    const viewerIp = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

    // Insert the view event
    const { error } = await supabase.from("package_views").insert({
      package_id: packageId,
      event_type: eventType,
      viewer_ip: viewerIp,
      user_agent: userAgent,
    });

    if (error) {
      console.error("Error inserting package view:", error);
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error tracking package view:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
