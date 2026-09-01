// Resolve an aggregator listing page (Sessionize, Eventbrite, PaperCall, Meetup, ...)
// to the organizer's own website domain, so the normal crawler can run on it.
import { fetchPage, hostOf, isBlockedHost, renderPage } from "./organizer-crawler.ts";

/** Hosts that are never an organizer's own site. */
const NOISE_HOST_RE =
  /(facebook|twitter|x\.com|linkedin|instagram|youtube|youtu\.be|tiktok|threads|mastodon|bsky|github|gravatar|google|gstatic|googleapis|apple\.com|microsoft\.com|office\.com|bit\.ly|t\.co|paypal|stripe|patreon|slack\.com|discord|whatsapp|telegram|wikipedia|amazon\.|cloudflare|jsdelivr|cdn\.|w3\.org|schema\.org|creativecommons|gofundme|mailchimp|constantcontact|hubspot|eventbrite|sessionize|papercall|meetup\.com|callingallpapers|cvent|pheedloop|typeform|forms\.gle|linktr\.ee|hopin|zoom\.us|vimeo|flickr|medium\.com|substack|wordpress\.com|wix\.com|squarespace\.com|godaddy)/i;

const TOKEN_STOP = new Set(
  "the a an of and for on in at to 20 2024 2025 2026 2027 conference conf summit expo event events day days week annual national regional virtual online hybrid call papers cfp".split(
    /\s+/,
  ),
);

function nameTokens(s: string | null | undefined): string[] {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !TOKEN_STOP.has(t));
}

export interface ResolvedListing {
  listing_url: string;
  resolved_domain: string | null;
  candidates: string[];
  rendered: boolean;
  error: string | null;
}

/**
 * Pull the organizer's own website out of an aggregator listing page.
 * Scores outbound hosts by frequency, event-name overlap, and link label.
 */
export function pickOrganizerDomain(
  html: string,
  listingUrl: string,
  eventName?: string | null,
): { domain: string | null; candidates: string[] } {
  const listingHost = hostOf(listingUrl) ?? "";
  const scores = new Map<string, number>();
  const tokens = nameTokens(eventName);

  const bump = (host: string, by: number) => scores.set(host, (scores.get(host) ?? 0) + by);

  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    let u: URL;
    try {
      u = new URL(m[1], listingUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === listingHost) continue;
    if (isBlockedHost(host) || NOISE_HOST_RE.test(host)) continue;
    if (host.split(".").length < 2) continue;

    bump(host, 1);
    const label = m[2].replace(/<[^>]+>/g, " ").toLowerCase();
    if (/website|home ?page|event site|official|organiz|more info|learn more|visit/.test(label)) {
      bump(host, 6);
    }
    if (/(^|\/)(about|contact)/.test(u.pathname.toLowerCase())) bump(host, 2);
    const bare = host.replace(/\.[a-z.]+$/, "").replace(/[^a-z0-9]/g, "");
    for (const t of tokens) if (bare.includes(t)) bump(host, 4);
  }

  // Bare URLs in text (Sessionize often prints the site without an anchor).
  for (const m of html.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
    const host = m[1].toLowerCase().replace(/^www\./, "");
    if (!host || host === listingHost) continue;
    if (isBlockedHost(host) || NOISE_HOST_RE.test(host)) continue;
    bump(host, 0.5);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const candidates = ranked.slice(0, 8).map(([h]) => h);
  const top = ranked[0];
  // A single stray reference is not enough signal.
  return { domain: top && top[1] >= 2 ? top[0] : null, candidates };
}

/** Fetch a listing page (with browser-render fallback) and resolve the organizer domain. */
export async function resolveListing(
  listingUrl: string,
  opts: { eventName?: string | null; firecrawlKey?: string } = {},
): Promise<ResolvedListing> {
  const out: ResolvedListing = {
    listing_url: listingUrl,
    resolved_domain: null,
    candidates: [],
    rendered: false,
    error: null,
  };
  try {
    const page = await fetchPage(listingUrl, 20000);
    if (page?.html) {
      const r = pickOrganizerDomain(page.html, listingUrl, opts.eventName);
      out.resolved_domain = r.domain;
      out.candidates = r.candidates;
    }
    if (!out.resolved_domain && opts.firecrawlKey) {
      const rendered = await renderPage(listingUrl, opts.firecrawlKey);
      if (rendered?.html) {
        out.rendered = true;
        const r = pickOrganizerDomain(rendered.html, listingUrl, opts.eventName);
        out.resolved_domain = r.domain;
        out.candidates = r.candidates.length ? r.candidates : out.candidates;
      }
    }
    if (!page && !out.rendered) out.error = "fetch_failed";
  } catch (e) {
    out.error = String(e);
  }
  return out;
}
