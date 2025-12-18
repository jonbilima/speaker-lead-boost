import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Apify actor configurations for different sources
const APIFY_ACTORS = {
  papercall: {
    actorId: 'apify/web-scraper',
    input: {
      startUrls: [{ url: 'https://www.papercall.io/events' }],
      globs: [{ glob: 'https://www.papercall.io/cfps/*' }],
      pageFunction: `async function pageFunction(context) {
        const { $, request } = context;
        const results = [];
        
        // If on the events listing page, extract CFP links
        if (request.url === 'https://www.papercall.io/events') {
          $('a[href*="/cfps/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
              context.enqueueRequest({ url: 'https://www.papercall.io' + href });
            }
          });
          return results;
        }
        
        // On individual CFP pages, extract details
        const eventName = $('h1').first().text().trim() || $('title').text().trim();
        const description = $('meta[name="description"]').attr('content') || 
                           $('.description, .event-description').text().trim().substring(0, 1000);
        const deadline = $('[class*="deadline"], [class*="date"]').first().text().trim();
        const location = $('[class*="location"]').first().text().trim();
        
        if (eventName) {
          results.push({
            event_name: eventName,
            description: description,
            deadline: deadline,
            location: location,
            event_url: request.url,
            source: 'papercall-apify'
          });
        }
        
        return results;
      }`,
      maxPagesPerCrawl: 50,
      maxConcurrency: 5,
    }
  },
  wikicfp: {
    actorId: 'apify/web-scraper',
    input: {
      startUrls: [{ url: 'http://www.wikicfp.com/cfp/call' }],
      pageFunction: `async function pageFunction(context) {
        const { $, request } = context;
        const results = [];
        
        // Extract CFP rows from the table
        $('table.sortable tr').each((i, row) => {
          if (i === 0) return; // Skip header
          
          const cols = $(row).find('td');
          if (cols.length >= 4) {
            const eventName = $(cols[0]).text().trim();
            const description = $(cols[1]).text().trim();
            const deadline = $(cols[2]).text().trim();
            const location = $(cols[3]).text().trim();
            const eventUrl = $(cols[0]).find('a').attr('href');
            
            if (eventName) {
              results.push({
                event_name: eventName,
                description: description,
                deadline: deadline,
                location: location,
                event_url: eventUrl ? 'http://www.wikicfp.com' + eventUrl : null,
                source: 'wikicfp-apify'
              });
            }
          }
        });
        
        return results;
      }`,
      maxPagesPerCrawl: 10,
    }
  },
  confs_tech: {
    actorId: 'apify/web-scraper',
    input: {
      startUrls: [{ url: 'https://confs.tech/' }],
      pageFunction: `async function pageFunction(context) {
        const { $, request } = context;
        const results = [];
        
        // This site is JS-heavy, so we use waitUntil: 'networkidle'
        $('article, .conference-card, [class*="conference"]').each((i, el) => {
          const eventName = $(el).find('h2, h3, [class*="name"]').first().text().trim();
          const location = $(el).find('[class*="location"]').text().trim();
          const dates = $(el).find('[class*="date"]').text().trim();
          const link = $(el).find('a').first().attr('href');
          
          if (eventName) {
            results.push({
              event_name: eventName,
              location: location,
              event_date: dates,
              event_url: link,
              source: 'confs-tech-apify'
            });
          }
        });
        
        return results;
      }`,
      maxPagesPerCrawl: 20,
    }
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('APIFY_API_KEY');
  if (!apiKey) {
    console.error('APIFY_API_KEY not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Apify API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { source = 'papercall' } = await req.json();
    
    const actorConfig = APIFY_ACTORS[source as keyof typeof APIFY_ACTORS];
    if (!actorConfig) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown source: ${source}. Available: ${Object.keys(APIFY_ACTORS).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting Apify scrape for source: ${source}`);

    // Create a scraping log entry
    const { data: logEntry, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        source: `${source}-apify`,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating log entry:', logError);
    }

    // Start the Apify actor run
    console.log(`Calling Apify actor: ${actorConfig.actorId}`);
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorConfig.actorId}/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorConfig.input),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Apify API error:', errorText);
      throw new Error(`Apify API error: ${runResponse.status} - ${errorText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Apify run started with ID: ${runId}`);

    // Poll for completion (with timeout)
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    let runStatus = 'RUNNING';

    while (runStatus === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
      );
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      console.log(`Run status: ${runStatus} (attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Apify run did not succeed. Final status: ${runStatus}`);
    }

    // Fetch the results
    const datasetId = runData.data.defaultDatasetId;
    console.log(`Fetching results from dataset: ${datasetId}`);
    
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`
    );
    const results = await resultsResponse.json();
    
    console.log(`Got ${results.length} raw results from Apify`);

    // Flatten nested results (pageFunction returns arrays)
    const flatResults = results.flat().filter((item: any) => item.event_name);
    console.log(`Processing ${flatResults.length} opportunities`);

    let inserted = 0;
    let updated = 0;

    // Process and upsert opportunities
    for (const item of flatResults) {
      // Parse deadline if present
      let deadline = null;
      if (item.deadline) {
        try {
          const parsed = new Date(item.deadline);
          if (!isNaN(parsed.getTime())) {
            deadline = parsed.toISOString();
          }
        } catch (e) {
          console.log(`Could not parse deadline: ${item.deadline}`);
        }
      }

      // Parse event date if present
      let eventDate = null;
      if (item.event_date) {
        try {
          const parsed = new Date(item.event_date);
          if (!isNaN(parsed.getTime())) {
            eventDate = parsed.toISOString();
          }
        } catch (e) {
          console.log(`Could not parse event_date: ${item.event_date}`);
        }
      }

      const opportunity = {
        event_name: item.event_name.substring(0, 255),
        description: item.description?.substring(0, 2000) || null,
        deadline,
        event_date: eventDate,
        location: item.location?.substring(0, 255) || null,
        event_url: item.event_url || null,
        source: item.source || `${source}-apify`,
        scraped_at: new Date().toISOString(),
        is_active: true,
      };

      // Check if opportunity exists by URL
      if (item.event_url) {
        const { data: existing } = await supabase
          .from('opportunities')
          .select('id')
          .eq('event_url', item.event_url)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('opportunities')
            .update(opportunity)
            .eq('id', existing.id);
          updated++;
        } else {
          await supabase.from('opportunities').insert(opportunity);
          inserted++;
        }
      } else {
        // No URL, insert as new
        await supabase.from('opportunities').insert(opportunity);
        inserted++;
      }
    }

    // Update the scraping log
    if (logEntry) {
      await supabase
        .from('scraping_logs')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          opportunities_found: flatResults.length,
          opportunities_inserted: inserted,
          opportunities_updated: updated,
        })
        .eq('id', logEntry.id);
    }

    console.log(`Scraping complete. Inserted: ${inserted}, Updated: ${updated}`);

    return new Response(
      JSON.stringify({
        success: true,
        source,
        found: flatResults.length,
        inserted,
        updated,
        runId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Apify scraping error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
