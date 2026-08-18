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

/**
 * Parse loose date strings ("2026-10-24", "Mon, Aug 17, 10:30 AM EDT") into ISO, else null.
 * A value with no date component at all ("9:00 AM", "TBD") returns null rather than a
 * bogus date in the distant past.
 */
function toTimestamp(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;

  const hasYear = /\b(19|20)\d{2}\b/.test(s);
  const monthDay = s.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i,
  );
  const numericDate = /\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?/.test(s);

  // No date component whatsoever -> not a date.
  if (!hasYear && !monthDay && !numericDate) return null;

  if (hasYear || numericDate) {
    const iso = Date.parse(s);
    if (!Number.isNaN(iso)) {
      const d = new Date(iso);
      if (isPlausibleYear(d)) return d.toISOString();
    }
  }

  // Month + day but no year (e.g. "Mon, Aug 17, 10:30 AM EDT"): assume the
  // nearest upcoming occurrence.
  if (monthDay) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const guess = Date.parse(`${monthDay[1]} ${monthDay[2]}, ${year} 00:00:00 UTC`);
    if (!Number.isNaN(guess)) {
      let d = new Date(guess);
      // More than 6 months in the past -> it almost certainly means next year.
      if (d.getTime() < now.getTime() - 182 * 86400000) {
        d = new Date(Date.parse(`${monthDay[1]} ${monthDay[2]}, ${year + 1} 00:00:00 UTC`));
      }
      if (isPlausibleYear(d)) return d.toISOString();
    }
  }

  return null;
}

function isPlausibleYear(d: Date): boolean {
  const y = d.getUTCFullYear();
  const current = new Date().getUTCFullYear();
  return y >= current - 1 && y <= current + 10;
}

const TRUE_VALUES = new Set(["1", "true", "yes", "open", "y", "t"]);
const FALSE_VALUES = new Set(["0", "false", "no", "closed", "n", "f"]);

/**
 * Coerce a loose is_open value. Unrecognized or absent -> true (never silently
 * kill a lead from an active CFP feed on a parsing miss).
 */
function toIsOpen(v: unknown): { value: boolean; unrecognized: string | null } {
  if (v === undefined || v === null || v === "") return { value: true, unrecognized: null };
  if (typeof v === "boolean") return { value: v, unrecognized: null };
  const key = String(v).trim().toLowerCase();
  if (TRUE_VALUES.has(key)) return { value: true, unrecognized: null };
  if (FALSE_VALUES.has(key)) return { value: false, unrecognized: null };
  return { value: true, unrecognized: String(v) };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Long-form vertical names (as sent by the automation) -> canonical slugs. */
const VERTICAL_MAP: Record<string, string> = {
  "corporate and business leadership": "business",
  "sales and marketing": "sales_marketing",
  "faith and church": "faith",
  "healthcare and medical associations": "healthcare",
  "technology and ai": "technology",
  "education and k-12/higher ed": "education",
  "human resources and workplace culture": "hr_workplace",
  "finance and accounting": "finance",
  "nonprofit and associations": "nonprofit",
  "real estate and construction": "real_estate",
};

const CANONICAL_SLUGS = new Set(Object.values(VERTICAL_MAP));

function toVerticalSlug(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const key = s.toLowerCase().trim().replace(/\s+/g, " ");
  if (VERTICAL_MAP[key]) return VERTICAL_MAP[key];
  const asSlug = key.replace(/[\s-]+/g, "_");
  if (CANONICAL_SLUGS.has(asSlug)) return asSlug;
  return null;
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
  const unmappedVerticals: string[] = [];

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

    const verticalRaw = str(rec.vertical_tag);
    const verticalSlug = toVerticalSlug(rec.vertical_tag);
    if (verticalRaw && !verticalSlug) unmappedVerticals.push(verticalRaw);

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
      ingest_source: "ingest-leads",
      vertical_slug: verticalSlug,
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

  const insertedRows = toInsert;
  const mappedVertical = insertedRows.filter((r) => r.vertical_slug !== null).length;
  const unmappedVertical = insertedRows.length - mappedVertical;
  const unmappedValues = [...new Set(unmappedVerticals)];

  console.log(
    `ingest-leads: received=${received} inserted=${inserted} duplicates=${skippedDuplicates} invalid=${skippedInvalid} mapped_vertical=${mappedVertical} unmapped_vertical=${unmappedVertical} unmapped_values=${JSON.stringify(unmappedValues)}`,
  );

  return new Response(
    JSON.stringify({
      received,
      inserted,
      skipped_duplicates: skippedDuplicates,
      skipped_invalid: skippedInvalid,
      mapped_vertical: mappedVertical,
      unmapped_vertical: unmappedVertical,
      unmapped_vertical_values: unmappedValues,
    }),
    { status: 200, headers: jsonHeaders },
  );
});
