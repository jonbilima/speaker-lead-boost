const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventHistory {
  event_name: string;
  topics: string[];
  fee_estimate_min?: number;
  fee_estimate_max?: number;
  event_date?: string | null;
  location?: string | null;
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
  speakerName?: string | null;
  speakerHeadline?: string | null;
  speakerBio?: string | null;
}

function fallback(relevantTopics: string[], reason: string) {
  return {
    fallback: true,
    reason,
    suggestedAngle:
      "Position yourself as an expert who can deliver measurable value to this organizer's specific audience.",
    talkingPoints: [
      "Reference their past events to show you've done your research",
      "Highlight your relevant experience in their key topics",
      "Mention your flexibility on format and delivery",
      "Offer a specific talk title or theme that fits their events",
    ],
    relevantTopics,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let relevantTopics: string[] = [];

  try {
    const body: RequestBody = await req.json();
    const {
      organizerName,
      organizationName,
      eventHistory = [],
      speakersBooked = [],
      insights,
      userTopics = [],
      speakerName,
      speakerHeadline,
      speakerBio,
    } = body;

    const safeInsights: BookingInsights = insights ?? {
      budgetTier: "Unknown",
      budgetRange: "",
      topTopics: [],
      preferredExperience: "",
      bookingTimeline: "",
    };
    const topTopics = safeInsights.topTopics ?? [];

    const eventContext = eventHistory.length > 0
      ? `They've organized events like: ${
        eventHistory
          .map((e) =>
            `${e.event_name}${e.event_date ? ` (${e.event_date})` : ""}${e.location ? ` in ${e.location}` : ""}`
          )
          .join("; ")
      }.`
      : "No event history is available in our database for this organizer.";

    const topicContext = topTopics.length > 0
      ? `Their most booked topics are: ${topTopics.map((t) => `${t.name} (${t.count} events)`).join(", ")}.`
      : "";

    const speakerContext = speakersBooked.length > 0
      ? `They've previously booked speakers like: ${speakersBooked.map((s) => s.speaker_name).join(", ")}.`
      : "";

    const budgetContext = safeInsights.budgetTier !== "Unknown"
      ? `Budget: ${safeInsights.budgetTier} tier (${safeInsights.budgetRange}).`
      : "";

    const userTopicsContext = userTopics.length > 0
      ? `The speaker's expertise includes: ${userTopics.join(", ")}.`
      : "The speaker has not listed topics yet — infer likely angles from their bio and headline.";

    const speakerContextBlock = [
      speakerName ? `Speaker name: ${speakerName}` : "",
      speakerHeadline ? `Speaker headline: ${speakerHeadline}` : "",
      speakerBio ? `Speaker bio: ${speakerBio.slice(0, 800)}` : "",
    ].filter(Boolean).join("\n");

    const organizerTopics = new Set(topTopics.map((t) => t.name.toLowerCase()));
    relevantTopics = userTopics.filter((t) =>
      organizerTopics.has(t.toLowerCase()) ||
      topTopics.some((ot) =>
        ot.name.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(ot.name.toLowerCase())
      )
    );

    const prompt =
      `You are helping a professional speaker craft an approach strategy for reaching out to an event organizer.

Organizer: ${organizerName}${organizationName ? ` at ${organizationName}` : ""}

${eventContext}
${topicContext}
${speakerContext}
${budgetContext}
${userTopicsContext}
${speakerContextBlock}

Even when data is thin, give concrete, non-generic advice grounded in whatever signals exist (organization name, event names, sector, timing).

Provide:
1. A suggested pitch angle (1-2 sentences) that positions the speaker as a great fit
2. 3-5 specific talking points they should mention in their outreach
3. Which of the speaker's topics are most relevant to this organizer

Respond ONLY with JSON in this shape:
{"suggestedAngle":"string","talkingPoints":["string"],"relevantTopics":["string"]}`;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify(fallback(relevantTopics, "AI key not configured")), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      const reason = response.status === 429
        ? "Rate limit reached, please try again shortly"
        : response.status === 402
        ? "AI credits exhausted"
        : `AI gateway error ${response.status}`;
      return new Response(JSON.stringify(fallback(relevantTopics, reason)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content: string | undefined = aiResult.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify(fallback(relevantTopics, "Empty AI response")), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let strategy: Record<string, unknown>;
    try {
      strategy = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      strategy = match ? JSON.parse(match[0]) : {};
    }

    const out = {
      fallback: false,
      suggestedAngle: typeof strategy.suggestedAngle === "string" ? strategy.suggestedAngle : "",
      talkingPoints: Array.isArray(strategy.talkingPoints) ? strategy.talkingPoints : [],
      relevantTopics: Array.isArray(strategy.relevantTopics) && strategy.relevantTopics.length > 0
        ? strategy.relevantTopics
        : relevantTopics,
    };

    if (!out.suggestedAngle && out.talkingPoints.length === 0) {
      return new Response(JSON.stringify(fallback(relevantTopics, "AI returned no usable content")), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating organizer strategy:", error);
    return new Response(
      JSON.stringify(fallback(relevantTopics, error instanceof Error ? error.message : "Unknown error")),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
