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
    const { eventName, eventDescription, organizerName, speakerName, speakerBio, speakerHeadline } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert at writing personalized, professional cover messages for speaker application packages. 
Your messages should:
- Be warm but professional
- Reference specific details about the event when available
- Highlight why the speaker would be a great fit
- Be concise (2-3 paragraphs max)
- End with a call to action inviting them to review the package
- NOT include placeholders like [Your Name] - use the actual speaker name provided`;

    const userPrompt = `Write a personalized cover message for a speaker application package.

Event Details:
- Event Name: ${eventName || "Not specified"}
- Event Description: ${eventDescription || "Not provided"}
- Organizer: ${organizerName || "Not specified"}

Speaker Details:
- Name: ${speakerName || "Speaker"}
- Headline: ${speakerHeadline || "Professional Speaker"}
- Bio: ${speakerBio || "An experienced speaker"}

Create a warm, personalized message that introduces the speaker and invites the organizer to review their application package.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const coverMessage = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ coverMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating cover message:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
