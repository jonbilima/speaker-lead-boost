import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarClock,
  Search,
  Mail,
  ExternalLink,
  Sparkles,
  Building2,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatEventDate } from "@/lib/eventDates";
import { useOrganizerContactLookup } from "@/hooks/useOrganizerContact";
import { NextCyclePitchDialog } from "@/components/nextcycle/NextCyclePitchDialog";

export interface NextCycleOpportunity {
  id: string;
  event_name: string;
  organizer_name: string | null;
  organizer_email: string | null;
  organizer_contact_url: string | null;
  event_url: string | null;
  deadline: string | null;
  event_date: string | null;
  location: string | null;
  description: string | null;
}

interface OrganizerGroup {
  key: string;
  name: string;
  events: NextCycleOpportunity[];
  email: string | null;
  contactUrl: string | null;
  lastClosed: number;
  nextEvent: number;
}

type SortKey = "events" | "recent" | "upcoming" | "name";

const hostOf = (url: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

const organizerKey = (o: NextCycleOpportunity) => {
  const name = o.organizer_name?.trim();
  if (name) return name.toLowerCase().replace(/\s+/g, " ");
  return hostOf(o.event_url) ?? o.id;
};

const NextCycle = () => {
  const [opportunities, setOpportunities] = useState<NextCycleOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("events");
  const [contactFilter, setContactFilter] = useState<"all" | "has" | "email">("all");
  const [pitchTarget, setPitchTarget] = useState<{
    opp: NextCycleOpportunity;
    email: string | null;
    url: string | null;
  } | null>(null);
  const contactLookup = useOrganizerContactLookup();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const nowIso = new Date().toISOString();

      const [{ data: opps, error }, { data: dismissed }] = await Promise.all([
        supabase
          .from("opportunities")
          .select(
            "id, event_name, organizer_name, organizer_email, organizer_contact_url, event_url, deadline, event_date, location, description",
          )
          .is("merged_into", null)
          .not("deadline", "is", null)
          .lt("deadline", nowIso)
          .order("deadline", { ascending: false })
          .limit(1000),
        supabase
          .from("opportunity_scores")
          .select("opportunity_id")
          .eq("user_id", session.user.id)
          .not("dismissed_at", "is", null),
      ]);

      if (error) throw error;

      const hidden = new Set((dismissed ?? []).map((d) => d.opportunity_id));
      setOpportunities(((opps ?? []) as NextCycleOpportunity[]).filter((o) => !hidden.has(o.id)));
    } catch (err) {
      console.error("Next cycle load error:", err);
      toast.error("Could not load closed calls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo<OrganizerGroup[]>(() => {
    const term = search.trim().toLowerCase();
    const byKey = new Map<string, OrganizerGroup>();

    for (const opp of opportunities) {
      if (term) {
        const haystack = `${opp.event_name} ${opp.organizer_name ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) continue;
      }

      const key = organizerKey(opp);
      const info = contactLookup(opp.event_url, opp.organizer_email, opp.id);
      const email = opp.organizer_email ?? info.primaryEmail ?? null;
      const contactUrl =
        opp.organizer_contact_url ??
        info.paths.find((p) => p.kind !== "listing")?.url ??
        null;

      const existing = byKey.get(key);
      const closedAt = opp.deadline ? new Date(opp.deadline).getTime() : 0;
      const eventAt = opp.event_date ? new Date(opp.event_date).getTime() : Infinity;

      if (existing) {
        existing.events.push(opp);
        existing.email = existing.email ?? email;
        existing.contactUrl = existing.contactUrl ?? contactUrl;
        existing.lastClosed = Math.max(existing.lastClosed, closedAt);
        existing.nextEvent = Math.min(existing.nextEvent, eventAt);
      } else {
        byKey.set(key, {
          key,
          name: opp.organizer_name?.trim() || hostOf(opp.event_url) || opp.event_name,
          events: [opp],
          email,
          contactUrl,
          lastClosed: closedAt,
          nextEvent: eventAt,
        });
      }
    }

    let list = Array.from(byKey.values());

    if (contactFilter === "email") list = list.filter((g) => !!g.email);
    if (contactFilter === "has") list = list.filter((g) => !!g.email || !!g.contactUrl);

    list.sort((a, b) => {
      switch (sort) {
        case "recent":
          return b.lastClosed - a.lastClosed;
        case "upcoming":
          return a.nextEvent - b.nextEvent;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return b.events.length - a.events.length || b.lastClosed - a.lastClosed;
      }
    });

    for (const g of list) {
      g.events.sort(
        (a, b) =>
          (b.deadline ? new Date(b.deadline).getTime() : 0) -
          (a.deadline ? new Date(a.deadline).getTime() : 0),
      );
    }

    return list;
  }, [opportunities, search, sort, contactFilter, contactLookup]);

  const eventCount = groups.reduce((n, g) => n + g.events.length, 0);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            Next Cycle
          </h1>
          <p className="text-muted-foreground mt-1">
            Calls that already closed. The organizer runs the event again — reach out early,
            before the next call opens.
          </p>
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by event or organizer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={contactFilter} onValueChange={(v) => setContactFilter(v as typeof contactFilter)}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any contact status</SelectItem>
                <SelectItem value="email">Has an email</SelectItem>
                <SelectItem value="has">Has any contact path</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="events">Most events per organizer</SelectItem>
                <SelectItem value="recent">Most recently closed</SelectItem>
                <SelectItem value="upcoming">Soonest event</SelectItem>
                <SelectItem value="name">Organizer name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {loading ? (
          <Card className="p-10 text-center text-muted-foreground">Loading closed calls…</Card>
        ) : groups.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            Nothing here yet. Closed calls land on this page automatically.
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {groups.length} organizer{groups.length === 1 ? "" : "s"} • {eventCount} closed call
              {eventCount === 1 ? "" : "s"}
            </p>

            <div className="space-y-3">
              {groups.map((group) => (
                <Card key={group.key} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-foreground flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {group.name}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        {group.events.length} event{group.events.length === 1 ? "" : "s"} in this
                        relationship
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.email ? (
                        <Badge variant="outline" className="gap-1">
                          <Mail className="h-3 w-3" />
                          {group.email}
                        </Badge>
                      ) : group.contactUrl ? (
                        <a
                          href={group.contactUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary inline-flex items-center gap-1 underline underline-offset-2"
                        >
                          Contact page <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <Badge variant="secondary">No contact on file</Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 divide-y divide-border">
                    {group.events.map((event) => {
                      const closed = formatEventDate(event.deadline);
                      const runs = formatEventDate(event.event_date);
                      return (
                        <div
                          key={event.id}
                          className="py-3 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">
                              {event.event_name}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                              <span>Call closed {closed ?? "—"}</span>
                              <span>{runs ? `Event runs ${runs}` : "Event date not stated"}</span>
                              {event.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {event.event_url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={event.event_url} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() =>
                                setPitchTarget({
                                  opp: event,
                                  email: group.email,
                                  url: group.contactUrl,
                                })
                              }
                            >
                              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                              Pitch next cycle
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <NextCyclePitchDialog
        open={!!pitchTarget}
        onOpenChange={(open) => !open && setPitchTarget(null)}
        opportunity={pitchTarget?.opp ?? null}
        contactEmail={pitchTarget?.email ?? null}
        contactUrl={pitchTarget?.url ?? null}
      />
    </AppLayout>
  );
};

export default NextCycle;
