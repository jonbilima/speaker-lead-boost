import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { validateAuth, unauthorizedResponse, forbiddenResponse, corsHeaders } from "../_shared/auth.ts";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authentication and require admin role
  const auth = await validateAuth(req);
  if (auth.error || !auth.user) {
    return unauthorizedResponse(auth.error || 'Unauthorized');
  }
  if (!auth.isAdmin) {
    return forbiddenResponse('Admin access required to run scraping functions');
  }

  try {
    console.log('Starting PaperCall.io scraping...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create scraping log entry
    const { data: logEntry, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        source: 'papercall',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) throw logError;

    // Fetch PaperCall events page with browser-like headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    };

    console.log('Fetching PaperCall.io events page...');
    const response = await fetch('https://www.papercall.io/events', { headers });

    if (!response.ok) {
      throw new Error(`PaperCall returned ${response.status}`);
    }

    const html = await response.text();
    console.log(`Fetched HTML (${html.length} chars)`);

    // Parse HTML to extract event information
    // Looking for event cards/listings - this is a basic regex approach
    // In production, you'd want a proper HTML parser
    const eventPattern = /<div[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i;
    const titlePattern = /<h[234][^>]*>(.*?)<\/h[234]>/i;
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/i;

    const opportunities = [];
    let eventMatches = html.match(eventPattern);

    if (!eventMatches) {
      // Try alternative parsing approach - look for event links
      const eventLinkPattern = /href="(\/events\/[^"]+)"/g;
      const links = [...html.matchAll(eventLinkPattern)];
      
      console.log(`Found ${links.length} potential event links`);
      
      // Take first 10 events to avoid too many requests
      for (const match of links.slice(0, 10)) {
        const eventPath = match[1];
        const eventUrl = `https://www.papercall.io${eventPath}`;
        
        // Extract event name from path
        const eventSlug = eventPath.split('/').pop() || '';
        const eventName = eventSlug
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        if (eventName && eventName.length > 3) {
          opportunities.push({
            event_name: eventName,
            event_url: eventUrl,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default 30 days
            location: 'TBD',
            description: `CFP opportunity from PaperCall.io - ${eventName}. Visit event page for full details.`,
            organizer_email: null,
            organizer_name: null,
            event_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // Default 90 days
            audience_size: null,
            fee_estimate_min: null,
            fee_estimate_max: null,
            source: 'papercall',
            is_active: true
          });
        }

        // Rate limiting - wait 2 seconds between requests
        await delay(2000);
      }
    }

    console.log(`Found ${opportunities.length} opportunities from PaperCall`);

    let inserted = 0;
    let updated = 0;

    // Insert/update opportunities
    for (const opportunity of opportunities) {
      const { data: existing } = await supabase
        .from('opportunities')
        .select('id')
        .eq('event_url', opportunity.event_url)
        .single();

      if (existing) {
        const { error: updateError } = await supabase
          .from('opportunities')
          .update(opportunity)
          .eq('id', existing.id);
        
        if (!updateError) updated++;
      } else {
        const { error: insertError } = await supabase
          .from('opportunities')
          .insert(opportunity);
        
        if (!insertError) inserted++;
      }
    }

    console.log(`PaperCall scraping complete: ${inserted} inserted, ${updated} updated`);

    // Update scraping log
    await supabase
      .from('scraping_logs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'success',
        opportunities_found: opportunities.length,
        opportunities_inserted: inserted,
        opportunities_updated: updated
      })
      .eq('id', logEntry.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        found: opportunities.length,
        inserted,
        updated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PaperCall scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Try to update log on error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('scraping_logs')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          error_message: errorMessage
        })
        .eq('source', 'papercall')
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1);
    } catch (logError) {
      console.error('Failed to update error log:', logError);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
