import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const FIELDS = [
  "event_name",
  "organization",
  "topic_or_industry",
  "location",
  "event_date",
  "application_deadline",
  "application_link",
  "vertical_tag",
  "source_name",
  "speaker_access",
  "is_open",
  "days_until_deadline",
  "lead_quality",
] as const;

type Record_ = Partial<Record<(typeof FIELDS)[number], unknown>>;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  const expected = Deno.env.get("INGEST_LEADS_TOKEN");
  if (!expected) {
    console.error("INGEST_LEADS_TOKEN is not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: jsonHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
  }

  const raw: unknown = Array.isArray(body)
    ? body
    : (body as { records?: unknown; data?: unknown })?.records ?? (body as { data?: unknown })?.data;

  if (!Array.isArray(raw)) {
    return new Response(
      JSON.stringify({ error: "Body must be an array of records or { records: [...] }" }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const received = raw.length;
  const valid: Record<string, unknown>[] = [];
  let skippedInvalid = 0;

  for (const item of raw) {
    const rec = item as Record_;
    const eventName = typeof rec?.event_name === "string" ? rec.event_name.trim() : "";
    const link = typeof rec?.application_link === "string" ? rec.application_link.trim() : "";
    if (!eventName || !link) {
      skippedInvalid++;
      continue;
    }
    const row: Record<string, unknown> = {};
    for (const f of FIELDS) {
      if (rec[f] !== undefined) row[f] = rec[f];
    }
    row.event_name = eventName;
    row.application_link = link;
    if (row.is_open !== undefined && typeof row.is_open !== "boolean") {
      row.is_open = String(row.is_open).toLowerCase() === "true";
    }
    valid.push(row);
  }

  // De-duplicate within the payload itself (last one wins)
  const byLink = new Map<string, Record<string, unknown>>();
  let skippedDuplicates = 0;
  for (const row of valid) {
    const link = row.application_link as string;
    if (byLink.has(link)) skippedDuplicates++;
    byLink.set(link, row);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const links = [...byLink.keys()];
  let toInsert = [...byLink.values()];

  if (links.length > 0) {
    const { data: existing, error: lookupError } = await supabase
      .from("speaking_opportunities")
      .select("application_link")
      .in("application_link", links);

    if (lookupError) {
      console.error("Duplicate lookup failed:", lookupError);
      return new Response(JSON.stringify({ error: "Duplicate lookup failed" }), { status: 500, headers: jsonHeaders });
    }

    const existingLinks = new Set((existing ?? []).map((r) => r.application_link as string));
    const filtered = toInsert.filter((r) => !existingLinks.has(r.application_link as string));
    skippedDuplicates += toInsert.length - filtered.length;
    toInsert = filtered;
  }

  let inserted = 0;
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from("speaking_opportunities")
      .upsert(toInsert, { onConflict: "application_link", ignoreDuplicates: true })
      .select("id");

    if (error) {
      console.error("Insert failed:", error);
      return new Response(JSON.stringify({ error: "Insert failed", details: error.message }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    inserted = data?.length ?? 0;
    skippedDuplicates += toInsert.length - inserted;
  }

  console.log(`ingest-leads: received=${received} inserted=${inserted} duplicates=${skippedDuplicates} invalid=${skippedInvalid}`);

  return new Response(
    JSON.stringify({
      received,
      inserted,
      skipped_duplicates: skippedDuplicates,
      skipped_invalid: skippedInvalid,
    }),
    { status: 200, headers: jsonHeaders },
  );
});
