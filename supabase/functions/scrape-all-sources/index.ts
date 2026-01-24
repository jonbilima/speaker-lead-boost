import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { corsHeaders } from "../_shared/auth.ts";

interface ScraperResult {
  source: string;
  success: boolean;
  found: number;
  inserted: number;
  updated: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check for cron or admin authorization
  const authHeader = req.headers.get('Authorization');
  let isAuthorized = false;

  // Allow cron jobs (they use the anon key in the header)
  if (authHeader?.includes('Bearer')) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      // Check if admin
      const { data: roleData } = await supabase.rpc('has_role', { 
        _role: 'admin', 
        _user_id: user.id 
      });
      isAuthorized = roleData === true;
    }
    
    // Also allow if it's the anon key (for cron jobs)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (token === anonKey) {
      isAuthorized = true;
    }
  }

  // Also allow internal calls from other edge functions
  const isInternalCall = req.headers.get('x-internal-call') === 'true';
  if (isInternalCall) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Admin access or cron job required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let masterLogId: string | null = null;

  try {
    console.log('Starting master scraper - scrape-all-sources...');

    // Create master scraping log
    const { data: logData, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        source: 'all-sources',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) throw logError;
    masterLogId = logData.id;

    const results: ScraperResult[] = [];
    
    // Define scrapers to run
    const scrapers = [
      { name: 'papercall', function: 'scrape-papercall' },
      { name: 'sessionize', function: 'scrape-sessionize' },
      { name: 'eventbrite', function: 'scrape-eventbrite' },
      { name: 'meetup', function: 'scrape-meetup' },
      { name: 'conferencelist', function: 'scrape-conferencelist' },
    ];

    // Run each scraper
    for (const scraper of scrapers) {
      try {
        console.log(`Running ${scraper.name} scraper...`);
        
        // Call the scraper function using service role
        const response = await fetch(`${supabaseUrl}/functions/v1/${scraper.function}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'x-internal-call': 'true',
          },
          body: JSON.stringify({ manual_trigger: false, from_master: true }),
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            source: scraper.name,
            success: true,
            found: data.found || data.opportunities_found || 0,
            inserted: data.inserted || data.opportunities_inserted || 0,
            updated: data.updated || data.opportunities_updated || 0,
          });
          console.log(`${scraper.name} completed: found=${data.found || 0}, inserted=${data.inserted || 0}`);
        } else {
          const errorText = await response.text();
          results.push({
            source: scraper.name,
            success: false,
            found: 0,
            inserted: 0,
            updated: 0,
            error: errorText,
          });
          console.error(`${scraper.name} failed: ${errorText}`);
        }
      } catch (error) {
        results.push({
          source: scraper.name,
          success: false,
          found: 0,
          inserted: 0,
          updated: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`${scraper.name} error:`, error);
      }
    }

    // Aggregate results
    const totalFound = results.reduce((sum, r) => sum + r.found, 0);
    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    const failedSources = results.filter(r => !r.success).map(r => r.source);
    const successCount = results.filter(r => r.success).length;

    // Check for high-match opportunities for users
    await notifyHighMatchOpportunities(supabase);

    // Update master log
    await supabase
      .from('scraping_logs')
      .update({
        status: failedSources.length === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
        completed_at: new Date().toISOString(),
        opportunities_found: totalFound,
        opportunities_inserted: totalInserted,
        opportunities_updated: totalUpdated,
        error_message: failedSources.length > 0 ? `Failed sources: ${failedSources.join(', ')}` : null,
      })
      .eq('id', masterLogId);

    console.log(`Master scraper complete: ${totalFound} found, ${totalInserted} inserted, ${totalUpdated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        totals: {
          found: totalFound,
          inserted: totalInserted,
          updated: totalUpdated,
        },
        failed_sources: failedSources,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Master scraper error:', error);

    if (masterLogId) {
      await supabase
        .from('scraping_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', masterLogId);
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

// Notify users about high-match opportunities
async function notifyHighMatchOpportunities(supabase: any) {
  try {
    // Get recently added opportunities (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentOpps } = await supabase
      .from('opportunities')
      .select('id')
      .gte('scraped_at', yesterday)
      .eq('is_active', true);

    if (!recentOpps || recentOpps.length === 0) {
      console.log('No recent opportunities to check for high matches');
      return;
    }

    // Get all users who have profiles
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .not('name', 'is', null);

    if (!users || users.length === 0) return;

    // For each user, check if they have high-match opportunities
    for (const user of users) {
      const { data: highMatches } = await supabase
        .from('opportunity_scores')
        .select('id, ai_score, opportunities(event_name)')
        .eq('user_id', user.id)
        .gte('ai_score', 85)
        .gte('calculated_at', yesterday)
        .eq('pipeline_stage', 'new');

      if (highMatches && highMatches.length > 0) {
        console.log(`User ${user.id} has ${highMatches.length} new high-match opportunities`);
        // In the future, we can create notifications table entries here
        // For now, just log it - these will be included in weekly digest
      }
    }
  } catch (error) {
    console.error('Error checking high-match opportunities:', error);
  }
}
