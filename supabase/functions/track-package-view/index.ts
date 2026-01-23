import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash IP address for privacy (one-way hash)
async function hashIp(ip: string): Promise<string> {
  const salt = "nextmic-analytics-v1"; // Static salt for consistent hashing
  const data = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// Extract device type from user agent (no fingerprinting)
function getDeviceType(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  if (/mobile/i.test(userAgent)) return "mobile";
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  return "desktop";
}

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

    // Privacy-preserving analytics
    const userAgent = req.headers.get("user-agent");
    const forwardedFor = req.headers.get("x-forwarded-for");
    const rawIp = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
    
    // Hash IP instead of storing raw (for deduplication only)
    const hashedIp = rawIp ? await hashIp(rawIp) : null;
    
    // Store device type instead of full user agent (privacy-preserving)
    const deviceType = getDeviceType(userAgent);

    // Insert the view event with anonymized data
    const { error } = await supabase.from("package_views").insert({
      package_id: packageId,
      event_type: eventType,
      viewer_ip: hashedIp, // Hashed, not raw IP
      user_agent: deviceType, // Device type only, not full UA
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
