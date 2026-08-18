import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { corsHeaders, validateAuth, unauthorizedResponse } from "../_shared/auth.ts";

interface Payload {
  event_name?: string;
  organizer_name?: string | null;
  organizer_email?: string | null;
  event_url?: string | null;
  location?: string | null;
  event_date?: string | null;
  deadline?: string | null;
  fee_estimate_min?: number | null;
  fee_estimate_max?: number | null;
  audience_size?: number | null;
  description?: string | null;
  covers_travel?: boolean | null;
  covers_accommodation?: boolean | null;
}

const str = (v: unknown, max = 2000): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const ts = (v: unknown): string | null => {
  const s = str(v, 40);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // User is derived from the Authorization header only.
    const { user, error: authError } = await validateAuth(req);
    if (!user) return unauthorizedResponse(authError || 'Unauthorized');

    const body = (await req.json().catch(() => ({}))) as Payload;

    const event_name = str(body.event_name, 300);
    if (!event_name) {
      return new Response(JSON.stringify({ error: 'event_name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event_url = str(body.event_url, 1000);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Duplicate check on event_url — reuse the existing row rather than inserting.
    let opportunityId: string | null = null;
    let alreadyExisted = false;

    if (event_url) {
      const { data: existing, error: dupError } = await supabase
        .from('opportunities')
        .select('id, is_active')
        .eq('event_url', event_url)
        .limit(1)
        .maybeSingle();

      if (dupError) throw dupError;

      if (existing) {
        opportunityId = existing.id;
        alreadyExisted = true;
      }
    }

    if (!opportunityId) {
      const { data: inserted, error: insertError } = await supabase
        .from('opportunities')
        .insert({
          event_name,
          organizer_name: str(body.organizer_name, 200),
          organizer_email: str(body.organizer_email, 320),
          event_url,
          location: str(body.location, 300),
          event_date: ts(body.event_date),
          deadline: ts(body.deadline),
          fee_estimate_min: num(body.fee_estimate_min),
          fee_estimate_max: num(body.fee_estimate_max),
          audience_size: num(body.audience_size),
          description: str(body.description, 5000),
          covers_travel: typeof body.covers_travel === 'boolean' ? body.covers_travel : null,
          covers_accommodation: typeof body.covers_accommodation === 'boolean' ? body.covers_accommodation : null,
          source: 'user_submitted',
          submitted_by: user.id,
          is_verified: false,
          is_active: true,
          scraped_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      opportunityId = inserted.id;
    }

    // Score for this user only (deterministic, single fast pass).
    const { error: scoreError } = await supabase.rpc('score_opportunities_for_user', {
      p_user_id: user.id,
    });
    if (scoreError) console.error('Scoring failed:', scoreError);

    const { data: score } = await supabase
      .from('opportunity_scores')
      .select('ai_score, topic_match_score, fee_alignment_score, deadline_urgency_score')
      .eq('opportunity_id', opportunityId)
      .eq('user_id', user.id)
      .maybeSingle();

    return new Response(JSON.stringify({
      success: true,
      opportunity_id: opportunityId,
      already_existed: alreadyExisted,
      ai_score: score?.ai_score ?? null,
      scored: !scoreError,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('submit-and-score-opportunity error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
