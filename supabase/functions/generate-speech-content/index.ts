import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SpeechParams {
  title?: string;
  topic: string;
  targetAudience: string;
  durationMinutes: number;
  speechType: string;
  industryContext: string;
  keyMessage: string;
  desiredOutcome: string;
  template?: string;
}

interface OutlineSection {
  id: string;
  type: 'opening' | 'main_point' | 'story' | 'interaction' | 'closing';
  title: string;
  content: string;
  options?: string[];
  selectedOption?: number;
  estimatedMinutes: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params, section, context } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "generate_outline") {
      const p = params as SpeechParams;
      const mainPointCount = p.durationMinutes <= 15 ? 2 : p.durationMinutes <= 30 ? 3 : p.durationMinutes <= 60 ? 4 : 5;
      
      systemPrompt = `You are an expert speechwriter who has written for TED speakers, corporate executives, and thought leaders. You create compelling, structured speech outlines.`;
      
      userPrompt = `Create a detailed speech outline for:
- Topic: ${p.topic}
- Target Audience: ${p.targetAudience}
- Duration: ${p.durationMinutes} minutes
- Speech Type: ${p.speechType}
- Industry Context: ${p.industryContext}
- Key Message: ${p.keyMessage}
- Desired Outcome: ${p.desiredOutcome}
${p.template ? `- Template Structure: ${p.template}` : ''}

Generate a JSON response with this exact structure:
{
  "suggestedTitle": "A compelling title if none provided",
  "sections": [
    {
      "id": "unique_id",
      "type": "opening|main_point|story|interaction|closing",
      "title": "Section title",
      "content": "Brief description of what this section covers",
      "options": ["Option 1 for this section", "Option 2", "Option 3"],
      "estimatedMinutes": 2
    }
  ]
}

Requirements:
- Include exactly 3 opening hook options (different styles: story, question, statistic)
- Include ${mainPointCount} main points
- Suggest 2-3 story placement opportunities
- Include 2-3 interaction moments (questions, exercises, reflection)
- Include 3 closing/call-to-action options
- Time estimates should total approximately ${p.durationMinutes} minutes

Return ONLY valid JSON, no markdown or explanation.`;
    } else if (action === "generate_section_content") {
      systemPrompt = `You are an expert speechwriter creating compelling speech content. Write in a conversational, engaging style appropriate for live delivery.`;
      
      userPrompt = `Write the full script content for this speech section:

Section: ${section.title}
Type: ${section.type}
Description: ${section.content}
Selected approach: ${section.options?.[section.selectedOption || 0] || section.content}

Context:
- Topic: ${context.topic}
- Audience: ${context.targetAudience}
- Speech Type: ${context.speechType}
- Key Message: ${context.keyMessage}
- Target length: approximately ${section.estimatedMinutes * 150} words (${section.estimatedMinutes} minutes at 150 wpm)

Write engaging, speakable content. Use:
- Short sentences for impact
- Rhetorical questions to engage
- Vivid language and metaphors
- Natural transitions
- Pauses marked with [PAUSE]

Return ONLY the speech content, no JSON or formatting instructions.`;
    } else if (action === "suggest_story") {
      systemPrompt = `You are helping a speaker find the perfect story from their story bank for a specific moment in their speech.`;
      
      userPrompt = `Given these stories from the speaker's bank:
${JSON.stringify(context.stories, null, 2)}

And this speech context:
- Topic: ${context.topic}
- Current section: ${context.currentSection}
- Key message: ${context.keyMessage}

Recommend which story would work best and explain why in 2-3 sentences. Return JSON:
{
  "recommendedStoryId": "id or null if none fit",
  "reason": "Brief explanation"
}`;
    } else if (action === "suggest_tags") {
      systemPrompt = `You categorize stories for speakers based on their content and emotional impact.`;
      
      userPrompt = `Analyze this story and suggest appropriate tags:

"${params.storyText}"

Choose from these tags: funny, emotional, business, failure, success, personal, inspirational, cautionary, transformation, leadership, teamwork, innovation, resilience, family, childhood, career, lesson

Return JSON: { "tags": ["tag1", "tag2", "tag3"] }
Maximum 5 tags, minimum 2.`;
    } else if (action === "regenerate_section") {
      systemPrompt = `You are an expert speechwriter. Generate fresh, alternative content for a speech section.`;
      
      userPrompt = `Create a NEW version of this speech section (different from the original):

Original content: ${section.originalContent}
Section type: ${section.type}
Section title: ${section.title}

Context:
- Topic: ${context.topic}
- Audience: ${context.targetAudience}
- Key message: ${context.keyMessage}

Write a completely fresh take on this section. Same approximate length (${section.estimatedMinutes * 150} words).
Return ONLY the speech content.`;
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Try to parse as JSON if applicable
    let result;
    if (action === "generate_outline" || action === "suggest_story" || action === "suggest_tags") {
      try {
        // Clean markdown code blocks if present
        const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        result = JSON.parse(cleanedContent);
      } catch (e) {
        console.error("Failed to parse JSON response:", content);
        result = { raw: content, parseError: true };
      }
    } else {
      result = { content };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
