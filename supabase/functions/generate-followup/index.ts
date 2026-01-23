import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { opportunity_id, reminder_type } = await req.json();
    if (!opportunity_id) {
      throw new Error("Missing opportunity_id");
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, bio, linkedin_url, twitter_url")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    // Fetch opportunity details
    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .select("event_name, organizer_name, organizer_email, description, event_date, location")
      .eq("id", opportunity_id)
      .single();

    if (oppError) throw oppError;

    // Fetch the original pitch if it exists
    const { data: originalPitch } = await supabase
      .from("pitches")
      .select("subject_line, email_body")
      .eq("opportunity_id", opportunity_id)
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    // Determine follow-up number for messaging
    const followUpNumber = reminder_type === "first" ? 1 : reminder_type === "second" ? 2 : 3;
    const followUpLabel = followUpNumber === 1 ? "first" : followUpNumber === 2 ? "second" : "final";

    const prompt = `You are a professional speaking coach helping a speaker write a ${followUpLabel} follow-up email.

SPEAKER INFO:
- Name: ${profile?.name || "Speaker"}
- Bio: ${profile?.bio || "Professional speaker"}
${profile?.linkedin_url ? `- LinkedIn: ${profile.linkedin_url}` : ""}

OPPORTUNITY INFO:
- Event: ${opportunity.event_name}
- Organizer: ${opportunity.organizer_name || "Event Organizer"}
- Event Date: ${opportunity.event_date || "TBD"}
- Location: ${opportunity.location || "TBD"}

${originalPitch ? `ORIGINAL PITCH SUBJECT: ${originalPitch.subject_line}` : ""}

FOLLOW-UP NUMBER: ${followUpNumber} of 3

INSTRUCTIONS:
Write a polite, professional follow-up email that:
1. References the original application/pitch without being pushy
2. Adds value by mentioning something relevant (a recent talk, article, or industry trend)
3. Is brief and respectful of their time
4. Has an appropriate tone for follow-up #${followUpNumber}:
   - Follow-up 1: Friendly check-in, express continued interest
   - Follow-up 2: Add more value, perhaps share a relevant resource
   - Follow-up 3: Final, gracious note leaving the door open

Return a JSON object with:
{
  "subject_line": "Brief, friendly follow-up subject",
  "email_body": "The complete email text"
}

Return ONLY valid JSON, no markdown.`;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.lovable.dev/v0/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content from AI");
    }

    // Parse the JSON response
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI response");
    }

    return new Response(
      JSON.stringify({
        success: true,
        followup: {
          subject_line: parsed.subject_line,
          email_body: parsed.email_body,
          reminder_type,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
