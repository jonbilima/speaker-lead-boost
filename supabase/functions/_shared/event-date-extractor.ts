// Extracts *published* future event dates and call-for-speakers status from an
// organizer's own website. Pure fetch + parse — no AI, no gateway credits.

export interface EventSignal {
  event_name: string | null;
  event_slug: string;
  next_event_date: string | null; // YYYY-MM-DD
  next_event_date_end: string | null;
  next_event_date_text: string | null;
  date_confidence: "explicit_date" | "month_year" | "year_only" | null;
  date_source_url: string | null;
  cfp_status: "open" | "announced_not_open" | "closed" | "unknown";
  cfp_url: string | null;
  cfp_deadline: string | null;
  cfp_source_url: string | null;
  site_shape: "standing_cfp_url" | "homepage_next_date" | "multi_event_calendar" | null;
  render_used: boolean;
  evidence: string[];
}

export const CYCLE_PROBE_PATHS = [
  "/",
  "/cfp",
  "/call-for-speakers",
  "/call-for-papers",
  "/call-for-proposals",
  "/speak",
  "/speakers",
  "/events",
  "/schedule",
  "/conference",
  "/about",
];

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const MONTH_RE =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const CFP_KEYWORDS =
  /(call for (speakers?|papers?|proposals?|presentations?|talks?|sessions?)|cfp|speaker application|submit (a )?(talk|session|proposal|paper)|become a speaker)/i;

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A published *next cycle* date. Page timestamps, "last updated", copyright
 * lines and blog datelines all render as today-ish dates, so a bare text date
 * must sit at least MIN_LEAD_DAYS out before we treat it as an event date.
 */
const MIN_LEAD_DAYS = 21;

function isFuture(dateStr: string, minLeadDays = MIN_LEAD_DAYS): boolean {
  const t = Date.parse(dateStr + "T00:00:00Z");
  return Number.isFinite(t) && t > Date.now() + minLeadDays * 86400000;
}

interface DateHit {
  start: string;
  end: string | null;
  text: string;
  confidence: "explicit_date" | "month_year" | "year_only";
}

/** Parse published date expressions out of plain text, keeping only future ones. */
export function extractDates(text: string): DateHit[] {
  const out: DateHit[] = [];
  const seen = new Set<string>();
  const add = (h: DateHit) => {
    const k = h.start + "|" + (h.end ?? "");
    if (!seen.has(k) && isFuture(h.start)) {
      seen.add(k);
      out.push(h);
    }
  };

  // "March 3-5, 2027" / "March 3 – 5 2027"
  const range = new RegExp(`${MONTH_RE}\\s+(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})[,\\s]+(20\\d{2})`, "gi");
  for (const m of text.matchAll(range)) {
    const mo = MONTHS[m[1].toLowerCase()];
    const s = iso(+m[4], mo, +m[2]);
    const e = iso(+m[4], mo, +m[3]);
    if (s) add({ start: s, end: e, text: m[0], confidence: "explicit_date" });
  }

  // "March 3 - April 2, 2027"
  const crossRange = new RegExp(
    `${MONTH_RE}\\s+(\\d{1,2})\\s*[-–—]\\s*${MONTH_RE}\\s+(\\d{1,2})[,\\s]+(20\\d{2})`,
    "gi",
  );
  for (const m of text.matchAll(crossRange)) {
    const s = iso(+m[5], MONTHS[m[1].toLowerCase()], +m[2]);
    const e = iso(+m[5], MONTHS[m[3].toLowerCase()], +m[4]);
    if (s) add({ start: s, end: e, text: m[0], confidence: "explicit_date" });
  }

  // "March 3, 2027" / "3 March 2027"
  const single = new RegExp(`${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?[,\\s]+(20\\d{2})`, "gi");
  for (const m of text.matchAll(single)) {
    const s = iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    if (s) add({ start: s, end: null, text: m[0], confidence: "explicit_date" });
  }
  const dmy = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\s+(20\\d{2})`, "gi");
  for (const m of text.matchAll(dmy)) {
    const s = iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    if (s) add({ start: s, end: null, text: m[0], confidence: "explicit_date" });
  }

  // ISO "2027-03-05"
  for (const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    const s = iso(+m[1], +m[2], +m[3]);
    if (s) add({ start: s, end: null, text: m[0], confidence: "explicit_date" });
  }

  if (out.length) return out.sort((a, b) => a.start.localeCompare(b.start));

  // Weaker: "March 2027", "See you in Spring 2027"
  const monthYear = new RegExp(`${MONTH_RE}\\s+(20\\d{2})`, "gi");
  for (const m of text.matchAll(monthYear)) {
    const s = iso(+m[2], MONTHS[m[1].toLowerCase()], 1);
    if (s) add({ start: s, end: null, text: m[0], confidence: "month_year" });
  }
  const seasons: Record<string, number> = { spring: 4, summer: 7, fall: 10, autumn: 10, winter: 1 };
  for (const m of text.matchAll(/\b(spring|summer|fall|autumn|winter)\s+(20\d{2})\b/gi)) {
    const s = iso(+m[2], seasons[m[1].toLowerCase()], 1);
    if (s) add({ start: s, end: null, text: m[0], confidence: "month_year" });
  }

  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Structured events published as schema.org JSON-LD — the most reliable source. */
export function extractJsonLdEvents(html: string): { name: string | null; hit: DateHit }[] {
  const out: { name: string | null; hit: DateHit }[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const stack: unknown[] = [parsed];
    while (stack.length) {
      const node = stack.pop();
      if (Array.isArray(node)) {
        stack.push(...node);
        continue;
      }
      if (!node || typeof node !== "object") continue;
      const o = node as Record<string, unknown>;
      for (const v of Object.values(o)) {
        if (v && typeof v === "object") stack.push(v);
      }
      const type = String(o["@type"] ?? "");
      if (!/event/i.test(type)) continue;
      const start = String(o.startDate ?? "").slice(0, 10);
      if (!/^20\d{2}-\d{2}-\d{2}$/.test(start) || !isFuture(start, 2)) continue;
      const endRaw = String(o.endDate ?? "").slice(0, 10);
      out.push({
        name: typeof o.name === "string" ? o.name.slice(0, 200) : null,
        hit: {
          start,
          end: /^20\d{2}-\d{2}-\d{2}$/.test(endRaw) ? endRaw : null,
          text: String(o.startDate ?? ""),
          confidence: "explicit_date",
        },
      });
    }
  }
  return out;
}

/** <time datetime="2027-03-05"> markup. */
export function extractTimeTags(html: string): DateHit[] {
  const out: DateHit[] = [];
  for (const m of html.matchAll(/<time[^>]+datetime=["'](20\d{2}-\d{2}-\d{2})/gi)) {
    if (isFuture(m[1], 2)) {
      out.push({ start: m[1], end: null, text: m[1], confidence: "explicit_date" });
    }
  }
  return out;
}

export interface CfpRead {
  status: EventSignal["cfp_status"];
  url: string | null;
  deadline: string | null;
  evidence: string[];
}

/** Read call-for-speakers state from a page's text and links. */
export function extractCfp(html: string, pageUrl: string): CfpRead {
  const text = stripHtml(html);
  const evidence: string[] = [];
  let url: string | null = null;

  // A link that points at a standing CFP page.
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    const href = m[1];
    const label = stripHtml(m[2]);
    if (CFP_KEYWORDS.test(label) || /(call-for-(speakers?|papers?|proposals?)|\/cfp\b|\/speak\b|sessionize\.com|papercall\.io)/i.test(href)) {
      try {
        url = new URL(href, pageUrl).toString();
      } catch { /* ignore */ }
      if (url) break;
    }
  }

  let status: EventSignal["cfp_status"] = "unknown";
  const near = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[0].slice(0, 200) : null;
  };

  const openHit = near(
    /(call for (speakers?|papers?|proposals?|presentations?|talks?|sessions?)[^.]{0,80}?(is )?(now )?open|submissions? (are )?(now )?open|apply to speak|submit your (talk|session|proposal))/i,
  );
  const closedHit = near(
    /(call for (speakers?|papers?|proposals?)[^.]{0,60}?(is )?(now )?closed|submissions? (are )?closed|cfp closed)/i,
  );
  const soonHit = near(
    /(call for (speakers?|papers?|proposals?)[^.]{0,80}?(opens?|coming soon|will open|opening)|cfp (opens?|coming soon))/i,
  );

  if (closedHit) {
    status = "closed";
    evidence.push(closedHit);
  }
  if (soonHit && status === "unknown") {
    status = "announced_not_open";
    evidence.push(soonHit);
  }
  if (openHit) {
    status = "open";
    evidence.push(openHit);
  }
  if (status === "unknown" && url) {
    status = "announced_not_open";
    evidence.push(`cfp link: ${url}`);
  }

  // Deadline, e.g. "submissions close March 3, 2027"
  let deadline: string | null = null;
  const dlm = text.match(
    new RegExp(
      `(closes?|closing|deadline|due|ends?)[^.]{0,40}?(${MONTH_RE}\\s+\\d{1,2}(?:st|nd|rd|th)?[,\\s]+20\\d{2}|20\\d{2}-\\d{2}-\\d{2})`,
      "i",
    ),
  );
  if (dlm) {
    const d = extractDates(dlm[2]);
    if (d.length) {
      deadline = d[0].start;
      evidence.push(dlm[0].slice(0, 200));
    }
  }

  return { status, url, deadline, evidence };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export interface PageInput {
  url: string;
  html: string;
  isHomepage: boolean;
  rendered: boolean;
}

/**
 * Fold every crawled page of one organizer domain into event signals.
 * Handles the three observed site shapes:
 *  - a dedicated standing CFP URL
 *  - a homepage that simply states the next date
 *  - a multi-event calendar where one crawl yields many events
 */
export function buildSignals(domain: string, pages: PageInput[]): EventSignal[] {
  const cfpByPage: { page: PageInput; read: CfpRead }[] = [];
  const namedEvents = new Map<string, { name: string; hit: DateHit; url: string; rendered: boolean }>();
  let bestBare: { hit: DateHit; page: PageInput } | null = null;

  for (const p of pages) {
    const text = stripHtml(p.html).slice(0, 200_000);

    for (const e of extractJsonLdEvents(p.html)) {
      const name = e.name ?? "";
      const key = slugify((name || "event") + "-" + e.hit.start);
      if (!namedEvents.has(key)) {
        namedEvents.set(key, { name: name || "Untitled event", hit: e.hit, url: p.url, rendered: p.rendered });
      }
    }

    const hits = [...extractTimeTags(p.html), ...extractDates(text)]
      .sort((a, b) => a.start.localeCompare(b.start));
    if (hits.length && (!bestBare || hits[0].start < bestBare.hit.start)) {
      bestBare = { hit: hits[0], page: p };
    }

    const read = extractCfp(p.html, p.url);
    if (read.status !== "unknown" || read.url) cfpByPage.push({ page: p, read });
  }

  // Strongest CFP read wins: open > closed > announced.
  const rank = { open: 3, closed: 2, announced_not_open: 1, unknown: 0 } as const;
  const cfp = cfpByPage.sort((a, b) => rank[b.read.status] - rank[a.read.status])[0];
  const cfpRead: CfpRead = cfp?.read ?? { status: "unknown", url: null, deadline: null, evidence: [] };
  const cfpSource = cfp?.page.url ?? null;
  const standingCfpPage = pages.find((p) =>
    /(cfp|call-for-(speakers?|papers?|proposals?)|\/speak)/i.test(p.url)
  );

  const signals: EventSignal[] = [];

  if (namedEvents.size > 1) {
    // Multi-event calendar: one crawl, many leads.
    for (const [slug, e] of namedEvents) {
      signals.push({
        event_name: e.name,
        event_slug: slug,
        next_event_date: e.hit.start,
        next_event_date_end: e.hit.end,
        next_event_date_text: e.hit.text,
        date_confidence: e.hit.confidence,
        date_source_url: e.url,
        cfp_status: cfpRead.status,
        cfp_url: cfpRead.url,
        cfp_deadline: cfpRead.deadline,
        cfp_source_url: cfpSource,
        site_shape: "multi_event_calendar",
        render_used: e.rendered,
        evidence: [e.hit.text],
      });
    }
    return signals;
  }

  const only = [...namedEvents.values()][0];
  const hit = only?.hit ?? bestBare?.hit ?? null;
  const sourceUrl = only?.url ?? bestBare?.page.url ?? null;
  const rendered = only?.rendered ?? bestBare?.page.rendered ?? false;

  if (!hit && cfpRead.status === "unknown") return [];

  const shape: EventSignal["site_shape"] = standingCfpPage
    ? "standing_cfp_url"
    : hit
    ? "homepage_next_date"
    : null;

  signals.push({
    event_name: only?.name ?? null,
    event_slug: slugify((only?.name ?? "next-cycle") + "-" + (hit?.start ?? "undated")),
    next_event_date: hit?.start ?? null,
    next_event_date_end: hit?.end ?? null,
    next_event_date_text: hit?.text ?? null,
    date_confidence: hit?.confidence ?? null,
    date_source_url: hit ? sourceUrl : null,
    cfp_status: cfpRead.status,
    cfp_url: cfpRead.url ?? standingCfpPage?.url ?? null,
    cfp_deadline: cfpRead.deadline,
    cfp_source_url: cfpSource,
    site_shape: shape,
    render_used: rendered,
    evidence: [...(hit ? [hit.text] : []), ...cfpRead.evidence].slice(0, 6),
  });

  return signals;
}
