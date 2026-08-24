import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Identical for every request so xAI prompt caching can reuse the prefix.
const SYSTEM_PROMPT = `You are an expert cold-email copywriter for professional speakers.

You write pitches that event organizers actually reply to: specific, humble, confident, and free of filler or generic speaker-marketing language. You never invent credentials, clients, metrics, or talks that were not provided.

You always return ONLY a valid JSON array. No markdown fences, no commentary, no preamble.

The array always contains exactly three objects, in this order and shape:
[
  { "variant": "concise",  "subject": "<subject line>", "body": "<email body>" },
  { "variant": "balanced", "subject": "<subject line>", "body": "<email body>" },
  { "variant": "detailed", "subject": "<subject line>", "body": "<email body>" }
]

Rules that apply to every pitch you write:
- Each body is at most 150 words.
- The first sentence leads with the strongest fit reason supplied in the match analysis.
- Reference the speaker's real, supplied expertise and past talks only.
- End with one clear, low-friction call to action about the speaking opportunity.
- Subject lines are short, concrete, and not clickbait.
- Never mention fee unless the match analysis explicitly says the fee fits.
- No placeholder brackets such as [notable clients]. If a detail is unknown, write around it.
- Always write in the first person as the speaker ("I", never "Duane Huff's expertise..."), and sign off with the speaker's name.
- Do not restate the match analysis itself (never write phrases like "this is an open call with no listed deadline"); use it only to decide what to say.
- Each object must contain each key exactly once. Never repeat a key inside the same object (for example, do not emit "subject" twice). Output strictly: variant, subject, body — once each.`;

const DAILY_PITCH_LIMIT = 20;
const XAI_MODEL = 'grok-4.20-non-reasoning';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const xaiApiKey = Deno.env.get('XAI_API_KEY');

    if (!xaiApiKey) {
      console.error('XAI_API_KEY is not configured');
      return new Response(JSON.stringify({ error: 'Pitch generation is not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // In-code JWT validation (function runs with verify_jwt = false so the
    // gateway does not reject asymmetric signing-key tokens).
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { opportunity_id, tone = 'professional' } = await req.json();

    if (!opportunity_id) {
      return new Response(JSON.stringify({ error: 'opportunity_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Per-user daily rate limit -------------------------------------
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: usedToday, error: rateError } = await supabase
      .from('pitch_generation_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since);

    if (rateError) {
      console.error('Rate limit lookup failed:', rateError);
    } else if ((usedToday ?? 0) >= DAILY_PITCH_LIMIT) {
      return new Response(JSON.stringify({
        error: `You've reached your daily limit of ${DAILY_PITCH_LIMIT} pitch generations. Your limit resets 24 hours after your first generation today.`,
        limit: DAILY_PITCH_LIMIT,
        used: usedToday,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating pitch for opportunity:', opportunity_id, 'used today:', usedToday ?? 0);

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, user_topics(topics(name))')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch opportunity details
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select('*, opportunity_topics(topics(name))')
      .eq('id', opportunity_id)
      .single();

    if (oppError) {
      console.error('Opportunity error:', oppError);
      return new Response(JSON.stringify({ error: 'Opportunity not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deterministic reason codes for this speaker/opportunity match
    const { data: scoreRow } = await supabase
      .from('opportunity_scores')
      .select('ai_score, reason_codes')
      .eq('user_id', user.id)
      .eq('opportunity_id', opportunity_id)
      .maybeSingle();

    const REASON_CODE_PITCH_HINTS: Record<string, string> = {
      topic_match_strong: "the speaker's core topics directly match this event's stated topics",
      topic_match_none: 'the event topics differ, so lead with transferable expertise',
      no_topics_tagged: "the event has no topics listed, so lead with the speaker's strongest theme",
      speaker_topics_missing: "the speaker's topics are not on file, so lead with their bio",
      fee_above_floor: "the listed fee fits the speaker's range",
      fee_below_floor: 'do not mention fee',
      fee_not_listed: 'do not mention fee',
      fee_floor_not_set: 'do not mention fee',
      deadline_tight: 'the deadline is imminent, so be brief and direct',
      deadline_comfortable: 'there is time, so a warm introduction works',
      no_deadline_listed: 'no deadline is listed',
      public_cfp: 'this is an open call for speakers',
      cold_pitch_required: 'this is cold outreach with no public call',
    };

    const reasonCodes: string[] = (scoreRow?.reason_codes as string[] | null) || [];
    const fitReasons = reasonCodes
      .map((c) => REASON_CODE_PITCH_HINTS[c])
      .filter(Boolean)
      .map((h) => `- ${h}`)
      .join('\n') || '- no scored match data available';

    const userTopics = profile.user_topics?.map((ut: { topics: { name: string } }) => ut.topics.name).join(', ') || 'Not specified';
    const oppTopics = opportunity.opportunity_topics?.map((ot: { topics: { name: string } }) => ot.topics.name).join(', ') || 'Not specified';
    const pastTalks = profile.past_talks?.join(', ') || 'None listed';

    const prompt = `Generate 3 cold email pitches for a speaking opportunity.

Speaker:
- Name: ${profile.name || 'Speaker'}
- Bio: ${profile.bio || 'Experienced speaker'}
- Topics: ${userTopics}
- Past Talks: ${pastTalks}
- LinkedIn: ${profile.linkedin_url || 'Not provided'}

Opportunity:
- Event: ${opportunity.event_name}
- Organizer: ${opportunity.organizer_name || 'Event Organizer'}
- Topics: ${oppTopics}
- Audience: ${opportunity.audience_size || 'Unknown'}
- Description: ${opportunity.description || 'No description provided'}
- Location: ${opportunity.location || 'Unknown'}

Match analysis (deterministic, use this to frame the pitch):
${fitReasons}

Tone: ${tone}`;

    const aiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        // System prompt is byte-identical on every call, so xAI's automatic
        // prompt caching reuses the cached prefix (see cached_prompt_text_tokens).
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (aiResponse.status === 429) {
      const detail = await aiResponse.text().catch(() => '');
      console.error('xAI rate limited:', detail.slice(0, 300));
      return new Response(JSON.stringify({
        error: 'Pitch generation is busy right now. Please try again in a moment.',
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (aiResponse.status === 401 || aiResponse.status === 403) {
      const detail = await aiResponse.text().catch(() => '');
      console.error('xAI auth/credit error:', aiResponse.status, detail.slice(0, 300));
      return new Response(JSON.stringify({
        error: 'AI pitch generation is temporarily unavailable. Please try again shortly.',
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!aiResponse.ok) {
      const detail = await aiResponse.text().catch(() => '');
      console.error('xAI request failed:', aiResponse.status, detail.slice(0, 300));
      return new Response(JSON.stringify({ error: 'Failed to generate pitch' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    console.log('xAI usage:', JSON.stringify(aiData.usage ?? {}));

    let pitches;
    const rawContent: string = aiData.choices?.[0]?.message?.content ?? '';

    try {
      const jsonContent = rawContent
        .trim()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const start = jsonContent.indexOf('[');
      const end = jsonContent.lastIndexOf(']');
      pitches = JSON.parse(start >= 0 && end > start ? jsonContent.slice(start, end + 1) : jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', rawContent.slice(0, 500), parseError);
      return new Response(JSON.stringify({ error: 'Invalid AI response format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(pitches) || pitches.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid AI response format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Count this generation against the user's daily allowance.
    const { error: logError } = await supabase
      .from('pitch_generation_log')
      .insert({ user_id: user.id, opportunity_id });
    if (logError) console.error('Rate limit log insert failed:', logError);

    // Save all pitches to database
    const savedPitches = [];
    for (const pitch of pitches) {
      const { data: savedPitch, error: pitchError } = await supabase
        .from('pitches')
        .insert({
          user_id: user.id,
          opportunity_id,
          subject_line: pitch.subject,
          email_body: pitch.body,
          tone,
          variant: pitch.variant,
        })
        .select()
        .single();

      if (pitchError) {
        console.error('Pitch save error:', pitchError);
      } else {
        savedPitches.push(savedPitch);
      }
    }

    console.log(`Generated and saved ${savedPitches.length} pitches`);

    return new Response(JSON.stringify({
      success: true,
      pitches: savedPitches,
      usage: {
        used_today: (usedToday ?? 0) + 1,
        daily_limit: DAILY_PITCH_LIMIT,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
