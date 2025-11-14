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
    console.log('Starting WikiCFP scraping...');

    // Create scraping log
    const { data: logData, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        source: 'wikicfp',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) throw logError;
    logId = logData.id;

    // Fetch WikiCFP.com call for papers page
    console.log('Fetching WikiCFP.com/cfp/call...');
    const response = await fetch('http://www.wikicfp.com/cfp/call', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'http://www.wikicfp.com/',
        'Connection': 'keep-alive',
      }
    });
    
    if (!response.ok) {
      throw new Error(`WikiCFP returned ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }

    // Find all CFP rows in the main table (WikiCFP uses a specific table structure)
    const rows = doc.querySelectorAll('table.contsec tr');
    console.log(`Found ${rows.length} CFP rows`);

    let inserted = 0;
    let updated = 0;
    const maxCfps = 20; // Limit to prevent timeouts

    for (let i = 0; i < Math.min(rows.length, maxCfps); i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      
      // WikiCFP table structure: Event | Where | When | Deadline | Notification
      if (cells.length < 4) continue; // Skip header or invalid rows

      try {
        // First cell contains event name and link
        const eventCell = cells[0];
        const link = eventCell.querySelector('a');
        if (!link) continue;

        const eventName = link.textContent?.trim();
        const eventPath = link.getAttribute('href');

        if (!eventName || !eventPath) continue;

        // Build full URL
        const eventUrl = eventPath.startsWith('http') 
          ? eventPath 
          : `http://www.wikicfp.com${eventPath}`;

        console.log(`Processing CFP: ${eventName}`);

        // Extract location from "Where" column (2nd cell)
        const location = cells[1]?.textContent?.trim().substring(0, 200) || null;

        // Extract event date from "When" column (3rd cell)
        const eventDateStr = cells[2]?.textContent?.trim();
        const eventDate = parseDate(eventDateStr);

        // Extract deadline from "Deadline" column (4th cell)
        const deadlineStr = cells[3]?.textContent?.trim();
        const deadline = parseDate(deadlineStr);

        // Fetch detail page for description
        await delay(800); // Rate limiting: 800ms between requests
        
        let description = null;
        const detailResponse = await fetch(eventUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'http://www.wikicfp.com/cfp/call',
            'Connection': 'keep-alive',
          }
        });

        if (detailResponse.ok) {
          const detailHtml = await detailResponse.text();
          const detailDoc = new DOMParser().parseFromString(detailHtml, 'text/html');
          
          if (detailDoc) {
            // Extract description from the event detail page
            const descTable = detailDoc.querySelector('table.gglu');
            if (descTable) {
              const descCells = descTable.querySelectorAll('td');
              // Look for the cell containing description text
              for (const cell of descCells) {
                const text = cell.textContent?.trim();
                if (text && text.length > 100) {
                  description = text.substring(0, 2000);
                  break;
                }
              }
            }
          }
        }

        // Check if this opportunity already exists
        const { data: existing } = await supabase
          .from('opportunities')
          .select('id')
          .eq('event_url', eventUrl)
          .single();

        if (existing) {
          // Update scraped_at timestamp and other fields
          await supabase
            .from('opportunities')
            .update({ 
              scraped_at: new Date().toISOString(),
              deadline,
              event_date: eventDate,
              location,
              description: description || undefined,
            })
            .eq('id', existing.id);
          updated++;
          console.log(`Updated existing CFP: ${eventName}`);
        } else {
          // Insert new opportunity
          const { error: insertError } = await supabase
            .from('opportunities')
            .insert({
              event_name: eventName,
              event_url: eventUrl,
              description,
              deadline,
              event_date: eventDate,
              location,
              source: 'wikicfp',
              scraped_at: new Date().toISOString(),
              is_active: true,
            });

          if (insertError) {
            console.error(`Error inserting ${eventName}:`, insertError);
          } else {
            inserted++;
            console.log(`Inserted new CFP: ${eventName}`);
          }
        }
      } catch (error) {
        console.error(`Error processing row ${i}:`, error);
      }
    }

    // Update log with success
    await supabase
      .from('scraping_logs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        opportunities_found: inserted + updated,
        opportunities_inserted: inserted,
        opportunities_updated: updated,
      })
      .eq('id', logId);

    console.log(`WikiCFP scraping complete: ${inserted} inserted, ${updated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('WikiCFP scraping error:', error);

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
