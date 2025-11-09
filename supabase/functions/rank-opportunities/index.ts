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

    console.log('Ranking opportunities for user:', user.id);

    // Fetch user profile and topics
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, user_topics(topic_id, topics(name))')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile.user_topics || profile.user_topics.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No topics selected',
        message: 'Please complete your profile with speaking topics first'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userTopics = profile.user_topics.map((ut: any) => ut.topics.name);

    // Fetch all active opportunities
    const { data: opportunities, error: oppsError } = await supabase
      .from('opportunities')
      .select(`
        *,
        opportunity_topics(topics(name))
      `)
      .eq('is_active', true);

    if (oppsError) {
      console.error('Opportunities error:', oppsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch opportunities' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let scoredCount = 0;

    // Score each opportunity
    for (const opp of opportunities || []) {
      const oppTopics = opp.opportunity_topics?.map((ot: any) => ot.topics.name) || [];
      
      // Calculate deadline urgency (days until deadline)
      const daysUntilDeadline = opp.deadline 
        ? Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 90;

      const urgencyScore = daysUntilDeadline <= 7 ? 100 : 
                          daysUntilDeadline <= 30 ? 80 : 
                          daysUntilDeadline <= 90 ? 60 : 40;

      // Call AI to generate score and reasoning
      const prompt = `You are a speaking opportunity matcher. Score this opportunity for the speaker on a scale of 1-100.

Speaker Profile:
- Topics: ${userTopics.join(', ')}
- Fee Range: $${profile.fee_range_min}-$${profile.fee_range_max}
- Bio: ${profile.bio || 'Not provided'}
- Past Talks: ${profile.past_talks?.join(', ') || 'None listed'}

Opportunity:
- Event: ${opp.event_name}
- Topics: ${oppTopics.join(', ')}
- Fee Estimate: $${opp.fee_estimate_min || 0}-$${opp.fee_estimate_max || 0}
- Deadline: ${daysUntilDeadline} days
- Audience: ${opp.audience_size || 'Unknown'}
- Location: ${opp.location || 'Unknown'}

Scoring Criteria (weights):
- Topic Match: 80% (exact match = 100, related = 70, unrelated = 20)
- Fee Alignment: 10% (within range = 100, 20% below = 80, 50% below = 40)
- Deadline Urgency: 5% (precomputed: ${urgencyScore})
- Audience Size: 5% (1000+ = 100, 500+ = 80, 100+ = 60)

Return ONLY valid JSON (no markdown, no explanations):
{
  "score": <number between 1-100>,
  "reason": "<2 sentence explanation focusing on topic match and fee>"
}`;

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a JSON-only assistant. Return only valid JSON without markdown formatting.' },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (aiResponse.status === 429) {
          console.error('Rate limit exceeded');
          continue;
        }

        if (aiResponse.status === 402) {
          console.error('Payment required');
          continue;
        }

        if (!aiResponse.ok) {
          console.error('AI request failed:', aiResponse.status);
          continue;
        }

        const aiData = await aiResponse.json();
        let aiResult;
        
        try {
          const content = aiData.choices[0].message.content.trim();
          // Remove markdown code blocks if present
          const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          aiResult = JSON.parse(jsonContent);
        } catch (parseError) {
          console.error('Failed to parse AI response:', aiData.choices[0].message.content);
          continue;
        }

        // Calculate component scores
        const topicMatchScore = oppTopics.some((ot: string) => userTopics.includes(ot)) ? 80 : 20;
        const feeAlignmentScore = (opp.fee_estimate_min || 0) >= profile.fee_range_min * 0.8 ? 100 : 60;

        // Insert or update score
        const { error: scoreError } = await supabase
          .from('opportunity_scores')
          .upsert({
            opportunity_id: opp.id,
            user_id: user.id,
            ai_score: Math.min(100, Math.max(1, Math.round(aiResult.score))),
            ai_reason: aiResult.reason,
            topic_match_score: topicMatchScore,
            fee_alignment_score: feeAlignmentScore,
            deadline_urgency_score: urgencyScore,
          }, {
            onConflict: 'opportunity_id,user_id'
          });

        if (scoreError) {
          console.error('Score insert error:', scoreError);
        } else {
          scoredCount++;
        }
      } catch (error) {
        console.error('Error scoring opportunity:', opp.id, error);
      }
    }

    console.log(`Successfully scored ${scoredCount} opportunities`);

    return new Response(JSON.stringify({ 
      success: true,
      scored_count: scoredCount,
      message: `Ranked ${scoredCount} opportunities for you`
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
