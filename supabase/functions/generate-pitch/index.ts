import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
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

    console.log('Generating pitch for opportunity:', opportunity_id);

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

    const userTopics = profile.user_topics?.map((ut: any) => ut.topics.name).join(', ') || 'Not specified';
    const oppTopics = opportunity.opportunity_topics?.map((ot: any) => ot.topics.name).join(', ') || 'Not specified';
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

Tone: ${tone}

Requirements:
- 3 different variants (concise, balanced, detailed)
- Each max 150 words
- Include subject line
- Reference relevant expertise
- Clear CTA to discuss speaking opportunity
- Professional, humble, confident
- No generic templates

Return ONLY valid JSON (no markdown, no explanations):
[
  {
    "variant": "concise",
    "subject": "<subject line>",
    "body": "<email body>"
  },
  {
    "variant": "balanced",
    "subject": "<subject line>",
    "body": "<email body>"
  },
  {
    "variant": "detailed",
    "subject": "<subject line>",
    "body": "<email body>"
  }
]`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a JSON-only assistant. Return only valid JSON arrays without markdown formatting.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded, please try again later.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (aiResponse.status === 402) {
      return new Response(JSON.stringify({ 
        error: 'Payment required, please add funds to your workspace.' 
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!aiResponse.ok) {
      console.error('AI request failed:', aiResponse.status);
      return new Response(JSON.stringify({ error: 'Failed to generate pitch' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    let pitches;
    
    try {
      const content = aiData.choices[0].message.content.trim();
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      pitches = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiData.choices[0].message.content);
      return new Response(JSON.stringify({ error: 'Invalid AI response format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save all 3 pitches to database
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
      pitches: savedPitches
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
