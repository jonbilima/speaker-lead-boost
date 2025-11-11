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
  const eventbriteKey = Deno.env.get('EVENTBRITE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!eventbriteKey) {
    return new Response(
      JSON.stringify({ error: 'EVENTBRITE_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let logId: string | null = null;

  try {
    console.log('Starting Eventbrite scraping...');

    // Create scraping log
    const { data: logData, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        source: 'eventbrite',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) throw logError;
    logId = logData.id;

    // Search keywords for speaking opportunities
    const keywords = ['call for speakers', 'CFP', 'speaker opportunity', 'speaking opportunity'];
    const allEvents: any[] = [];

    // Fetch events for each keyword
    for (const keyword of keywords) {
      try {
        const url = new URL('https://www.eventbriteapi.com/v3/events/search/');
        url.searchParams.append('q', keyword);
        url.searchParams.append('sort_by', 'date');
        url.searchParams.append('expand', 'venue,organizer');

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${eventbriteKey}`,
          },
        });

        if (!response.ok) {
          console.error(`Eventbrite API error for "${keyword}": ${response.status}`);
          continue;
        }

        const data = await response.json();
        if (data.events) {
          allEvents.push(...data.events);
        }

        // Rate limiting: wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching events for "${keyword}":`, error);
      }
    }

    // Remove duplicates by ID
    const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
    console.log(`Found ${uniqueEvents.length} unique events from Eventbrite`);

    let inserted = 0;
    let updated = 0;

    for (const event of uniqueEvents) {
      try {
        const eventUrl = event.url;

        // Check if opportunity already exists
        const { data: existing } = await supabase
          .from('opportunities')
          .select('id')
          .eq('event_url', eventUrl)
          .maybeSingle();

        // Extract location
        let location = null;
        if (event.venue) {
          const parts = [
            event.venue.address?.city,
            event.venue.address?.region,
            event.venue.address?.country,
          ].filter(Boolean);
          location = parts.join(', ') || null;
        }

        // Estimate fee based on ticket prices (heuristic: 10% of average ticket price)
        let feeMin = null;
        let feeMax = null;
        if (event.ticket_availability?.minimum_ticket_price && event.ticket_availability?.maximum_ticket_price) {
          const minPrice = event.ticket_availability.minimum_ticket_price.major_value;
          const maxPrice = event.ticket_availability.maximum_ticket_price.major_value;
          if (minPrice > 0 && maxPrice > 0) {
            feeMin = Math.round(minPrice * 0.1);
            feeMax = Math.round(maxPrice * 0.1);
          }
        }

        const opportunityData = {
          event_name: event.name?.text || 'Unnamed Event',
          event_url: eventUrl,
          deadline: event.start?.utc ? new Date(event.start.utc).toISOString() : null,
          location,
          description: event.description?.text || event.summary || null,
          organizer_name: event.organizer?.name || null,
          organizer_email: null, // Not provided by API
          event_date: event.start?.local ? new Date(event.start.local).toISOString() : null,
          audience_size: event.capacity || null,
          fee_estimate_min: feeMin,
          fee_estimate_max: feeMax,
          source: 'eventbrite',
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
        console.error(`Error processing event ${event.name?.text}:`, error);
      }
    }

    // Update log with success
    await supabase
      .from('scraping_logs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        opportunities_found: uniqueEvents.length,
        opportunities_inserted: inserted,
        opportunities_updated: updated,
      })
      .eq('id', logId);

    console.log(`Eventbrite scraping complete: ${inserted} inserted, ${updated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        found: uniqueEvents.length,
        inserted,
        updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Eventbrite scraping error:', error);

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
