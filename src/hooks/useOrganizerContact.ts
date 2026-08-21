import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  OrganizerContactRow,
  OrganizerContactInfo,
  buildContactInfo,
  findContactForUrl,
} from "@/lib/organizerContact";

let cache: Promise<OrganizerContactRow[]> | null = null;

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

/** Resolves the speaker-facing contact paths for one opportunity. */
export function useOrganizerContact(
  eventUrl: string | null | undefined,
  organizerEmail: string | null,
): OrganizerContactInfo {
  const [info, setInfo] = useState<OrganizerContactInfo>(() =>
    buildContactInfo(organizerEmail, null),
  );

  useEffect(() => {
    let active = true;
    loadContacts().then((rows) => {
      if (!active) return;
      setInfo(buildContactInfo(organizerEmail, findContactForUrl(eventUrl, rows)));
    });
    return () => {
      active = false;
    };
  }, [eventUrl, organizerEmail]);

  return info;
}
