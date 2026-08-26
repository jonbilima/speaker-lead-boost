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
  country?: unknown;
  city?: unknown;
  state?: unknown;
  location_confidence?: unknown;
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

/**
 * Keyword -> canonical topics.name. Matching is substring-based against the
 * lowercased topic_or_industry value. Topics are never created automatically:
 * a value that matches nothing is reported, and the opportunity still inserts.
 */
const TOPIC_ALIASES: [string, string][] = [
  ["artificial intelligence", "Artificial Intelligence"],
  ["genai", "Artificial Intelligence"],
  ["ai/ml", "Artificial Intelligence"],
  ["ai summit", "Artificial Intelligence"],
  ["machine learning", "Machine Learning"],
  ["devops", "DevOps"],
  ["technology", "Technology"],
  ["tech conference", "Technology"],
  ["tech leadership", "Technology"],
  ["software development", "Software Engineering"],
  ["software engineering", "Software Engineering"],
  ["platform engineering", "Software Engineering"],
  ["microservices", "Software Engineering"],
  ["site reliability", "Software Engineering"],
  ["human resources", "Human Resources"],
  ["construction", "Construction"],
  ["cloud", "Cloud Computing"],
  ["aws", "Cloud Computing"],
  ["serverless", "Cloud Computing"],
  ["kubernetes", "Cloud Computing"],
  ["containers", "Cloud Computing"],
  ["cybersecurity", "Cybersecurity"],
  ["data", "Data Science"],
  ["leadership", "Leadership"],
  ["executive", "Executive Presence"],
  ["sales", "Sales Strategy"],
  ["marketing", "Digital Marketing"],
  ["church", "Faith-Based / Spiritual"],
  ["ministry", "Faith-Based / Spiritual"],
  ["faith", "Faith-Based / Spiritual"],
  ["medical", "Healthcare"],
  ["healthcare", "Healthcare"],
  ["finance", "Financial Services"],
  ["financial", "Financial Services"],
  ["accounting", "Financial Services"],
  ["diversity", "Diversity & Inclusion"],
  ["inclusion", "Diversity & Inclusion"],
  ["higher education", "Higher Education"],
  ["education", "Education"],
  ["k-12", "Education"],
  ["property management", "Real Estate"],
  ["real estate", "Real Estate"],
  ["workplace culture", "Team Building"],
  ["nonprofit", "Nonprofit / Social Impact"],
  ["association", "Nonprofit / Social Impact"],
  ["startup", "Startup Growth"],
  ["entrepreneur", "Entrepreneurship"],
  ["innovation", "Innovation"],
  ["product management", "Product Management"],
  ["agile", "Agile Methodology"],
  ["blockchain", "Blockchain"],
  ["fintech", "Fintech"],
  ["e-commerce", "E-commerce"],
  ["ecommerce", "E-commerce"],
  ["saas", "SaaS"],
  ["remote work", "Remote Work"],
  ["mental health", "Mental Health"],
  ["wellness", "Wellness"],
  ["public speaking", "Public Speaking"],
  ["storytelling", "Storytelling"],
  ["manufacturing", "Manufacturing"],
  ["government", "Government / Public Sector"],
  ["public sector", "Government / Public Sector"],
  ["performance", "Productivity"],
  ["networking", "Networking"],
  ["resilience", "Resilience"],
  ["motivation", "Motivation"],
];

/** Returns the canonical topic names a raw topic_or_industry value maps to. */
function matchTopicNames(value: string): string[] {
  const hay = value.toLowerCase();
  const names = new Set<string>();
  for (const [kw, topic] of TOPIC_ALIASES) {
    if (hay.includes(kw)) names.add(topic);
  }
  return [...names];
}

function toVerticalSlug(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const key = s.toLowerCase().trim().replace(/\s+/g, " ");
  if (VERTICAL_MAP[key]) return VERTICAL_MAP[key];
  const asSlug = key.replace(/[\s-]+/g, "_");
  if (CANONICAL_SLUGS.has(asSlug)) return asSlug;
  return null;
}

// ---------------------------------------------------------------------------
// Location: country / city / state / confidence
// ---------------------------------------------------------------------------

/**
 * "Virtual" and "Global" are a location *type*, not a country. When the payload
 * sends one of these as the country we drop it and fall back to organization
 * signals (state, city, US-shaped host) to decide the real country.
 */
const VIRTUAL_TOKENS =
  /^(virtual|online|remote|global|worldwide|international|hybrid|anywhere|tbd|tba|n\/?a|unknown|-)$/i;

const US_ALIASES = new Set([
  "us",
  "usa",
  "u.s.",
  "u.s.a.",
  "united states",
  "united states of america",
  "america",
]);

const US_STATES = new Set([
  "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia","ks","ky","la","me","md",
  "ma","mi","mn","ms","mo","mt","ne","nv","nh","nj","nm","ny","nc","nd","oh","ok","or","pa","ri","sc",
  "sd","tn","tx","ut","vt","va","wa","wv","wi","wy","dc",
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware","florida",
  "georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky","louisiana","maine",
  "maryland","massachusetts","michigan","minnesota","mississippi","missouri","montana","nebraska",
  "nevada","new hampshire","new jersey","new mexico","new york","north carolina","north dakota","ohio",
  "oklahoma","oregon","pennsylvania","rhode island","south carolina","south dakota","tennessee","texas",
  "utah","vermont","virginia","washington","west virginia","wisconsin","wyoming",
  "district of columbia","washington dc","washington d.c.",
]);

function isVirtualToken(s: string | null): boolean {
  return !!s && VIRTUAL_TOKENS.test(s.trim());
}

/** Canonicalize a country string. Returns null for virtual/global/unknown tokens. */
function normalizeCountry(v: unknown): string | null {
  const s = str(v);
  if (!s || isVirtualToken(s)) return null;
  const key = s.toLowerCase().replace(/\s+/g, " ").trim();
  if (US_ALIASES.has(key)) return "United States";
  return s.trim();
}

/** True when the value looks like a US state name or postal abbreviation. */
function isUsState(v: string | null): boolean {
  if (!v) return false;
  return US_STATES.has(v.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim());
}

function hasUsHostSignal(url: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).host.toLowerCase();
    return /\.(us|edu|gov|mil)$/.test(host);
  } catch {
    return false;
  }
}

/**
 * Resolve the country for an incoming record.
 * Precedence: explicit non-virtual payload country -> US signals (state, host)
 * -> null (let the database trigger derive it from the location text).
 * The returned `explicit` flag marks values we trust enough to overwrite a
 * previously derived country on a duplicate.
 */
function resolveCountry(
  rec: IncomingRecord,
  state: string | null,
  location: string | null,
): { country: string | null; explicit: boolean; locationType: string | null } {
  const rawCountry = str(rec.country);
  const virtual = isVirtualToken(rawCountry) || isVirtualToken(location);
  const locationType = virtual ? (str(rec.country) ?? location)!.trim().toLowerCase() : null;

  const normalized = normalizeCountry(rawCountry);
  if (normalized) return { country: normalized, explicit: true, locationType };

  // Virtual / global / missing country: infer from the hosting organization.
  if (isUsState(state) || hasUsHostSignal(str(rec.application_link))) {
    return { country: "United States", explicit: true, locationType };
  }

  return { country: null, explicit: false, locationType };
}


// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

const TRACKING_PARAMS = /^(utm_|ref$|ref_|fbclid$|gclid$|mc_cid$|mc_eid$|source$|src$|campaign$)/i;

/** Normalize a URL for duplicate matching: scheme/host case, www, tracking params, trailing slash, hash. */
function canonicalizeUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u.trim());
    url.hash = "";
    url.protocol = "https:";
    url.host = url.host.toLowerCase().replace(/^www\./, "");
    const keep: [string, string][] = [];
    for (const [k, v] of url.searchParams) {
      if (!TRACKING_PARAMS.test(k)) keep.push([k, v]);
    }
    keep.sort((a, b) => a[0].localeCompare(b[0]));
    url.search = "";
    for (const [k, v] of keep) url.searchParams.append(k, v);
    let out = url.toString();
    out = out.replace(/\/(\?|$)/, "$1");
    return out.toLowerCase();
  } catch {
    return u.trim().toLowerCase().replace(/\/+$/, "") || null;
  }
}

const NAME_SUFFIXES =
  /\b(inc|inc\.|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|gmbh|plc|foundation|association)\b/g;

/** Normalize an event/org name: case, leading articles, corporate suffixes, punctuation. */
function normalizeName(s: string | null): string | null {
  if (!s) return null;
  let n = s.toLowerCase();
  n = n.replace(NAME_SUFFIXES, " ");
  n = n.replace(/[^a-z0-9]+/g, " ");
  n = n.replace(/^\s*(the|a|an)\s+/, " ");
  n = n.replace(/\s+/g, " ").trim();
  return n.length > 0 ? n : null;
}

/**
 * Fuzzy identity key: normalized event name + event date (day precision).
 * Requires a real date so undated index/listing pages never collapse together.
 */
function buildFingerprint(eventName: string | null, eventDate: string | null): string | null {
  const name = normalizeName(eventName);
  if (!name || !eventDate) return null;
  const day = eventDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return `${name}|${day}`;
}

/** Higher wins. Organizer-direct feeds are trusted over aggregators. */
const SOURCE_TRUST: Record<string, number> = {
  user_submitted: 100,
  manual: 90,
  sessionize: 70,
  callingallpapers: 60,
  papercall: 60,
  conferencelist: 50,
  eventbrite: 40,
  meetup: 30,
  ingest: 20,
};

function sourceTrust(source: unknown): number {
  const s = str(source)?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  for (const [key, score] of Object.entries(SOURCE_TRUST)) {
    if (s.includes(key.replace(/[^a-z]/g, ""))) return score;
  }
  return 10;
}

const ENRICHABLE_FIELDS = [
  "organizer_name",
  "organizer_email",
  "description",
  "location",
  "deadline",
  "event_date",
  "fee_estimate_min",
  "fee_estimate_max",
  "audience_size",
  "vertical_slug",
  "canonical_url",
  "event_fingerprint",
  "country",
  "city",
  "state",
  "location_confidence",
  "organization_website",
] as const;


function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/** Quote a value for a PostgREST `in.(...)` list. */
function quoteIn(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Never downgrade a populated field: only fill blanks on the surviving row.
 * event_url is the single exception — it is upgraded when the incoming record
 * comes from a strictly more trusted source.
 */
function buildEnrichment(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of ENRICHABLE_FIELDS) {
    if (isEmpty(existing[field]) && !isEmpty(incoming[field])) {
      patch[field] = incoming[field];
    }
  }
  if (sourceTrust(incoming.source) > sourceTrust(existing.source)) {
    if (!isEmpty(incoming.event_url) && incoming.event_url !== existing.event_url) {
      patch.event_url = incoming.event_url;
      patch.canonical_url = incoming.canonical_url;
      patch.source = incoming.source;
    }
  }
  // An explicit payload country always beats a previously derived one, and the
  // structured city/state/confidence that came with it travel together.
  if (incoming.__explicit_country === true && incoming.country !== existing.country) {
    patch.country = incoming.country;
    if (!isEmpty(incoming.city)) patch.city = incoming.city;
    if (!isEmpty(incoming.state)) patch.state = incoming.state;
    if (!isEmpty(incoming.location_confidence)) {
      patch.location_confidence = incoming.location_confidence;
    }
  }
  return patch;
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
  const unrecognizedIsOpen: string[] = [];

  for (const item of raw) {
    const rec = (item ?? {}) as IncomingRecord;
    const eventName = str(rec.event_name);
    const link = str(rec.application_link);
    if (!eventName || !link) {
      skippedInvalid++;
      continue;
    }

    const openParsed = toIsOpen(rec.is_open);
    const isOpen = openParsed.value;
    if (openParsed.unrecognized !== null) unrecognizedIsOpen.push(openParsed.unrecognized);

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

    const eventDateIso = toTimestamp(rec.event_date);
    valid.push({
      event_name: eventName,
      event_url: link,
      canonical_url: canonicalizeUrl(link),
      event_fingerprint: buildFingerprint(eventName, eventDateIso),
      organizer_name: str(rec.organizer_name) ?? str(rec.organization),
      organizer_email: str(rec.organizer_email),
      description: descriptionParts.length > 0 ? descriptionParts.join(" | ") : null,
      location: str(rec.location),
      deadline: toTimestamp(rec.application_deadline),
      event_date: eventDateIso,
      fee_estimate_min: num(rec.fee_estimate_min),
      fee_estimate_max: num(rec.fee_estimate_max),
      audience_size: num(rec.audience_size),
      source: str(rec.source_name) ?? "ingest",
      ingest_source: "ingest-leads",
      vertical_slug: verticalSlug,
      is_active: isOpen,
      scraped_at: new Date().toISOString(),
      raw_data: item as Record<string, unknown>,
      __topic_raw: str(rec.topic_or_industry),
    });
  }

  // De-duplicate within the payload itself: canonical URL first, then fingerprint.
  let skippedDuplicates = 0;
  const deduped: Record<string, unknown>[] = [];
  const seenUrl = new Map<string, number>();
  const seenFp = new Map<string, number>();
  for (const row of valid) {
    const urlKey = (row.canonical_url as string | null) ?? (row.event_url as string);
    const fpKey = row.event_fingerprint as string | null;
    const hit = seenUrl.get(urlKey) ?? (fpKey ? seenFp.get(fpKey) : undefined);
    if (hit !== undefined) {
      // Last one wins on blanks only; never downgrade a populated field.
      const patch = buildEnrichment(deduped[hit], row);
      Object.assign(deduped[hit], patch);
      skippedDuplicates++;
      continue;
    }
    const idx = deduped.push(row) - 1;
    seenUrl.set(urlKey, idx);
    if (fpKey) seenFp.set(fpKey, idx);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let toInsert = deduped;
  let matchedByUrl = 0;
  let matchedByCanonicalUrl = 0;
  let matchedByFingerprint = 0;
  let enrichedRows = 0;
  let enrichedFields = 0;
  const fuzzyMatchLog: Record<string, unknown>[] = [];

  if (deduped.length > 0) {
    const urls = deduped.map((r) => r.event_url as string);
    const canon = deduped.map((r) => r.canonical_url as string | null).filter((v): v is string => !!v);
    const fps = deduped.map((r) => r.event_fingerprint as string | null).filter((v): v is string => !!v);

    const selectCols =
      "id, event_name, event_url, canonical_url, event_fingerprint, source, organizer_name, organizer_email, description, location, deadline, event_date, fee_estimate_min, fee_estimate_max, audience_size, vertical_slug, merged_into";

    const orParts = [`event_url.in.(${urls.map(quoteIn).join(",")})`];
    if (canon.length > 0) orParts.push(`canonical_url.in.(${canon.map(quoteIn).join(",")})`);
    if (fps.length > 0) orParts.push(`event_fingerprint.in.(${fps.map(quoteIn).join(",")})`);

    const { data: existing, error: lookupError } = await supabase
      .from("opportunities")
      .select(selectCols)
      .is("merged_into", null)
      .or(orParts.join(","));

    if (lookupError) {
      console.error("Duplicate lookup failed:", lookupError);
      return new Response(JSON.stringify({ error: "Duplicate lookup failed" }), { status: 500, headers: jsonHeaders });
    }

    const rows = (existing ?? []) as Record<string, unknown>[];
    const byUrl = new Map<string, Record<string, unknown>>();
    const byCanon = new Map<string, Record<string, unknown>>();
    const byFp = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      if (r.event_url) byUrl.set(r.event_url as string, r);
      if (r.canonical_url) byCanon.set(r.canonical_url as string, r);
      if (r.event_fingerprint) byFp.set(r.event_fingerprint as string, r);
    }

    const fresh: Record<string, unknown>[] = [];
    for (const row of deduped) {
      const canonKey = row.canonical_url as string | null;
      const fpKey = row.event_fingerprint as string | null;

      let match = byUrl.get(row.event_url as string);
      let matchType: "event_url" | "canonical_url" | "fingerprint" | null = match ? "event_url" : null;
      if (!match && canonKey && byCanon.has(canonKey)) {
        match = byCanon.get(canonKey);
        matchType = "canonical_url";
      }
      if (!match && fpKey && byFp.has(fpKey)) {
        match = byFp.get(fpKey);
        matchType = "fingerprint";
      }

      if (!match || !matchType) {
        fresh.push(row);
        continue;
      }

      if (matchType === "event_url") matchedByUrl++;
      else if (matchType === "canonical_url") matchedByCanonicalUrl++;
      else matchedByFingerprint++;

      skippedDuplicates++;

      const patch = buildEnrichment(match, row);

      if (matchType === "fingerprint") {
        // Audit trail: enough detail to judge whether the fuzzy match was correct.
        const entry = {
          match_type: "fingerprint",
          shared_date: ((match.event_date as string | null) ?? "").slice(0, 10),
          fingerprint: fpKey,
          existing: {
            id: match.id,
            event_name: match.event_name,
            event_url: match.event_url,
            source: match.source,
          },
          incoming: {
            event_name: row.event_name,
            event_url: row.event_url,
            source: row.source,
          },
          fields_enriched: Object.keys(patch),
        };
        fuzzyMatchLog.push(entry);
        console.log(`ingest-leads fuzzy-match: ${JSON.stringify(entry)}`);
      }

      if (Object.keys(patch).length > 0) {
        const { error: updErr } = await supabase
          .from("opportunities")
          .update(patch)
          .eq("id", match.id as string);
        if (updErr) {
          console.error(`Enrichment update failed for ${match.id}:`, updErr);
        } else {
          enrichedRows++;
          enrichedFields += Object.keys(patch).length;
          Object.assign(match, patch);
        }
      }
    }

    toInsert = fresh;
  }
  let inserted = 0;
  let topicLinksCreated = 0;
  const unmatchedTopicValues: string[] = [];
  if (toInsert.length > 0) {
    const payload = toInsert.map((r) => {
      const { __topic_raw: _omit, ...rest } = r as Record<string, unknown>;
      return rest;
    });
    const { data, error } = await supabase
      .from("opportunities")
      .insert(payload)
      .select("id, event_url");

    if (error) {
      console.error("Insert failed:", error);
      return new Response(JSON.stringify({ error: "Insert failed", details: error.message }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    inserted = data?.length ?? 0;
    skippedDuplicates += toInsert.length - inserted;

    // Structured topic links. Failures here never fail the ingest.
    try {
      const idByLink = new Map<string, string>(
        (data ?? []).map((r) => [r.event_url as string, r.id as string]),
      );
      const wanted = new Map<string, Set<string>>(); // opportunity id -> topic names
      for (const row of toInsert) {
        const rawTopic = (row as { __topic_raw?: string | null }).__topic_raw ?? null;
        const oppId = idByLink.get(row.event_url as string);
        if (!rawTopic || !oppId) continue;
        const names = matchTopicNames(rawTopic);
        if (names.length === 0) {
          unmatchedTopicValues.push(rawTopic);
          continue;
        }
        wanted.set(oppId, new Set(names));
      }

      if (wanted.size > 0) {
        const allNames = [...new Set([...wanted.values()].flatMap((s) => [...s]))];
        const { data: topicRows, error: topicErr } = await supabase
          .from("topics")
          .select("id, name")
          .in("name", allNames);
        if (topicErr) throw topicErr;
        const idByName = new Map<string, string>(
          (topicRows ?? []).map((t) => [t.name as string, t.id as string]),
        );

        const links: { opportunity_id: string; topic_id: string }[] = [];
        for (const [oppId, names] of wanted) {
          for (const name of names) {
            const topicId = idByName.get(name);
            if (topicId) links.push({ opportunity_id: oppId, topic_id: topicId });
          }
        }

        if (links.length > 0) {
          const { error: linkErr } = await supabase
            .from("opportunity_topics")
            .upsert(links, { onConflict: "opportunity_id,topic_id", ignoreDuplicates: true });
          if (linkErr) throw linkErr;
          topicLinksCreated = links.length;
        }
      }
    } catch (e) {
      console.error("Topic linking failed (opportunities still inserted):", e);
    }
  }

  const insertedRows = toInsert;
  const mappedVertical = insertedRows.filter((r) => r.vertical_slug !== null).length;
  const unmappedVertical = insertedRows.length - mappedVertical;
  const unmappedValues = [...new Set(unmappedVerticals)];
  const unrecognizedIsOpenValues = [...new Set(unrecognizedIsOpen)];

  console.log(
    `ingest-leads: received=${received} inserted=${inserted} duplicates=${skippedDuplicates} invalid=${skippedInvalid} matched_by_event_url=${matchedByUrl} matched_by_canonical_url=${matchedByCanonicalUrl} matched_by_fingerprint=${matchedByFingerprint} enriched_rows=${enrichedRows} enriched_fields=${enrichedFields} mapped_vertical=${mappedVertical} unmapped_vertical=${unmappedVertical} unmapped_values=${JSON.stringify(unmappedValues)} unrecognized_is_open=${JSON.stringify(unrecognizedIsOpenValues)}`,
  );

  return new Response(
    JSON.stringify({
      received,
      inserted,
      skipped_duplicates: skippedDuplicates,
      skipped_invalid: skippedInvalid,
      matched_by_event_url: matchedByUrl,
      matched_by_canonical_url: matchedByCanonicalUrl,
      matched_by_fingerprint: matchedByFingerprint,
      enriched_rows: enrichedRows,
      enriched_fields: enrichedFields,
      fuzzy_matches: fuzzyMatchLog,
      mapped_vertical: mappedVertical,
      unmapped_vertical: unmappedVertical,
      unmapped_vertical_values: unmappedValues,
      topic_links_created: topicLinksCreated,
      unmatched_topic_values: [...new Set(unmatchedTopicValues)],
      unrecognized_is_open_values: unrecognizedIsOpenValues,
    }),
    { status: 200, headers: jsonHeaders },
  );
});
