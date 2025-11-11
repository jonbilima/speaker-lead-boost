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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!lovableApiKey) {
    return new Response(
      JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('Starting topic extraction...');

    // Get all available topics
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('id, name, category');

    if (topicsError) throw topicsError;

    const topicsList = topics.map(t => `${t.name}${t.category ? ` (${t.category})` : ''}`).join(', ');

    // Get opportunities without topics from last 24 hours
    const { data: opportunities, error: oppsError } = await supabase
      .from('opportunities')
      .select('id, event_name, description')
      .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (oppsError) throw oppsError;

    console.log(`Processing ${opportunities.length} opportunities for topic extraction`);

    let processed = 0;
    let topicsAdded = 0;

    for (const opp of opportunities) {
      try {
        // Check if topics already extracted
        const { data: existingTopics } = await supabase
          .from('opportunity_topics')
          .select('id')
          .eq('opportunity_id', opp.id)
          .limit(1);

        if (existingTopics && existingTopics.length > 0) {
          console.log(`Opportunity ${opp.id} already has topics, skipping`);
          continue;
        }

        const prompt = `Analyze this speaking opportunity and extract relevant topics.

Event: ${opp.event_name}
Description: ${opp.description || 'No description available'}

Available topics: ${topicsList}

Return a JSON array of matching topics with relevance scores (0.0 to 1.0).
Only include topics with relevance >= 0.6.
Format: [{"topic": "Topic Name", "relevance": 0.95}]`;

        // Call Lovable AI
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a topic extraction assistant. Return only valid JSON arrays.' },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI API error for opportunity ${opp.id}: ${aiResponse.status}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          console.log(`No content returned for opportunity ${opp.id}`);
          continue;
        }

        // Extract JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.log(`No JSON found in response for opportunity ${opp.id}`);
          continue;
        }

        const extractedTopics = JSON.parse(jsonMatch[0]);

        // Insert topic associations
        for (const extracted of extractedTopics) {
          const matchingTopic = topics.find(t => 
            t.name.toLowerCase() === extracted.topic.toLowerCase()
          );

          if (matchingTopic) {
            await supabase
              .from('opportunity_topics')
              .insert({
                opportunity_id: opp.id,
                topic_id: matchingTopic.id,
                relevance_score: extracted.relevance,
              });
            topicsAdded++;
          }
        }

        processed++;
        console.log(`Processed opportunity ${opp.id}: ${extractedTopics.length} topics added`);

        // Rate limiting: wait 1s between AI calls
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing opportunity ${opp.id}:`, error);
      }
    }

    console.log(`Topic extraction complete: ${processed} opportunities processed, ${topicsAdded} topic links added`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        topicsAdded,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Topic extraction error:', error);

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
