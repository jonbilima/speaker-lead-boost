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
  const supabase = createClient(supabaseUrl, supabaseKey);

  let logId: string | null = null;

  try {
    console.log('Starting Sessionize scraping...');

    // Create scraping log
    const { data: logData, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        source: 'sessionize',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) throw logError;
    logId = logData.id;

    // Fetch Sessionize public API
    const response = await fetch('https://sessionize.com/api/v2/cfp/list');
    
    if (!response.ok) {
      throw new Error(`Sessionize API returned ${response.status}`);
    }

    const sessions = await response.json();
    console.log(`Found ${sessions.length} CFPs from Sessionize`);

    let inserted = 0;
    let updated = 0;

    for (const session of sessions) {
      try {
        // Check if opportunity already exists
        const { data: existing } = await supabase
          .from('opportunities')
          .select('id')
          .eq('event_url', session.url)
          .maybeSingle();

        const opportunityData = {
          event_name: session.name || 'Unnamed Event',
          event_url: session.url,
          deadline: session.deadline ? new Date(session.deadline).toISOString() : null,
          location: session.location || null,
          description: session.description || null,
          organizer_name: session.organizerName || null,
          organizer_email: session.organizerEmail || null,
          event_date: session.eventDate ? new Date(session.eventDate).toISOString() : null,
          source: 'sessionize',
          scraped_at: new Date().toISOString(),
          is_active: true,
        };

        if (existing) {
          // Update scraped_at timestamp
          await supabase
            .from('opportunities')
            .update({ scraped_at: new Date().toISOString() })
            .eq('id', existing.id);
          updated++;
        } else {
          // Insert new opportunity
          await supabase
            .from('opportunities')
            .insert(opportunityData);
          inserted++;
        }
      } catch (error) {
        console.error(`Error processing session ${session.name}:`, error);
      }
    }

    // Update log with success
    await supabase
      .from('scraping_logs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        opportunities_found: sessions.length,
        opportunities_inserted: inserted,
        opportunities_updated: updated,
      })
      .eq('id', logId);

    console.log(`Sessionize scraping complete: ${inserted} inserted, ${updated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        found: sessions.length,
        inserted,
        updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sessionize scraping error:', error);

    // Update log with error
    if (logId) {
      await supabase
        .from('scraping_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', logId);
    }

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
