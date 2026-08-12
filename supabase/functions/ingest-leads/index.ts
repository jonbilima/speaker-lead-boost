import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

interface IncomingRecord {
  event_name?: unknown;
  organization?: unknown;
  topic_or_industry?: unknown;
  location?: unknown;
  event_date?: unknown;
  application_deadline?: unknown;
  application_link?: unknown;
  vertical_tag?: unknown;
  source_name?: unknown;
  speaker_access?: unknown;
  is_open?: unknown;
  days_until_deadline?: unknown;
  lead_quality?: unknown;
  organizer_email?: unknown;
  organizer_name?: unknown;
  description?: unknown;
  audience_size?: unknown;
  fee_estimate_min?: unknown;
  fee_estimate_max?: unknown;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(n) && v.trim() !== "") return n;
  }
  return null;
}

/** Parse loose date strings ("2026-10-24", "Mon, Aug 17, 10:30 AM EDT") into ISO, else null. */
function toTimestamp(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString();
  // Handle formats like "Mon, Aug 17, 10:30 AM EDT" (no year)
  const m = s.match(/([A-Z][a-z]{2})\s+(\d{1,2})/);
  if (m) {
    const year = new Date().getUTCFullYear();
    const guess = Date.parse(`${m[1]} ${m[2]}, ${year} 00:00:00 UTC`);
    if (!Number.isNaN(guess)) return new Date(guess).toISOString();
  }
  return null;
}

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
    const rec = (item ?? {}) as IncomingRecord;
    const eventName = str(rec.event_name);
    const link = str(rec.application_link);
    if (!eventName || !link) {
      skippedInvalid++;
      continue;
    }

    const isOpen = rec.is_open === undefined || rec.is_open === null
      ? true
      : typeof rec.is_open === "boolean"
        ? rec.is_open
        : String(rec.is_open).toLowerCase() === "true";

    const descriptionParts = [
      str(rec.description),
      str(rec.topic_or_industry) ? `Topic: ${str(rec.topic_or_industry)}` : null,
      str(rec.vertical_tag) ? `Vertical: ${str(rec.vertical_tag)}` : null,
      str(rec.speaker_access) ? `Access: ${str(rec.speaker_access)}` : null,
      str(rec.lead_quality) ? `Lead quality: ${str(rec.lead_quality)}` : null,
    ].filter(Boolean);

    valid.push({
      event_name: eventName,
      event_url: link,
      organizer_name: str(rec.organizer_name) ?? str(rec.organization),
      organizer_email: str(rec.organizer_email),
      description: descriptionParts.length > 0 ? descriptionParts.join(" | ") : null,
      location: str(rec.location),
      deadline: toTimestamp(rec.application_deadline),
      event_date: toTimestamp(rec.event_date),
      fee_estimate_min: num(rec.fee_estimate_min),
      fee_estimate_max: num(rec.fee_estimate_max),
      audience_size: num(rec.audience_size),
      source: str(rec.source_name) ?? "ingest",
      is_active: isOpen,
      scraped_at: new Date().toISOString(),
      raw_data: item as Record<string, unknown>,
    });
  }

  // De-duplicate within the payload itself (last one wins)
  const byLink = new Map<string, Record<string, unknown>>();
  let skippedDuplicates = 0;
  for (const row of valid) {
    const link = row.event_url as string;
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
      .from("opportunities")
      .select("event_url")
      .in("event_url", links);

    if (lookupError) {
      console.error("Duplicate lookup failed:", lookupError);
      return new Response(JSON.stringify({ error: "Duplicate lookup failed" }), { status: 500, headers: jsonHeaders });
    }

    const existingLinks = new Set((existing ?? []).map((r) => r.event_url as string));
    const filtered = toInsert.filter((r) => !existingLinks.has(r.event_url as string));
    skippedDuplicates += toInsert.length - filtered.length;
    toInsert = filtered;
  }

  let inserted = 0;
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from("opportunities")
      .insert(toInsert)
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
