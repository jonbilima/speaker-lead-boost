import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same model and key as generate-pitch (do not diverge).
const XAI_MODEL = "grok-4.20-non-reasoning";

// Identical system prompt across calls so xAI prompt caching can reuse the prefix.
const SYSTEM_PROMPT = `You are an expert at writing personalized, professional cover messages for speaker application packages. 
Your messages should:
- Be warm but professional
- Reference specific details about the event when available
- Highlight why the speaker would be a great fit
- Be concise (2-3 paragraphs max)
- End with a call to action inviting them to review the package
- NOT include placeholders like [Your Name] - use the actual speaker name provided`;

// Graceful fallback so a user is never blocked when xAI fails.
function fallbackCoverMessage(speakerName: string, eventName: string, organizerName: string) {
  const name = speakerName || "the speaker";
  const event = eventName || "your event";
  const organizer = organizerName ? ` ${organizerName},` : "";
  return `Hi${organizer}

I'd love to be considered as a speaker for ${event}. I've put together a complete application package below — including my headshot, bio, and sample sessions — so you can quickly see whether I'd be a strong fit for your audience.

Please take a look, and I'm happy to answer any questions or adjust anything to match your needs.

Best regards,
${name}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventName, eventDescription, organizerName, speakerName, speakerBio, speakerHeadline } = await req.json();

    const xaiApiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiApiKey) {
      // Graceful fallback instead of a hard error.
      return new Response(JSON.stringify({
        coverMessage: fallbackCoverMessage(speakerName, eventName, organizerName),
        fallback: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Same fetch style + Authorization header pattern as generate-pitch.
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${xaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("xAI error:", response.status, errorText.slice(0, 300));
      const message = response.status === 429
        ? "Too many requests right now — try again in a moment."
        : response.status === 401 || response.status === 403
        ? "AI credits are exhausted for this workspace — top up AI credits to use AI generation."
        : `AI service error (${response.status}).`;
      // Graceful fallback: return a usable cover message, flagged, instead of a hard error.
      return new Response(JSON.stringify({
        coverMessage: fallbackCoverMessage(speakerName, eventName, organizerName),
        fallback: true,
        reason: message,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("xAI usage:", JSON.stringify(data.usage ?? {}));
    const coverMessage = data.choices?.[0]?.message?.content || "";
    if (!coverMessage) {
      // Graceful fallback on empty AI response.
      return new Response(JSON.stringify({
        coverMessage: fallbackCoverMessage(speakerName, eventName, organizerName),
        fallback: true,
        reason: "AI returned an empty message.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ coverMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating cover message:", error);
    // Graceful fallback on any unexpected failure.
    try {
      const body = await req.clone().json().catch(() => ({}));
      return new Response(JSON.stringify({
        coverMessage: fallbackCoverMessage(body?.speakerName, body?.eventName, body?.organizerName),
        fallback: true,
        reason: error instanceof Error ? error.message : "Unknown error",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
});
