// TEMPORARY: lists Apify runs still RUNNING/READY on this account and aborts them. Admin only.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateAuth, unauthorizedResponse, forbiddenResponse, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const cronSecret = Deno.env.get('EXPIRY_CRON_SECRET') ?? '';
  const cronOk = cronSecret.length > 0 && (req.headers.get('x-cron-secret') ?? '').trim() === cronSecret;
  if (!cronOk) {
    const auth = await validateAuth(req);
    if (auth.error || !auth.user) return unauthorizedResponse(auth.error || 'Unauthorized');
    if (!auth.isAdmin) return forbiddenResponse('Admin only');
  }
  const key = Deno.env.get('APIFY_API_KEY');
  if (!key) return new Response(JSON.stringify({ error: 'no key' }), { status: 500, headers: corsHeaders });
  const h = { Authorization: `Bearer ${key}` };
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  const out: unknown[] = [];
  for (const status of ['RUNNING', 'READY']) {
    const r = await fetch(`https://api.apify.com/v2/actor-runs?status=${status}&limit=100`, { headers: h });
    const j = await r.json();
    for (const run of j?.data?.items ?? []) {
      let aborted: string | null = null;
      if (!dry) {
        const a = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}/abort`, { method: 'POST', headers: h });
        aborted = `${a.status}`;
      }
      out.push({ id: run.id, actId: run.actId, status: run.status, startedAt: run.startedAt, aborted });
    }
  }
  const rr = await fetch(`https://api.apify.com/v2/actor-runs?desc=1&limit=10`, { headers: h }); const recent = await rr.json(); out.push({ listStatus: rr.status, err: recent?.error ?? null, total: recent?.data?.total ?? null });
  const recentRuns = (recent?.data?.items ?? []).map((x: { id: string; status: string; startedAt: string; finishedAt: string }) => ({ id: x.id, status: x.status, startedAt: x.startedAt, finishedAt: x.finishedAt }));
  return new Response(JSON.stringify({ dry, active: out, recentRuns }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
