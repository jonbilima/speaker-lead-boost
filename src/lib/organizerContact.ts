// Speaker-facing organizer contact paths.
// Never surface internal crawl details (strategy, pages fetched, render usage).

export interface OrganizerContactRow {
  domain: string;
  confidence_tier: string | null;
  email: string | null;
  contact_form_url: string | null;
  linkedin_url: string | null;
  phone: string | null;
  socials: unknown;
  physical_address: string | null;
}

export type ContactTierLabel =
  | "Verified contact"
  | "Role inbox"
  | "Contact form only"
  | "Submit through the listing"
  | "No contact path found";

export interface ContactPath {
  kind: "email" | "form" | "phone" | "linkedin" | "social" | "address" | "listing";
  label: string;
  value: string;
  href?: string;
}


export interface OrganizerContactInfo {
  tier: ContactTierLabel;
  paths: ContactPath[];
  primaryEmail: string | null;
  hasAnyPath: boolean;
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function socialEntries(socials: unknown): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  if (!socials) return out;
  if (Array.isArray(socials)) {
    for (const s of socials) {
      if (typeof s === "string") out.push({ label: platformName(s), url: s });
    }
    return out;
  }
  if (typeof socials === "object") {
    for (const [k, v] of Object.entries(socials as Record<string, unknown>)) {
      if (typeof v === "string" && v) {
        out.push({ label: k.charAt(0).toUpperCase() + k.slice(1), url: v });
      }
    }
  }
  return out;
}

function platformName(url: string): string {
  const h = hostOf(url) ?? "";
  if (h.includes("twitter") || h.includes("x.com")) return "X";
  if (h.includes("instagram")) return "Instagram";
  if (h.includes("facebook")) return "Facebook";
  if (h.includes("linkedin")) return "LinkedIn";
  if (h.includes("youtube")) return "YouTube";
  return "Social";
}

export function findContactForUrl(
  eventUrl: string | null | undefined,
  contacts: OrganizerContactRow[],
): OrganizerContactRow | null {
  const host = hostOf(eventUrl);
  if (!host) return null;
  let best: OrganizerContactRow | null = null;
  for (const c of contacts) {
    if (!c.domain) continue;
    if (host === c.domain || host.endsWith(`.${c.domain}`) || c.domain.endsWith(`.${host}`)) {
      if (!best || c.domain.length > best.domain.length) best = c;
    }
  }
  return best;
}

/**
 * Aggregator listings (Sessionize, Eventbrite, Meetup) expose a working
 * submit / message-organizer function. That is the intended way to reach these
 * organizers, so it counts as a real contact path.
 * PaperCall is excluded: it is login-walled and shutting down 2026-08-31.
 */
export function listingPath(eventUrl: string | null | undefined): ContactPath | null {
  const host = hostOf(eventUrl);
  if (!host || !eventUrl) return null;
  if (host.endsWith("sessionize.com")) {
    return {
      kind: "listing",
      label: "Submit through Sessionize",
      value: eventUrl,
      href: eventUrl,
    };
  }
  if (host.endsWith("eventbrite.com") || host.endsWith("eventbrite.co.uk")) {
    return {
      kind: "listing",
      label: "Message organizer on Eventbrite",
      value: eventUrl,
      href: eventUrl,
    };
  }
  if (host.endsWith("meetup.com")) {
    return {
      kind: "listing",
      label: "Message organizer on Meetup",
      value: eventUrl,
      href: eventUrl,
    };
  }
  return null;
}

export function buildContactInfo(
  organizerEmail: string | null,
  contact: OrganizerContactRow | null,
  eventUrl?: string | null,
): OrganizerContactInfo {
  const paths: ContactPath[] = [];
  const email = organizerEmail ?? contact?.email ?? null;

  if (email) {
    paths.push({ kind: "email", label: "Email", value: email, href: `mailto:${email}` });
  }
  if (contact?.contact_form_url) {
    paths.push({
      kind: "form",
      label: "Contact form",
      value: contact.contact_form_url,
      href: contact.contact_form_url,
    });
  }
  if (contact?.phone) {
    paths.push({
      kind: "phone",
      label: "Phone",
      value: contact.phone,
      href: `tel:${contact.phone.replace(/[^\d+]/g, "")}`,
    });
  }
  if (contact?.linkedin_url) {
    paths.push({
      kind: "linkedin",
      label: "LinkedIn",
      value: contact.linkedin_url,
      href: contact.linkedin_url,
    });
  }
  for (const s of socialEntries(contact?.socials)) {
    paths.push({ kind: "social", label: s.label, value: s.url, href: s.url });
  }
  if (contact?.physical_address) {
    paths.push({ kind: "address", label: "Mailing address", value: contact.physical_address });
  }

  const listing = listingPath(eventUrl);
  if (listing) paths.push(listing);

  let tier: ContactTierLabel;
  if (email) {
    tier = contact?.confidence_tier === "role_inbox" ? "Role inbox" : "Verified contact";
  } else if (paths.some((p) => p.kind !== "listing")) {
    tier = "Contact form only";
  } else if (listing) {
    tier = "Submit through the listing";
  } else {
    tier = "No contact path found";
  }

  return { tier, paths, primaryEmail: email, hasAnyPath: paths.length > 0 };
}


export function tierToneClass(tier: ContactTierLabel): string {
  switch (tier) {
    case "Verified contact":
      return "border-primary/40 text-primary";
    case "Role inbox":
      return "border-primary/30 text-foreground";
    case "Contact form only":
      return "border-accent/40 text-accent-foreground";
    case "Submit through the listing":
      return "border-accent/40 text-accent-foreground";
    default:
      return "border-muted-foreground/30 text-muted-foreground";
  }
}

