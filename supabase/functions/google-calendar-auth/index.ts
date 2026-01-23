import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Google Calendar OAuth scopes
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    
    if (action === 'get-auth-url') {
      // Generate OAuth URL for user to authorize
      if (!authHeader) {
        throw new Error('Authorization header required');
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) throw new Error('Invalid user token');

      const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`;
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', user.id); // Pass user ID in state

      return new Response(
        JSON.stringify({ url: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'callback') {
      // Handle OAuth callback from Google
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state'); // user ID
      const error = url.searchParams.get('error');

      if (error) {
        return new Response(
          `<html><body><script>window.opener.postMessage({ type: 'google-calendar-error', error: '${error}' }, '*'); window.close();</script></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      if (!code || !state) {
        throw new Error('Missing code or state');
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`;

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (tokens.error) {
        console.error('Token exchange error:', tokens);
        return new Response(
          `<html><body><script>window.opener.postMessage({ type: 'google-calendar-error', error: '${tokens.error_description || tokens.error}' }, '*'); window.close();</script></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      // Get user info to get email
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Save to database (upsert)
      const { error: dbError } = await supabase
        .from('calendar_connections')
        .upsert({
          speaker_id: state,
          provider: 'google',
          email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'speaker_id,provider',
        });

      if (dbError) {
        console.error('Database error:', dbError);
        return new Response(
          `<html><body><script>window.opener.postMessage({ type: 'google-calendar-error', error: 'Failed to save connection' }, '*'); window.close();</script></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      // Success - close popup and notify parent
      return new Response(
        `<html><body><script>window.opener.postMessage({ type: 'google-calendar-connected', email: '${userInfo.email}' }, '*'); window.close();</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (action === 'disconnect') {
      if (!authHeader) {
        throw new Error('Authorization header required');
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) throw new Error('Invalid user token');

      // Get connection to revoke token
      const { data: connection } = await supabase
        .from('calendar_connections')
        .select('access_token')
        .eq('speaker_id', user.id)
        .eq('provider', 'google')
        .single();

      if (connection?.access_token) {
        // Revoke token with Google
        await fetch(`https://oauth2.googleapis.com/revoke?token=${connection.access_token}`, {
          method: 'POST',
        });
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('calendar_connections')
        .delete()
        .eq('speaker_id', user.id)
        .eq('provider', 'google');

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
