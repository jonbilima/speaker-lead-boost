import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, History, Users, BarChart3, Lightbulb, 
  ExternalLink, Mail, Phone, Building2, Globe,
  Loader2, AlertCircle, Sparkles, UserPlus
} from "lucide-react";
import { useOrganizerResearch } from "@/hooks/useOrganizerResearch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface OrganizerResearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizerName: string | null;
  organizerEmail?: string | null;
}

export function OrganizerResearchSheet({
  open,
  onOpenChange,
  organizerName,
  organizerEmail
}: OrganizerResearchSheetProps) {
  const { data, isLoading, generateApproachStrategy, requestDeepResearch } = useOrganizerResearch(organizerName);
  const [userTopics, setUserTopics] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    // Fetch user's topics for AI strategy generation
    const fetchUserTopics = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: topics } = await supabase
        .from("user_topics")
        .select("topics(name)")
        .eq("user_id", user.id);

      if (topics) {
        setUserTopics(topics.map((t: any) => t.topics?.name).filter(Boolean));
      }
    };

    if (open) {
      fetchUserTopics();
    }
  }, [open]);

  const handleAddToContacts = async () => {
    if (!data?.organizer.name) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to save contacts");
      return;
    }

    // Check if organizer already exists
    const { data: existing } = await supabase
      .from("organizers")
      .select("id")
      .eq("name", data.organizer.name)
      .maybeSingle();

    if (existing) {
      toast.info("This organizer is already in the database");
      return;
    }

    const { error } = await supabase.from("organizers").insert({
      name: data.organizer.name,
      email: data.organizer.email,
      phone: data.organizer.phone,
      linkedin_url: data.organizer.linkedin_url,
      organization_name: data.organizer.organization_name,
      organization_website: data.organizer.organization_website
    });

    if (error) {
      toast.error("Failed to save organizer");
    } else {
      toast.success("Organizer added to contacts!");
    }
  };

  const handleGenerateStrategy = () => {
    generateApproachStrategy(userTopics);
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-violet-600" />
            Organizer Research
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {organizerName || "Unknown Organizer"}
          </p>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : data?.isResearchInProgress ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-violet-600 mb-4" />
            <h3 className="font-semibold text-lg">Research in Progress</h3>
            <p className="text-muted-foreground mt-2">
              We're gathering more information about this organizer...
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
              <TabsList className="grid grid-cols-5 w-full mb-4">
                <TabsTrigger value="profile" className="text-xs px-2">
                  <User className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Profile</span>
                </TabsTrigger>
                <TabsTrigger value="events" className="text-xs px-2">
                  <History className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Events</span>
                </TabsTrigger>
                <TabsTrigger value="speakers" className="text-xs px-2">
                  <Users className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Speakers</span>
                </TabsTrigger>
                <TabsTrigger value="insights" className="text-xs px-2">
                  <BarChart3 className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Insights</span>
                </TabsTrigger>
                <TabsTrigger value="strategy" className="text-xs px-2">
                  <Lightbulb className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Strategy</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4">
                <OrganizerProfileTab 
                  data={data} 
                  organizerEmail={organizerEmail}
                  onAddToContacts={handleAddToContacts}
                />
              </TabsContent>

              <TabsContent value="events" className="space-y-4">
                <EventHistoryTab data={data} />
              </TabsContent>

              <TabsContent value="speakers" className="space-y-4">
                <SpeakersBookedTab data={data} />
              </TabsContent>

              <TabsContent value="insights" className="space-y-4">
                <BookingInsightsTab data={data} />
              </TabsContent>

              <TabsContent value="strategy" className="space-y-4">
                <ApproachStrategyTab 
                  data={data} 
                  userTopics={userTopics}
                  onGenerate={handleGenerateStrategy}
                />
              </TabsContent>
            </Tabs>

            {data?.hasLimitedData && (
              <div className="p-4 border-t">
                <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Limited Data Available
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        We have limited information about this organizer. Request deeper research to gather more data.
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-3"
                        onClick={requestDeepResearch}
                      >
                        Request Research
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrganizerProfileTab({ 
  data, 
  organizerEmail,
  onAddToContacts 
}: { 
  data: any; 
  organizerEmail?: string | null;
  onAddToContacts: () => void;
}) {
  const organizer = data?.organizer;
  const email = organizer?.email || organizerEmail;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{organizer?.name || "Unknown"}</h3>
            {organizer?.organization_name && (
              <p className="text-muted-foreground">{organizer.organization_name}</p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={onAddToContacts}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add to Contacts
          </Button>
        </div>
      </Card>

      <div className="grid gap-3">
        {email && (
          <Card className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{email}</span>
            </div>
            <Button size="sm" variant="ghost" asChild>
              <a href={`mailto:${email}`}>
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </Card>
        )}

        {organizer?.phone && (
          <Card className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{organizer.phone}</span>
            </div>
          </Card>
        )}

        {organizer?.linkedin_url && (
          <Card className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">LinkedIn Profile</span>
            </div>
            <Button size="sm" variant="ghost" asChild>
              <a href={organizer.linkedin_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </Card>
        )}

        {organizer?.organization_website && (
          <Card className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Website</span>
            </div>
            <Button size="sm" variant="ghost" asChild>
              <a href={organizer.organization_website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </Card>
        )}
      </div>

      {!email && !organizer?.linkedin_url && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No contact information available yet
        </p>
      )}
    </div>
  );
}

function EventHistoryTab({ data }: { data: any }) {
  const events = data?.eventHistory || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Event History</h4>
        <Badge variant="secondary">{events.length} events in database</Badge>
      </div>

      {events.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No events found for this organizer</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event: any) => (
            <Card key={event.id} className="p-3">
              <h5 className="font-medium text-sm">{event.event_name}</h5>
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                {event.event_date && (
                  <span>{format(new Date(event.event_date), "MMM d, yyyy")}</span>
                )}
                {event.location && <span>• {event.location}</span>}
                {(event.fee_estimate_min || event.fee_estimate_max) && (
                  <span>
                    • ${event.fee_estimate_min?.toLocaleString() || "?"} - ${event.fee_estimate_max?.toLocaleString() || "?"}
                  </span>
                )}
              </div>
              {event.topics.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {event.topics.slice(0, 3).map((topic: string) => (
                    <Badge key={topic} variant="outline" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                  {event.topics.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{event.topics.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SpeakersBookedTab({ data }: { data: any }) {
  const speakers = data?.speakersBooked || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Speakers Booked</h4>
        <Badge variant="secondary">{speakers.length} speakers</Badge>
      </div>

      {speakers.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No speaker bookings found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {speakers.map((speaker: any) => (
            <Card key={speaker.id} className="p-3 flex items-center justify-between">
              <div>
                <h5 className="font-medium text-sm">{speaker.speaker_name}</h5>
                <p className="text-xs text-muted-foreground">
                  {speaker.event_name}
                  {speaker.event_date && ` • ${format(new Date(speaker.event_date), "MMM yyyy")}`}
                </p>
              </div>
              {speaker.speaker_linkedin && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={speaker.speaker_linkedin} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingInsightsTab({ data }: { data: any }) {
  const insights = data?.insights;

  if (!insights) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Not enough data for insights</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-3xl font-bold text-violet-600">{insights.budgetTier}</div>
          <div>
            <p className="font-medium">Budget Tier</p>
            <p className="text-sm text-muted-foreground">{insights.budgetRange}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="font-medium mb-3">Topics They Book Most</h4>
        {insights.topTopics.length > 0 ? (
          <div className="space-y-2">
            {insights.topTopics.map((topic: any) => (
              <div key={topic.name} className="flex items-center justify-between">
                <span className="text-sm">{topic.name}</span>
                <Badge variant="secondary">{topic.count} events</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No topic data available</p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Booking Timeline</p>
          <p className="font-medium text-sm mt-1">{insights.bookingTimeline}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Events</p>
          <p className="font-medium text-sm mt-1">{insights.totalEvents} tracked</p>
        </Card>
      </div>

      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Experience Level</p>
        <p className="font-medium text-sm mt-1">{insights.preferredExperience}</p>
      </Card>
    </div>
  );
}

function ApproachStrategyTab({ 
  data, 
  userTopics,
  onGenerate 
}: { 
  data: any; 
  userTopics: string[];
  onGenerate: () => void;
}) {
  const strategy = data?.approachStrategy;

  if (!strategy?.talkingPoints.length && !strategy?.loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <Sparkles className="h-10 w-10 mx-auto mb-3 text-violet-600" />
          <h4 className="font-medium mb-2">AI-Powered Approach Strategy</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Generate personalized talking points and pitch angles based on this organizer's history and your topics.
          </p>
          <Button 
            onClick={onGenerate} 
            className="bg-violet-600 hover:bg-violet-700"
            disabled={userTopics.length === 0}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Strategy
          </Button>
          {userTopics.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Add topics to your profile to generate strategies
            </p>
          )}
        </Card>
      </div>
    );
  }

  if (strategy?.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600 mb-3" />
        <p className="text-sm text-muted-foreground">Generating approach strategy...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {strategy.suggestedAngle && (
        <Card className="p-4 bg-violet-50 dark:bg-violet-950/20 border-violet-200">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-violet-600" />
            Suggested Pitch Angle
          </h4>
          <p className="text-sm">{strategy.suggestedAngle}</p>
        </Card>
      )}

      {strategy.talkingPoints.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">Talking Points</h4>
          <ul className="space-y-2">
            {strategy.talkingPoints.map((point: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-violet-600 font-bold">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {strategy.relevantTopics.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">Your Relevant Topics</h4>
          <div className="flex flex-wrap gap-2">
            {strategy.relevantTopics.map((topic: string) => (
              <Badge key={topic} className="bg-violet-100 text-violet-800">
                {topic}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Button variant="outline" onClick={onGenerate} className="w-full">
        <Sparkles className="h-4 w-4 mr-2" />
        Regenerate Strategy
      </Button>
    </div>
  );
}
