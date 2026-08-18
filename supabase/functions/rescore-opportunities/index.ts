import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { corsHeaders, validateAuth, unauthorizedResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Derive user strictly from the Authorization header; body is ignored.
    const { user, error: authError } = await validateAuth(req);
    if (!user) {
      return unauthorizedResponse(authError || 'Unauthorized');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const started = Date.now();
    const { data, error } = await supabase.rpc('score_opportunities_for_user', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('score_opportunities_for_user failed:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scored_count = typeof data === 'number' ? data : 0;
    console.log(`Scored ${scored_count} opportunities for ${user.id} in ${Date.now() - started}ms`);

    return new Response(JSON.stringify({ success: true, scored_count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
