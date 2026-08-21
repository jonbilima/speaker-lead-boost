// Organizer contact discovery crawler.
// Pure logic (fetch only) so it can be unit-run outside Deno.

export const BLOCKED_HOST_PATTERNS = [
  "sessionize.com",
  "callingallpapers.com",
  "eventbrite.",
  "papercall.io",
  "meetup.com",
  "cvent.com",
  "formstack.com",
  "forms.office.com",
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
  "/speakers",
  "/organizers",
  "/team",
  "/call-for-speakers",
  "/speak",
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const JUNK_EMAIL_RE =
  /(sentry|wixpress|example\.|domain\.com|yourdomain|email\.com|@2x|\.png|\.jpe?g|\.gif|\.webp|\.svg|godaddy|squarespace|wordpress\.com|sentry\.io|core\.js|@sentry)/i;

const ROLE_PREFIXES = [
  "info", "hello", "contact", "admin", "office", "events", "event", "support",
  "speakers", "speaking", "cfp", "conference", "conferences", "team", "media",
  "press", "sales", "marketing", "registration", "help", "inquiries", "enquiries",
  "membership", "programs", "education", "sponsorship", "sponsors", "no-reply",
  "noreply", "mail", "general", "communications",
];

export type Strategy =
  | "event_url"
  | "probe_path"
  | "contact_link_hop"
  | "embedded_json"
  | "parent_domain"
  | "retry_403";

export interface ContactHit {
  email: string;
  contact_type: "individual" | "role";
  source_page: string;
  strategy: Strategy;
}

export interface CrawlResult {
  domain: string;
  start_url: string;
  hits: ContactHit[];
  best: ContactHit | null;
  strategies_tried: string[];
  pages_fetched: number;
  contact_page_only: string | null;
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
  // naive but fine for .com/.org; keeps last 2 labels (3 for co.uk style)
  const twoLetterTld = parts[parts.length - 1].length === 2 &&
    parts[parts.length - 2].length <= 3;
  const keep = twoLetterTld ? 3 : 2;
  if (parts.length <= keep) return null;
  return parts.slice(-keep).join(".");
}

export function classify(email: string): "individual" | "role" {
  const local = email.split("@")[0].toLowerCase();
  if (ROLE_PREFIXES.includes(local)) return "role";
  if (ROLE_PREFIXES.some((p) => local === p || local.startsWith(p + "-") || local.startsWith(p + "_"))) return "role";
  // firstname.lastname / flastname patterns
  if (/^[a-z]+[._-][a-z]+$/.test(local)) return "individual";
  if (/^[a-z]{4,}$/.test(local) && !ROLE_PREFIXES.includes(local)) return "individual";
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
    const e = m[0].toLowerCase().replace(/[.,;]+$/, "");
    if (JUNK_EMAIL_RE.test(e)) continue;
    if (e.length > 80) continue;
    out.add(e);
  }
  // prefer same-domain emails first
  const arr = [...out];
  arr.sort((a, b) => {
    const ad = a.endsWith(domain) ? 0 : 1;
    const bd = b.endsWith(domain) ? 0 : 1;
    return ad - bd;
  });
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
}

export async function fetchPage(url: string, timeoutMs = 15000): Promise<FetchOut | null> {
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
      const html = await res.text();
      return { html, status: res.status, url: res.url, retried403: false };
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };

  let out = await attempt({});
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

function contactLinks(html: string, base: string): string[] {
  const urls: string[] = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const href = m[1];
    const label = stripTags(m[2]).toLowerCase();
    const hay = (href + " " + label).toLowerCase();
    if (!/contact|about|organiz|team|speaker|staff|cfp|call.for/.test(hay)) continue;
    try {
      const u = new URL(href, base);
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = "";
      urls.push(u.toString());
    } catch { /* ignore */ }
  }
  return [...new Set(urls)].slice(0, 6);
}

function harvest(
  page: FetchOut,
  domain: string,
  strategy: Strategy,
): { hits: ContactHit[]; jsonHits: ContactHit[]; text: string } {
  const hits: ContactHit[] = [];
  const jsonHits: ContactHit[] = [];
  const mailtos = [...page.html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => m[1]);
  const text = stripTags(page.html);
  const emails = new Set<string>([
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

export async function crawlDomain(
  startUrl: string,
  opts: { maxPages?: number } = {},
): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 14;
  const host = hostOf(startUrl);
  const result: CrawlResult = {
    domain: host ?? "",
    start_url: startUrl,
    hits: [],
    best: null,
    strategies_tried: [],
    pages_fetched: 0,
    contact_page_only: null,
    error: null,
  };
  if (!host) {
    result.error = "invalid_url";
    return result;
  }
  if (isBlockedHost(host)) {
    result.error = "blocked_aggregator";
    return result;
  }

  const seen = new Set<string>();
  const push = (s: string) => {
    if (!result.strategies_tried.includes(s)) result.strategies_tried.push(s);
  };

  const visit = async (url: string, strategy: Strategy, domain: string) => {
    if (result.pages_fetched >= maxPages) return null;
    const key = url.replace(/\/$/, "");
    if (seen.has(key)) return null;
    seen.add(key);
    const page = await fetchPage(url);
    result.pages_fetched++;
    push(strategy);
    if (!page) return null;
    if (page.retried403) push("retry_403");
    const { hits, jsonHits, text } = harvest(page, domain, strategy);
    if (hits.length) result.hits.push(...hits);
    if (jsonHits.length) {
      push("embedded_json");
      result.hits.push(...jsonHits);
    }
    // JS-rendered / empty page detection
    if (!hits.length && !jsonHits.length && text.replace(/\s+/g, "").length < 200) {
      push("empty_page");
    }
    return { page, text };
  };

  const runHost = async (h: string, entry: string, entryStrategy: Strategy) => {
    const origin = `https://${h}`;
    const first = await visit(entry, entryStrategy, h);
    if (result.hits.length) return;

    // probe common paths
    for (const p of PROBE_PATHS) {
      if (result.hits.length) return;
      await visit(origin + p, "probe_path", h);
    }
    if (result.hits.length) return;

    // one-hop follow of contact-ish links found on the entry page
    if (first) {
      const links = contactLinks(first.page.html, first.page.url);
      if (links.length) result.contact_page_only = links[0];
      for (const l of links) {
        if (result.hits.length) return;
        if (hostOf(l) !== h) continue;
        await visit(l, "contact_link_hop", h);
      }
    }
  };

  await runHost(host, startUrl, "event_url");

  if (!result.hits.length) {
    const parent = parentDomain(host);
    if (parent && !isBlockedHost(parent)) {
      await runHost(parent, `https://${parent}/`, "parent_domain");
      if (result.hits.length) {
        result.hits = result.hits.map((h) => ({ ...h, strategy: "parent_domain" as Strategy }));
      }
    }
  }

  // dedupe
  const byEmail = new Map<string, ContactHit>();
  for (const h of result.hits) if (!byEmail.has(h.email)) byEmail.set(h.email, h);
  result.hits = [...byEmail.values()];
  result.best = pickBest(result.hits);
  return result;
}
