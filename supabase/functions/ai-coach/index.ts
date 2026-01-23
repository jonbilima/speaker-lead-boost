import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_TIER_LIMIT = 20;

const COACHING_MODES: Record<string, string> = {
  "review-pitch": `You are an expert speaking coach reviewing pitch emails. Analyze the pitch for:
- Subject line effectiveness
- Opening hook strength
- Value proposition clarity
- Relevance to the event
- Call to action
- Professional tone
Provide specific, actionable feedback with examples of improved versions.`,

  "practice-qa": `You are a skeptical event organizer interviewing a potential speaker. Ask tough but fair questions about:
- Their expertise and credentials
- Why they're right for this audience
- What makes their talk unique
- Their fee expectations
- Logistics and availability
Challenge their answers professionally and help them improve their responses.`,

  "brainstorm-titles": `You are a creative speaking coach helping brainstorm talk titles. Generate 10 compelling title options that are:
- Attention-grabbing
- Clear about the value
- Appropriate for the target audience
- Memorable and unique
Explain why each title works and suggest which might work best for different contexts.`,

  "optimize-bio": `You are an expert at writing speaker bios. Take the provided bio and create optimized versions at:
- 50 words (elevator pitch)
- 100 words (event program)
- 150 words (speaker page)
- 200 words (detailed profile)
Each should be compelling, highlight key credentials, and be appropriate for organizers.`,

  "negotiate-fee": `You are an event organizer in a fee negotiation roleplay. Start with a lower offer than the speaker's range and practice negotiation. Be realistic - sometimes push back, sometimes agree. Help the speaker practice:
- Stating their value confidently
- Handling objections
- Finding creative solutions
- Knowing when to walk away
After the roleplay, provide feedback on their negotiation approach.`,

  "improve-description": `You are an expert at writing talk descriptions that get selected. Analyze the abstract and create an enhanced version that:
- Has a compelling opening hook
- Clearly states what attendees will learn
- Uses concrete outcomes (3 takeaways format)
- Addresses the target audience
- Is the right length for CFPs
Explain what you changed and why.`,

  "handle-objections": `You are helping a speaker practice responding to common organizer objections:
- "Your fee is too high"
- "We've never heard of you"
- "This topic is overdone"
- "Can you do it for exposure?"
- "We need someone more experienced"
Present objections one at a time, evaluate responses, and provide better alternatives.`,

  default: `You are an expert speaking coach and mentor. Help speakers improve their craft with specific, actionable advice. Be encouraging but honest. Draw on best practices from the speaking industry.`
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode, speakerProfile } = await req.json();

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Per-request rate limiting (prevent rapid-fire requests)
    const yearMonth = new Date().toISOString().slice(0, 7);
    
    // Check last conversation update to enforce cooldown
    const { data: lastConversation } = await supabase
      .from("coach_conversations")
      .select("updated_at")
      .eq("speaker_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastConversation) {
      const secondsSinceLastRequest = (Date.now() - new Date(lastConversation.updated_at).getTime()) / 1000;
      if (secondsSinceLastRequest < 2) {
        return new Response(
          JSON.stringify({ error: "Please wait a moment before sending another message." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check monthly usage limits
    const { data: usage } = await supabase
      .from("coach_usage")
      .select("message_count")
      .eq("speaker_id", user.id)
      .eq("year_month", yearMonth)
      .maybeSingle();

    const currentCount = usage?.message_count || 0;
    if (currentCount >= FREE_TIER_LIMIT) {
      return new Response(
        JSON.stringify({ 
          error: "Monthly limit reached", 
          limit: FREE_TIER_LIMIT,
          used: currentCount 
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment usage
    if (usage) {
      await supabase
        .from("coach_usage")
        .update({ message_count: currentCount + 1 })
        .eq("speaker_id", user.id)
        .eq("year_month", yearMonth);
    } else {
      await supabase.from("coach_usage").insert({
        speaker_id: user.id,
        year_month: yearMonth,
        message_count: 1,
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build personalized system prompt
    const modePrompt = COACHING_MODES[mode] || COACHING_MODES.default;
    
    let profileContext = "";
    if (speakerProfile) {
      profileContext = `\n\nSPEAKER PROFILE CONTEXT:
- Name: ${speakerProfile.name || "Not specified"}
- Headline: ${speakerProfile.headline || "Not specified"}
- Bio: ${speakerProfile.bio || "Not provided"}
- Years Speaking: ${speakerProfile.years_speaking || "Not specified"}
- Total Talks: ${speakerProfile.total_talks_given || 0}
- Fee Range: $${speakerProfile.fee_range_min || 0} - $${speakerProfile.fee_range_max || 0}
- Location: ${speakerProfile.location_city || ""} ${speakerProfile.location_country || ""}
- Industries: ${speakerProfile.industries?.join(", ") || "Not specified"}

Use this context to give personalized advice relevant to their experience level and goals.`;
    }

    const systemPrompt = `${modePrompt}${profileContext}

IMPORTANT GUIDELINES:
- Be specific and actionable in your feedback
- Give examples when possible
- Be encouraging but honest
- Adapt your advice to their experience level
- Format responses with clear sections using markdown
- Keep responses focused and practical`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI coach error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
