import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { DOMParser } from "jsr:@b-fuze/deno-dom/wasm";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to parse dates from various formats
function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    // Try parsing MM/DD/YYYY format
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).toISOString();
    }
    // Try direct parse
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

// Helper to extract deadline from description text
function extractDeadline(text: string): string | null {
  const deadlinePatterns = [
    /deadline[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /due[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /submit.*by[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  ];
  
  for (const pattern of deadlinePatterns) {
    const match = text.match(pattern);
    if (match) {
      return parseDate(match[1]);
    }
  }
  return null;
}

// Helper to extract location from text
function extractLocation(text: string): string | null {
  const locationPatterns = [
    /location[:\s]+([^\n]+)/i,
    /venue[:\s]+([^\n]+)/i,
    /(?:in|at)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z]{2,})?)/,
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().substring(0, 200);
    }
  }
  return null;
}

// Delay helper for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let logId: string | null = null;

  try {
    console.log('Starting CFPList scraping...');

    // Create scraping log
    const { data: logData, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        source: 'cfplist',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) throw logError;
    logId = logData.id;

    // Fetch CFPList.com popular CFPs page
    console.log('Fetching CFPList.com/PopularCFPs...');
    const response = await fetch('https://www.cfplist.com/PopularCFPs', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.cfplist.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });
    
    if (!response.ok) {
      throw new Error(`CFPList returned ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }

    // Find all table rows with CFP data
    const rows = doc.querySelectorAll('table tr');
    console.log(`Found ${rows.length} table rows`);

    let inserted = 0;
    let updated = 0;
    let processed = 0;
    const maxCFPs = 20; // Limit to 20 CFPs per run to avoid timeouts

    // Skip header row and limit to maxCFPs
    for (const row of Array.from(rows).slice(1)) {
      if (processed >= maxCFPs) break;
      
      try {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) continue; // Skip invalid rows

        const link = cells[0]?.querySelector('a');
        if (!link) continue;

        const title = link.textContent?.trim() || 'Unnamed Event';
        const href = link.getAttribute('href');
        if (!href) continue;

        const eventUrl = `https://www.cfplist.com${href}`;
        const eventDateStr = cells[2]?.textContent?.trim();
        const eventDate = parseDate(eventDateStr);

        console.log(`Processing: ${title}`);

        // Fetch detail page for more information
        await delay(1000); // Rate limiting: 1 second between requests
        
        const detailResponse = await fetch(eventUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.cfplist.com/',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          }
        });
        let description = null;
        let deadline = null;
        let location = null;

        if (detailResponse.ok) {
          const detailHtml = await detailResponse.text();
          const detailDoc = new DOMParser().parseFromString(detailHtml, 'text/html');
          
          if (detailDoc) {
            // Extract description (look for main content area)
            const contentDivs = detailDoc.querySelectorAll('div');
            let fullText = '';
            for (const div of Array.from(contentDivs)) {
              const text = div.textContent?.trim() || '';
              if (text.length > fullText.length) {
                fullText = text;
              }
            }
            description = fullText.substring(0, 2000) || null;
            
            // Try to extract deadline and location from text
            if (description) {
              deadline = extractDeadline(description);
              location = extractLocation(description);
            }
          }
        }

        // Check if opportunity already exists
        const { data: existing } = await supabase
          .from('opportunities')
          .select('id')
          .eq('event_url', eventUrl)
          .maybeSingle();

        const opportunityData = {
          event_name: title,
          event_url: eventUrl,
          deadline: deadline,
          location: location,
          description: description,
          organizer_name: null,
          organizer_email: null,
          event_date: eventDate,
          source: 'cfplist',
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

        processed++;
      } catch (error) {
        console.error(`Error processing CFP:`, error);
        // Continue with next CFP
      }
    }

    // Update log with success
    await supabase
      .from('scraping_logs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        opportunities_found: processed,
        opportunities_inserted: inserted,
        opportunities_updated: updated,
      })
      .eq('id', logId);

    console.log(`CFPList scraping complete: ${inserted} inserted, ${updated} updated out of ${processed} processed`);

    return new Response(
      JSON.stringify({
        success: true,
        found: processed,
        inserted,
        updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('CFPList scraping error:', error);

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
