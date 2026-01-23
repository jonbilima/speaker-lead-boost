import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CalendarConnection {
  id: string;
  speaker_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  calendar_id: string;
  auto_sync_speaking: boolean;
  show_external_events: boolean;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink?: string;
}

interface CalendarEntry {
  id: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean;
  location?: string | null;
  notes?: string | null;
  is_virtual?: boolean;
  meeting_url?: string | null;
  google_calendar_id?: string | null;
  sync_status?: string;
}

// deno-lint-ignore no-explicit-any
async function refreshAccessToken(
  supabase: SupabaseClient<any, any, any>,
  connection: CalendarConnection
): Promise<string> {
  if (!connection.refresh_token) {
    throw new Error('No refresh token available');
  }

  // Check if token is expired
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at);
    if (expiresAt > new Date()) {
      return connection.access_token;
    }
  }

  // Refresh the token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await response.json();
  if (tokens.error) {
    throw new Error(`Token refresh failed: ${tokens.error}`);
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Update token in database
  await supabase
    .from('calendar_connections')
    .update({
      access_token: tokens.access_token,
      token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  return tokens.access_token;
}

async function pushToGoogle(
  accessToken: string,
  calendarId: string,
  entry: CalendarEntry
): Promise<{ googleEventId: string }> {
  const isAllDay = entry.all_day || !entry.start_time;
  
  let start: { date?: string; dateTime?: string };
  let end: { date?: string; dateTime?: string };

  if (isAllDay) {
    start = { date: entry.start_date };
    const endDate = entry.end_date || entry.start_date;
    // Google all-day events end date is exclusive, add 1 day
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    end = { date: endDateObj.toISOString().split('T')[0] };
  } else {
    start = { dateTime: `${entry.start_date}T${entry.start_time}:00` };
    const endDate = entry.end_date || entry.start_date;
    const endTime = entry.end_time || entry.start_time;
    end = { dateTime: `${endDate}T${endTime}:00` };
  }

  let description = entry.notes || '';
  if (entry.is_virtual && entry.meeting_url) {
    description += `\n\nMeeting URL: ${entry.meeting_url}`;
  }
  description += '\n\n---\nManaged by NextMic';

  const eventBody = {
    summary: entry.title,
    description: description.trim(),
    location: entry.location || undefined,
    start,
    end,
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create Google event: ${error.error?.message || response.statusText}`);
  }

  const googleEvent = await response.json();
  return { googleEventId: googleEvent.id };
}

async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string,
  entry: CalendarEntry
): Promise<void> {
  const isAllDay = entry.all_day || !entry.start_time;
  
  let start: { date?: string; dateTime?: string };
  let end: { date?: string; dateTime?: string };

  if (isAllDay) {
    start = { date: entry.start_date };
    const endDate = entry.end_date || entry.start_date;
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    end = { date: endDateObj.toISOString().split('T')[0] };
  } else {
    start = { dateTime: `${entry.start_date}T${entry.start_time}:00` };
    const endDate = entry.end_date || entry.start_date;
    const endTime = entry.end_time || entry.start_time;
    end = { dateTime: `${endDate}T${endTime}:00` };
  }

  let description = entry.notes || '';
  if (entry.is_virtual && entry.meeting_url) {
    description += `\n\nMeeting URL: ${entry.meeting_url}`;
  }
  description += '\n\n---\nManaged by NextMic';

  const eventBody = {
    summary: entry.title,
    description: description.trim(),
    location: entry.location || undefined,
    start,
    end,
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to update Google event: ${error.error?.message || response.statusText}`);
  }
}

// deno-lint-ignore no-explicit-any
async function pullFromGoogle(
  supabase: SupabaseClient<any, any, any>,
  accessToken: string,
  calendarId: string,
  speakerId: string
): Promise<{ imported: number; updated: number }> {
  // Fetch events from the last month to next 6 months
  const timeMin = new Date();
  timeMin.setMonth(timeMin.getMonth() - 1);
  const timeMax = new Date();
  timeMax.setMonth(timeMax.getMonth() + 6);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      }),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch Google events: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const events: GoogleEvent[] = data.items || [];

  let imported = 0;
  let updated = 0;

  for (const event of events) {
    // Skip events managed by NextMic (to avoid duplicates)
    if (event.description?.includes('Managed by NextMic')) {
      continue;
    }

    const isAllDay = !!event.start.date;
    const startDate = isAllDay 
      ? event.start.date 
      : event.start.dateTime?.split('T')[0];
    const endDate = isAllDay 
      ? event.end.date 
      : event.end.dateTime?.split('T')[0];
    const startTime = !isAllDay 
      ? event.start.dateTime?.split('T')[1]?.substring(0, 5) 
      : null;
    const endTime = !isAllDay 
      ? event.end.dateTime?.split('T')[1]?.substring(0, 5) 
      : null;

    if (!startDate) continue;

    // Check if already exists
    const { data: existingData } = await supabase
      .from('speaker_calendar')
      .select('id, updated_at')
      .eq('speaker_id', speakerId)
      .eq('google_calendar_id', event.id)
      .single();

    const entryData = {
      speaker_id: speakerId,
      title: event.summary || 'Untitled',
      entry_type: 'external',
      start_date: startDate,
      end_date: endDate !== startDate ? endDate : null,
      start_time: startTime,
      end_time: endTime,
      all_day: isAllDay,
      location: event.location || null,
      notes: event.description || null,
      google_calendar_id: event.id,
      external_source: 'google',
      sync_status: 'synced',
    };

    if (existingData) {
      // Update existing
      await supabase
        .from('speaker_calendar')
        .update(entryData)
        .eq('id', existingData.id);
      updated++;
    } else {
      // Insert new
      await supabase.from('speaker_calendar').insert(entryData);
      imported++;
    }
  }

  return { imported, updated };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid user token');

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'full-sync';

    // Get user's calendar connection
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('speaker_id', user.id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'No active Google Calendar connection found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh access token if needed
    const accessToken = await refreshAccessToken(supabase, connection as CalendarConnection);
    const calendarId = connection.calendar_id || 'primary';

    const results: {
      pushed?: { created: number; updated: number };
      pulled?: { imported: number; updated: number };
      errors: string[];
    } = { errors: [] };

    // PUSH: Sync local events to Google
    if (action === 'push' || action === 'full-sync') {
      if (connection.auto_sync_speaking) {
        // Get entries that need syncing (speaking_engagement, event, deadline types)
        const { data: entriesToPush } = await supabase
          .from('speaker_calendar')
          .select('*')
          .eq('speaker_id', user.id)
          .in('entry_type', ['speaking_engagement', 'event', 'deadline'])
          .or('sync_status.eq.local,sync_status.eq.pending');

        let created = 0;
        let updated = 0;

        for (const entry of entriesToPush || []) {
          try {
            const calEntry = entry as CalendarEntry;
            if (calEntry.google_calendar_id) {
              // Update existing Google event
              await updateGoogleEvent(accessToken, calendarId, calEntry.google_calendar_id, calEntry);
              updated++;
            } else {
              // Create new Google event
              const { googleEventId } = await pushToGoogle(accessToken, calendarId, calEntry);
              await supabase
                .from('speaker_calendar')
                .update({ 
                  google_calendar_id: googleEventId, 
                  sync_status: 'synced',
                  sync_error: null,
                })
                .eq('id', calEntry.id);
              created++;
            }

            await supabase
              .from('speaker_calendar')
              .update({ sync_status: 'synced', sync_error: null })
              .eq('id', entry.id);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            results.errors.push(`Failed to push "${entry.title}": ${errorMessage}`);
            await supabase
              .from('speaker_calendar')
              .update({ sync_status: 'error', sync_error: errorMessage })
              .eq('id', entry.id);
          }
        }

        results.pushed = { created, updated };
      }
    }

    // PULL: Sync Google events to local
    if (action === 'pull' || action === 'full-sync') {
      if (connection.show_external_events) {
        try {
          results.pulled = await pullFromGoogle(supabase, accessToken, calendarId, user.id);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`Failed to pull from Google: ${errorMessage}`);
        }
      }
    }

    // Update last sync time
    await supabase
      .from('calendar_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_errors: results.errors.length > 0 ? results.errors : [],
      })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...results,
        lastSyncAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Sync error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
