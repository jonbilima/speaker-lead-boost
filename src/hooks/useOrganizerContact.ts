import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  OrganizerContactRow,
  OrganizerContactInfo,
  buildContactInfo,
  findContactForUrl,
} from "@/lib/organizerContact";

let cache: Promise<OrganizerContactRow[]> | null = null;
let resolvedCache: Promise<Map<string, string>> | null = null;

function loadContacts(): Promise<OrganizerContactRow[]> {
  if (!cache) {
    cache = (async () => {
      try {
        const { data } = await supabase
          .from("organizer_contacts")
          .select(
            "domain, confidence_tier, email, contact_form_url, linkedin_url, phone, socials, physical_address",
          );
        return (data ?? []) as OrganizerContactRow[];
      } catch {
        return [] as OrganizerContactRow[];
      }
    })();
  }
  return cache;
}

/** opportunity_id -> real organizer domain, for listings hosted on aggregators. */
function loadResolvedDomains(): Promise<Map<string, string>> {
  if (!resolvedCache) {
    resolvedCache = (async () => {
      const map = new Map<string, string>();
      type Row = { opportunity_id: string; resolved_domain: string | null };
      const absorb = (rows: Row[] | null) => {
        for (const r of rows ?? []) {
          if (r.resolved_domain && !map.has(r.opportunity_id)) {
            map.set(r.opportunity_id, r.resolved_domain);
          }
        }
      };
      try {
        const [byLink, byName, byDomain] = await Promise.all([
          supabase
            .from("aggregator_domain_resolution_20260821")
            .select("opportunity_id, resolved_domain"),
          supabase
            .from("organizer_name_resolution_20260824")
            .select("opportunity_id, resolved_domain"),
          supabase
            .from("organizer_domain_match_20260824")
            .select("opportunity_id, resolved_domain"),
        ]);
        absorb(byLink.data as Row[] | null);
        absorb(byName.data as Row[] | null);
        absorb(byDomain.data as Row[] | null);
      } catch {

        /* fall through with whatever resolved */
      }
      return map;
    })();
  }
  return resolvedCache;
}


/** Resolves the speaker-facing contact paths for one opportunity. */
export function useOrganizerContact(
  eventUrl: string | null | undefined,
  organizerEmail: string | null,
  opportunityId?: string | null,
): OrganizerContactInfo {
  const [info, setInfo] = useState<OrganizerContactInfo>(() =>
    buildContactInfo(organizerEmail, null, eventUrl),
  );

  useEffect(() => {
    let active = true;
    Promise.all([loadContacts(), loadResolvedDomains()]).then(([rows, resolved]) => {
      if (!active) return;
      let match = findContactForUrl(eventUrl, rows);
      if (!match && opportunityId) {
        const domain = resolved.get(opportunityId);
        if (domain) match = findContactForUrl(`https://${domain}`, rows);
      }
      setInfo(buildContactInfo(organizerEmail, match, eventUrl));
    });

    return () => {
      active = false;
    };
  }, [eventUrl, organizerEmail, opportunityId]);

  return info;
}


export type ContactLookup = (
  eventUrl: string | null | undefined,
  organizerEmail: string | null,
  opportunityId?: string | null,
) => OrganizerContactInfo;

/**
 * Page-level lookup so lists can rank opportunities by contactability
 * without mounting a hook per row.
 */
export function useOrganizerContactLookup(): ContactLookup {
  const [rows, setRows] = useState<OrganizerContactRow[]>([]);
  const [resolved, setResolved] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let active = true;
    Promise.all([loadContacts(), loadResolvedDomains()]).then(([r, m]) => {
      if (!active) return;
      setRows(r);
      setResolved(m);
    });
    return () => {
      active = false;
    };
  }, []);

  return (eventUrl, organizerEmail, opportunityId) => {
    let match = findContactForUrl(eventUrl, rows);
    if (!match && opportunityId) {
      const domain = resolved.get(opportunityId);
      if (domain) match = findContactForUrl(`https://${domain}`, rows);
    }
    return buildContactInfo(organizerEmail, match, eventUrl);
  };
}
