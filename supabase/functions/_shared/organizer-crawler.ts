// Organizer contact discovery crawler — multi-path.
// Captures email, named staff, contact form, LinkedIn, phone, socials, address.
// Pure fetch logic so it can be unit-run outside Deno.

export const BLOCKED_HOST_PATTERNS = [
  "sessionize.com",
  "callingallpapers.com",
  "eventbrite.",
  "papercall.io",
  "meetup.com",
  "cvent.com",
  "formstack.com",
  "forms.office.com",
  "forms.cloud.microsoft",
  "office.com",
  "forms.gle",
  "docs.google.com",
  "pheedloop.com",
  "abstractscorecard.com",
  "hsforms.com",
  "typeform.com",
  "linktr.ee",
];

export const PROBE_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/team",
  "/staff",
  "/leadership",
  "/board",
  "/organizers",
  "/speakers",
  "/call-for-speakers",
  "/speak",
];

// Pages we allow named-staff extraction from (team/staff/board/leadership only).
const STAFF_PAGE_RE = /(team|staff|board|leadership|our-people|who-we-are|directors|executive)/i;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const JUNK_EMAIL_RE =
  /(sentry|wixpress|example\.|example@|mysite\.com|domain\.com|yourdomain|email\.com|@2x|\.png|\.jpe?g|\.gif|\.webp|\.svg|godaddy|squarespace|wordpress\.com|sentry\.io|core\.js|@sentry)/i;

const ROLE_PREFIXES = [
  "info", "hello", "contact", "admin", "office", "events", "event", "support",
  "speakers", "speaking", "cfp", "conference", "conferences", "team", "media",
  "press", "sales", "marketing", "registration", "help", "inquiries", "enquiries",
  "membership", "programs", "education", "sponsorship", "sponsors", "no-reply",
  "noreply", "mail", "general", "communications", "webmaster", "service",
  "customerservice", "membership",
];

const STAFF_TITLE_RE =
  /\b(event|events|conference|program|programme|programs|speaker|speakers|education|meetings?|content|marketing|communications|membership|executive director|president|chief|director|manager|coordinator|chair)\b/i;

const FORM_NOISE_RE = /(newsletter|subscribe|signup|sign-up|search|login|log-in|donate|cart|password)/i;

export type Strategy =
  | "event_url"
  | "probe_path"
  | "contact_link_hop"
  | "embedded_json"
  | "parent_domain"
  | "retry_403"
  | "browser_render";

export type ConfidenceTier = "verified" | "role_inbox" | "form" | "social" | "unreachable";

export interface ContactHit {
  email: string;
  contact_type: "individual" | "role";
  source_page: string;
  strategy: Strategy;
}

export interface NamedStaff {
  name: string | null;
  title: string | null;
  email: string | null;
  source_page: string;
}

export interface ContactForm {
  url: string;
  fields: string[];
  platform: string | null;
}

export interface CrawlResult {
  domain: string;
  start_url: string;
  hits: ContactHit[];
  best: ContactHit | null;
  named_staff: NamedStaff[];
  form: ContactForm | null;
  linkedin_url: string | null;
  phone: string | null;
  socials: Record<string, string>;
  physical_address: string | null;
  paths_found: string[];
  confidence_tier: ConfidenceTier;
  status: string;
  strategies_tried: string[];
  render_used: boolean;
  pages_fetched: number;
  crawl_ms: number;
  error: string | null;
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isBlockedHost(host: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((p) => host.includes(p));
}

export function parentDomain(host: string): string | null {
  const parts = host.split(".");
  if (parts.length <= 2) return null;
  const twoLetterTld = parts[parts.length - 1].length === 2 &&
    parts[parts.length - 2].length <= 3;
  const keep = twoLetterTld ? 3 : 2;
  if (parts.length <= keep) return null;
  return parts.slice(-keep).join(".");
}

export function classify(email: string): "individual" | "role" {
  const local = email.split("@")[0].toLowerCase();
  // Any role keyword anywhere in the local part means a shared/role inbox
  // (e.g. researchprograms@, libraryrequests@, infodisrupthratx@).
  if (ROLE_PREFIXES.some((p) => local.includes(p))) return "role";
  if (/(request|inquir|enquir|update|news|board|chapter|group|assoc|committee|club|society|desk)/.test(local)) {
    return "role";
  }
  // Individual only when the local part looks like a person's name.
  if (/^[a-z]{1,2}[._-]?[a-z]{2,}$/.test(local) && /[._-]/.test(local)) return "individual";
  if (/^[a-z]+[._-][a-z]+$/.test(local)) return "individual";
  if (/^[a-z][a-z]{2,11}$/.test(local)) return "individual"; // short single token, e.g. jsmith
  return "role";
}


function scoreHit(h: ContactHit): number {
  let s = h.contact_type === "individual" ? 100 : 50;
  const local = h.email.split("@")[0].toLowerCase();
  if (local.includes("speak") || local.includes("cfp") || local.includes("program")) s += 20;
  if (local.startsWith("noreply") || local.startsWith("no-reply")) s -= 60;
  return s;
}

export function pickBest(hits: ContactHit[]): ContactHit | null {
  if (!hits.length) return null;
  return [...hits].sort((a, b) => scoreHit(b) - scoreHit(a))[0];
}

function extractEmails(text: string, domain: string): string[] {
  const out = new Set<string>();
  const decoded = text
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s*\[at\]\s*|\s*\(at\)\s*/gi, "@")
    .replace(/\s*\[dot\]\s*|\s*\(dot\)\s*/gi, ".");
  for (const m of decoded.matchAll(EMAIL_RE)) {
    let e = m[0].toLowerCase().replace(/[.,;]+$/, "");
    // strip URL-encoding / stray leading punctuation picked up from mailto hrefs
    e = e.replace(/^(?:%[0-9a-f]{2}|[^a-z0-9])+/i, "");
    if (!/^[a-z0-9._%+-]+@/.test(e)) continue;
    if (JUNK_EMAIL_RE.test(e)) continue;
    if (e.length > 80) continue;
    out.add(e);
  }

  const arr = [...out];
  arr.sort((a, b) => (a.endsWith(domain) ? 0 : 1) - (b.endsWith(domain) ? 0 : 1));
  return arr;
}

function embeddedJsonBlobs(html: string): string[] {
  const blobs: string[] = [];
  for (
    const m of html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    )
  ) blobs.push(m[1]);
  for (
    const m of html.matchAll(
      /<script[^>]*id=["'](?:__NEXT_DATA__|__NUXT_DATA__)["'][^>]*>([\s\S]*?)<\/script>/gi,
    )
  ) blobs.push(m[1]);
  return blobs;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

interface FetchOut {
  html: string;
  status: number;
  url: string;
  retried403: boolean;
  rendered?: boolean;
}

/** Hard ceiling on bytes we keep per page. Large pages are TRUNCATED, never abandoned. */
export const MAX_PAGE_BYTES = 4_000_000;

/** Read a response body up to `cap` bytes, then stop. Prevents worker OOM on huge pages. */
async function readCapped(res: Response, cap: number): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < cap) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } catch { /* partial content is still usable */ } finally {
    try { await reader.cancel(); } catch { /* ignore */ }
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export async function fetchPage(url: string, timeoutMs = 25000): Promise<FetchOut | null> {
  const attempt = async (extra: Record<string, string>) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          ...extra,
        },
      });
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      if (ct && !/text\/|html|json|xml|javascript/.test(ct)) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        return { html: "", status: res.status, url: res.url, retried403: false };
      }
      const html = await readCapped(res, MAX_PAGE_BYTES);
      return { html, status: res.status, url: res.url, retried403: false };
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };

  const out = await attempt({});
  if (out && out.status === 403) {
    const retry = await attempt({
      "Referer": "https://www.google.com/",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Upgrade-Insecure-Requests": "1",
    });
    if (retry && retry.status < 400) return { ...retry, retried403: true };
  }
  if (!out || out.status >= 400) return out && out.html ? out : null;
  return out;
}

/** Browser-render fallback via Firecrawl (expensive — only used when static fetch yields nothing). */
export async function renderPage(
  url: string,
  apiKey: string | undefined,
): Promise<FetchOut | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
        waitFor: 3000,
        timeout: 30000,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const html: string | undefined = json?.data?.html ?? json?.data?.rawHtml;
    if (!html) return null;
    return { html, status: 200, url, retried403: false, rendered: true };
  } catch {
    return null;
  }
}

/**
 * A client-rendered shell: almost no server-side text relative to markup size,
 * or an empty SPA mount point. These pages look "non-empty" (nav/footer
 * boilerplate) but carry zero contact data until JS runs.
 */
export function isJsShell(html: string): boolean {
  const text = stripTags(html).replace(/\s+/g, " ").trim();
  const hasMount = /<div[^>]+id=["'](root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i.test(html);
  if (hasMount && text.length < 2000) return true;
  if (text.length < 400) return true;
  // Heavy markup, tiny prose, no mailto/tel anywhere => almost certainly rendered client-side.
  return html.length > 20000 && text.length / html.length < 0.02 &&
    !/mailto:|href=["']tel:/i.test(html);
}

/** Same-origin JS bundles referenced by a shell page (SPA contact data often lives here). */
export function bundleUrls(html: string, base: string, max = 3): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.origin !== new URL(base).origin) continue;
      if (/analytics|gtag|gtm|polyfill|jquery|hotjar|pixel|tccl|traffic-assets/i.test(u.pathname)) {
        continue;
      }
      out.push(u.toString());
    } catch { /* ignore */ }
  }
  return [...new Set(out)].slice(0, max);
}

function contactLinks(html: string, base: string): string[] {
  const urls: string[] = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const href = m[1];
    const label = stripTags(m[2]).toLowerCase();
    const hay = (href + " " + label).toLowerCase();
    if (!/contact|about|organiz|team|staff|board|leadership|speaker|cfp|call.for/.test(hay)) continue;
    try {
      const u = new URL(href, base);
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = "";
      urls.push(u.toString());
    } catch { /* ignore */ }
  }
  return [...new Set(urls)].slice(0, 8);
}

function decodeCfEmails(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) {
    const hex = m[1];
    const key = parseInt(hex.slice(0, 2), 16);
    let email = "";
    for (let i = 2; i < hex.length; i += 2) {
      email += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    }
    if (email.includes("@")) out.push(email.toLowerCase());
  }
  return out;
}

function isNotFoundPage(page: FetchOut): boolean {
  if (page.status >= 400) return true;
  const head = page.html.slice(0, 4000).toLowerCase();
  return /(<title>[^<]*(404|page not found|not found)[^<]*<\/title>)/.test(head) ||
    /class=["'][^"']*error404/.test(head);
}

/** Detect a genuine contact form (not newsletter / search) and list its required-ish fields. */
export function detectForm(page: FetchOut): ContactForm | null {
  if (isNotFoundPage(page)) return null;
  const html = page.html;

  // Embedded form platforms render client-side; treat presence as a form.
  const platforms: [RegExp, string][] = [
    [/gravity_form|gform_wrapper|gf_browser/i, "gravity_forms"],
    [/js\.hsforms\.net|hbspt\.forms/i, "hubspot"],
    [/jotform\.com\/(form|jsform)/i, "jotform"],
    [/wufoo\.com\/(forms|embed)/i, "wufoo"],
    [/formstack\.com\/forms/i, "formstack"],
    [/wpcf7|contact-form-7/i, "contact_form_7"],
    [/ninja-forms|nf-form/i, "ninja_forms"],
    [/formidable|frm_forms/i, "formidable"],
  ];

  for (const m of html.matchAll(/<form[\s\S]{0,8000}?<\/form>/gi)) {
    const block = m[0];
    const attrs = (block.match(/<form[^>]*>/i) ?? [""])[0];
    if (FORM_NOISE_RE.test(attrs)) continue;
    const fields: string[] = [];
    for (const f of block.matchAll(/<(input|textarea|select)[^>]*>/gi)) {
      const tag = f[0];
      const type = (tag.match(/type=["']([^"']+)["']/i)?.[1] ?? "text").toLowerCase();
      if (["hidden", "submit", "button", "image", "search"].includes(type)) continue;
      const name = tag.match(/name=["']([^"']+)["']/i)?.[1] ??
        tag.match(/id=["']([^"']+)["']/i)?.[1] ??
        tag.match(/placeholder=["']([^"']+)["']/i)?.[1] ?? type;
      if (FORM_NOISE_RE.test(name)) continue;
      fields.push(name.toLowerCase().slice(0, 60));
    }
    const hasTextarea = /<textarea/i.test(block);
    const hasEmail = fields.some((f) => /e?-?mail/i.test(f)) || /type=["']email["']/i.test(block);
    // A real contact form: message body + an email/name field, or 3+ meaningful fields.
    if ((hasTextarea && (hasEmail || fields.length >= 2)) || fields.length >= 3) {
      return { url: page.url, fields: [...new Set(fields)].slice(0, 20), platform: null };
    }
  }

  for (const [re, name] of platforms) {
    if (re.test(html)) return { url: page.url, fields: [], platform: name };
  }
  return null;
}

const PLACEHOLDER_PHONE_RE = /^\+?1?-?\(?555\)?[-. ]?\d{3}[-. ]?\d{4}$|5551234567/;

export function detectPhone(page: FetchOut): string | null {
  const tel = page.html.match(/href=["']tel:([^"']+)["']/i)?.[1];
  if (tel) {
    const digits = tel.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length >= 7 && !PLACEHOLDER_PHONE_RE.test(digits)) return digits;
  }
  const text = stripTags(page.html);
  const m = text.match(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/);
  if (!m) return null;
  return PLACEHOLDER_PHONE_RE.test(m[0].replace(/[^\d+]/g, "")) ? null : m[0].trim();
}

export function detectSocials(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const map: [RegExp, string][] = [
    [/https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(company|in|school)\/[^"'\s<>]+/i, "linkedin"],
    [/https?:\/\/(?:www\.)?facebook\.com\/[^"'\s<>]+/i, "facebook"],
    [/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"'\s<>]+/i, "twitter"],
    [/https?:\/\/(?:www\.)?instagram\.com\/[^"'\s<>]+/i, "instagram"],
    [/https?:\/\/(?:www\.)?youtube\.com\/(channel|c|@)[^"'\s<>]+/i, "youtube"],
  ];
  for (const [re, key] of map) {
    const m = html.match(re);
    if (!m) continue;
    const url = m[0].replace(/["'\\)]+$/, "");
    if (/sharer|share\?|intent\/tweet|\/share/i.test(url)) continue;
    out[key] = url;
  }
  return out;
}

export function detectAddress(page: FetchOut): string | null {
  for (const blob of embeddedJsonBlobs(page.html)) {
    try {
      const j = JSON.parse(blob);
      const stack = [j];
      while (stack.length) {
        const n = stack.pop();
        if (!n || typeof n !== "object") continue;
        const node = n as Record<string, unknown>;
        if (node["@type"] === "PostalAddress" || node.streetAddress) {
          const parts = [
            node.streetAddress,
            node.addressLocality,
            node.addressRegion,
            node.postalCode,
          ].filter(Boolean);
          if (parts.length >= 2) return parts.join(", ").slice(0, 200);
        }
        for (const v of Object.values(node)) if (v && typeof v === "object") stack.push(v);
      }
    } catch { /* ignore */ }
  }
  const text = stripTags(page.html).replace(/\s+/g, " ");
  const m = text.match(
    /\d{2,6}\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Suite|Ste\.?|Lane|Ln\.?|Way|Parkway|Pkwy\.?)[,\s][^,]{0,40},?\s*[A-Z]{2}\s+\d{5}/,
  );
  return m ? m[0].trim().slice(0, 200) : null;
}

/** Named staff extraction, restricted to team/staff/board/leadership pages. */
export function detectNamedStaff(page: FetchOut, domain: string): NamedStaff[] {
  if (!STAFF_PAGE_RE.test(page.url)) return [];
  const out: NamedStaff[] = [];
  const text = stripTags(page.html).replace(/[ \t]+/g, " ");
  const lines = text.split(/\n|(?=[A-Z][a-z]+ [A-Z])/).map((l) => l.trim()).filter(Boolean);
  const emails = new Set([
    ...decodeCfEmails(page.html),
    ...extractEmails(page.html, domain),
  ].filter((e) => !JUNK_EMAIL_RE.test(e)));

  for (let i = 0; i < lines.length && out.length < 12; i++) {
    const nameMatch = lines[i].match(/^([A-Z][a-z'’-]+(?:\s+[A-Z]\.)?\s+[A-Z][a-zA-Z'’-]+)\b/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const window = [lines[i], lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" ").slice(0, 240);
    if (!STAFF_TITLE_RE.test(window)) continue;
    const title = (window.match(
      /\b((?:Senior |Sr\.? |Deputy |Vice |Executive |Associate |Assistant )?(?:Director|Manager|Coordinator|President|Chair|Chief[^,.;]{0,30}|Officer|Lead|Head)[^,.;|]{0,50})/i,
    )?.[1] ?? null)?.trim() ?? null;
    const parts = name.toLowerCase().split(/\s+/);
    const email = [...emails].find((e) => {
      const local = e.split("@")[0];
      return parts.some((p) => p.length > 3 && local.includes(p));
    }) ?? null;
    if (out.some((s) => s.name === name)) continue;
    out.push({ name, title, email, source_page: page.url });
  }
  return out;
}

function harvestEmails(
  page: FetchOut,
  domain: string,
  strategy: Strategy,
): { hits: ContactHit[]; jsonHits: ContactHit[]; text: string } {
  const hits: ContactHit[] = [];
  const jsonHits: ContactHit[] = [];
  const mailtos = [...page.html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => m[1]);
  const text = stripTags(page.html);
  const emails = new Set<string>([
    ...decodeCfEmails(page.html).filter((e) => !JUNK_EMAIL_RE.test(e)),
    ...extractEmails(mailtos.join(" "), domain),
    ...extractEmails(text, domain),
  ]);
  for (const e of emails) {
    hits.push({ email: e, contact_type: classify(e), source_page: page.url, strategy });
  }
  if (!hits.length) {
    for (const blob of embeddedJsonBlobs(page.html)) {
      for (const e of extractEmails(blob, domain)) {
        jsonHits.push({
          email: e,
          contact_type: classify(e),
          source_page: page.url,
          strategy: "embedded_json",
        });
      }
    }
  }
  return { hits, jsonHits, text };
}

export function tierFor(r: {
  best: ContactHit | null;
  form: ContactForm | null;
  linkedin_url: string | null;
  phone: string | null;
  socials: Record<string, string>;
  named_staff?: NamedStaff[];
}): ConfidenceTier {
  if (r.best?.contact_type === "individual") return "verified";
  if (r.best) return "role_inbox";
  if (r.form) return "form";
  if (
    r.linkedin_url || r.phone || Object.keys(r.socials).length ||
    (r.named_staff?.length ?? 0) > 0
  ) return "social";
  return "unreachable";
}


export async function crawlDomain(
  startUrl: string,
  opts: { maxPages?: number; firecrawlKey?: string } = {},
): Promise<CrawlResult> {
  const started = Date.now();
  const maxPages = opts.maxPages ?? 12;
  const host = hostOf(startUrl);
  const result: CrawlResult = {
    domain: host ?? "",
    start_url: startUrl,
    hits: [],
    best: null,
    named_staff: [],
    form: null,
    linkedin_url: null,
    phone: null,
    socials: {},
    physical_address: null,
    paths_found: [],
    confidence_tier: "unreachable",
    status: "not_found",
    strategies_tried: [],
    render_used: false,
    pages_fetched: 0,
    crawl_ms: 0,
    error: null,
  };
  if (!host) {
    result.error = "invalid_url";
    result.status = "invalid_url";
    return result;
  }
  if (isBlockedHost(host)) {
    result.error = "blocked_aggregator";
    result.status = "blocked_aggregator";
    return result;
  }

  const seen = new Set<string>();
  const fetchedPages: { html: string; url: string }[] = [];
  const maxRenders = 2;
  let renders = 0;
  let sawBlock = false;
  let sawAnyPage = false;

  const push = (s: string) => {
    if (!result.strategies_tried.includes(s)) result.strategies_tried.push(s);
  };

  const absorb = (page: FetchOut, domain: string, strategy: Strategy) => {
    if (isNotFoundPage(page)) return { gotEmail: false };
    // Keep only a bounded slice for later link extraction — full HTML of a
    // multi-MB page held across 6 pages is what tripped the worker memory cap.
    if (fetchedPages.length < 6) {
      fetchedPages.push({ html: page.html.slice(0, 300_000), url: page.url });
    }
    const { hits, jsonHits, text } = harvestEmails(page, domain, strategy);
    if (hits.length) result.hits.push(...hits);
    if (jsonHits.length) {
      push("embedded_json");
      result.hits.push(...jsonHits);
    }
    if (!result.form) {
      const f = detectForm(page);
      if (f) result.form = f;
    }
    const socials = detectSocials(page.html);
    for (const [k, v] of Object.entries(socials)) if (!result.socials[k]) result.socials[k] = v;
    if (!result.linkedin_url && socials.linkedin) result.linkedin_url = socials.linkedin;
    if (!result.phone) result.phone = detectPhone(page);
    if (!result.physical_address) result.physical_address = detectAddress(page);
    const staff = detectNamedStaff(page, domain);
    for (const s of staff) if (!result.named_staff.some((x) => x.name === s.name)) result.named_staff.push(s);
    for (const s of staff) {
      if (s.email && !result.hits.some((h) => h.email === s.email)) {
        result.hits.push({
          email: s.email,
          contact_type: "individual",
          source_page: s.source_page,
          strategy,
        });
      }
    }
    const empty = text.replace(/\s+/g, "").length < 200;
    return { gotEmail: hits.length > 0 || jsonHits.length > 0, empty };
  };

  const visit = async (url: string, strategy: Strategy, domain: string, isEntry = false) => {
    if (result.pages_fetched >= maxPages) return null;
    const key = url.replace(/\/$/, "");
    if (seen.has(key)) return null;
    seen.add(key);
    let page = await fetchPage(url);
    result.pages_fetched++;
    push(strategy);
    if (page?.retried403) push("retry_403");
    let needRender = false;
    if (!page) {
      // total fetch failure — worth rendering only for the entry page
      needRender = isEntry;
    } else {
      if (page.status === 403) sawBlock = true;
      const notFound = isNotFoundPage(page);
      const r = absorb(page, domain, strategy);
      if (!notFound) sawAnyPage = true;
      // Render only when the page is bot-blocked, or when an entry page came
      // back effectively empty (JS-rendered). Never for 404s or probe misses.
      needRender = !r.gotEmail &&
        ((page.status === 403 && !r.gotEmail) || (isEntry && !notFound && r.empty === true));
    }
    // Browser render fallback (expensive): capped per domain.
    if (needRender && opts.firecrawlKey && renders < maxRenders) {
      renders++;
      const rendered = await renderPage(url, opts.firecrawlKey);
      push("browser_render");
      result.render_used = true;
      if (rendered) {
        page = rendered;
        sawAnyPage = true;
        absorb(rendered, domain, strategy);
      }
    }
    return page;
  };

  const hasIndividual = () => result.hits.some((h) => h.contact_type === "individual");

  const runHost = async (h: string, entry: string, entryStrategy: Strategy) => {
    const origin = `https://${h}`;
    await visit(entry, entryStrategy, h, true);

    for (const p of PROBE_PATHS) {
      if (hasIndividual() && result.form) break;
      if (result.pages_fetched >= maxPages) break;
      await visit(origin + p, "probe_path", h);
    }
    if (result.hits.length) return;
    const links = [...new Set(fetchedPages.flatMap((p) => contactLinks(p.html, p.url)))]
      .filter((l) => hostOf(l) === h);
    for (const l of links) {
      if (result.hits.length) break;
      await visit(l, "contact_link_hop", h);
    }
  };

  await runHost(host, startUrl, "event_url");

  if (!result.hits.length) {
    const parent = parentDomain(host);
    if (parent && !isBlockedHost(parent)) {
      const before = result.hits.length;
      await runHost(parent, `https://${parent}/`, "parent_domain");
      if (result.hits.length > before) {
        result.hits = result.hits.map((h) => ({ ...h, strategy: "parent_domain" as Strategy }));
      }
    }
  }

  const byEmail = new Map<string, ContactHit>();
  for (const h of result.hits) if (!byEmail.has(h.email)) byEmail.set(h.email, h);
  result.hits = [...byEmail.values()];
  result.best = pickBest(result.hits);

  const paths: string[] = [];
  if (result.best) paths.push(result.best.contact_type === "individual" ? "email_individual" : "email_role");
  if (result.named_staff.length) paths.push("named_staff");
  if (result.form) paths.push("contact_form");
  if (result.linkedin_url) paths.push("linkedin");
  if (result.phone) paths.push("phone");
  if (Object.keys(result.socials).some((k) => k !== "linkedin")) paths.push("social_dm");
  if (result.physical_address) paths.push("physical_address");
  result.paths_found = paths;
  result.confidence_tier = tierFor(result);

  if (result.best) result.status = "found_email";
  else if (paths.length) result.status = "found_alt_path";
  else if (!sawAnyPage) result.status = "fetch_failed";
  else if (sawBlock) result.status = "bot_blocked";
  else result.status = "not_found";

  result.crawl_ms = Date.now() - started;
  return result;
}
