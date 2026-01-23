const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventHistory {
  event_name: string;
  topics: string[];
  fee_estimate_min?: number;
  fee_estimate_max?: number;
}

interface SpeakerBooked {
  speaker_name: string;
  event_name: string;
}

interface BookingInsights {
  budgetTier: string;
  budgetRange: string;
  topTopics: { name: string; count: number }[];
  preferredExperience: string;
  bookingTimeline: string;
}

interface RequestBody {
  organizerName: string;
  organizationName: string | null;
  eventHistory: EventHistory[];
  speakersBooked: SpeakerBooked[];
  insights: BookingInsights;
  userTopics: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { organizerName, organizationName, eventHistory, speakersBooked, insights, userTopics } = body;

    // Build context for AI
    const eventContext = eventHistory.length > 0
      ? `They've organized events like: ${eventHistory.map(e => e.event_name).join(", ")}.`
      : "";

    const topicContext = insights.topTopics.length > 0
      ? `Their most booked topics are: ${insights.topTopics.map(t => `${t.name} (${t.count} events)`).join(", ")}.`
      : "";

    const speakerContext = speakersBooked.length > 0
      ? `They've previously booked speakers like: ${speakersBooked.map(s => s.speaker_name).join(", ")}.`
      : "";

    const budgetContext = insights.budgetTier !== "Unknown"
      ? `Budget: ${insights.budgetTier} tier (${insights.budgetRange}).`
      : "";

    const userTopicsContext = userTopics.length > 0
      ? `The speaker's expertise includes: ${userTopics.join(", ")}.`
      : "";

    // Find topic overlaps
    const organizerTopics = new Set(insights.topTopics.map(t => t.name.toLowerCase()));
    const relevantTopics = userTopics.filter(t => 
      organizerTopics.has(t.toLowerCase()) || 
      insights.topTopics.some(ot => ot.name.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(ot.name.toLowerCase()))
    );

    const prompt = `You are helping a professional speaker craft an approach strategy for reaching out to an event organizer.

Organizer: ${organizerName}${organizationName ? ` at ${organizationName}` : ""}

${eventContext}
${topicContext}
${speakerContext}
${budgetContext}
${userTopicsContext}

Based on this information, provide:
1. A suggested pitch angle (1-2 sentences) that positions the speaker as a great fit
2. 3-5 specific talking points they should mention in their outreach
3. Which of the speaker's topics are most relevant to this organizer

Respond in JSON format:
{
  "suggestedAngle": "string",
  "talkingPoints": ["string", "string", ...],
  "relevantTopics": ["string", ...]
}`;

    // Use Lovable AI endpoint
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch("https://api.lovable.dev/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    const strategy = JSON.parse(content);

    // Ensure relevantTopics includes overlaps we found
    if (relevantTopics.length > 0 && (!strategy.relevantTopics || strategy.relevantTopics.length === 0)) {
      strategy.relevantTopics = relevantTopics;
    }

    return new Response(JSON.stringify(strategy), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating organizer strategy:", error);
    
    // Return fallback response
    return new Response(
      JSON.stringify({
        suggestedAngle: "Position yourself as an expert who can deliver value to their specific audience.",
        talkingPoints: [
          "Reference their past events to show you've done your research",
          "Highlight your relevant experience in their key topics",
          "Mention your flexibility on format and delivery",
          "Offer a specific talk title or theme that fits their events"
        ],
        relevantTopics: []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
