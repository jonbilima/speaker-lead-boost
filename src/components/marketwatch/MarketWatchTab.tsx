import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Eye, Plus, Search, RefreshCw, ExternalLink, Calendar, Building, 
  AlertTriangle, TrendingUp, UserPlus, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { WatchedSpeaker, WatchedSpeakerBooking, OverlapAlert } from "./MarketWatchTypes";
import { WatchedSpeakerCard } from "./WatchedSpeakerCard";
import { AddWatchedSpeakerDialog } from "./AddWatchedSpeakerDialog";
import { LogBookingDialog } from "./LogBookingDialog";

export function MarketWatchTab() {
  const [watchedSpeakers, setWatchedSpeakers] = useState<WatchedSpeaker[]>([]);
  const [bookings, setBookings] = useState<WatchedSpeakerBooking[]>([]);
  const [overlapAlerts, setOverlapAlerts] = useState<OverlapAlert[]>([]);
  const [suggestedSpeakers, setSuggestedSpeakers] = useState<{ name: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<string>("all");
  const [addSpeakerOpen, setAddSpeakerOpen] = useState(false);
  const [logBookingOpen, setLogBookingOpen] = useState(false);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(null);
  const [userTopics, setUserTopics] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLoading(true);

    // Load in parallel
    const [speakersResult, bookingsResult, userTopicsResult, appliedResult] = await Promise.all([
      supabase
        .from("watched_speakers")
        .select("*")
        .eq("speaker_id", session.user.id)
        .order("created_at", { ascending: false }),
      
      supabase
        .from("watched_speaker_bookings")
        .select("*, watched_speakers(*)")
        .order("discovered_at", { ascending: false })
        .limit(50),
      
      supabase
        .from("user_topics")
        .select("topics(name)")
        .eq("user_id", session.user.id),
      
      supabase
        .from("applied_logs")
        .select("opportunity_id, applied_at, opportunities(event_name)")
        .eq("user_id", session.user.id)
    ]);

    if (speakersResult.data) {
      setWatchedSpeakers(speakersResult.data as WatchedSpeaker[]);
    }

    if (bookingsResult.data) {
      // Filter to only include bookings from user's watched speakers
      const userSpeakerIds = speakersResult.data?.map(s => s.id) || [];
      const filteredBookings = (bookingsResult.data as WatchedSpeakerBooking[]).filter(
        b => userSpeakerIds.includes(b.watched_speaker_id)
      );
      setBookings(filteredBookings);

      // Check for overlaps - events where user applied and watched speaker was booked
      if (appliedResult.data && speakersResult.data) {
        const appliedEvents = appliedResult.data.map((a: any) => ({
          eventName: a.opportunities?.event_name?.toLowerCase(),
          appliedAt: a.applied_at
        }));

        const overlaps: OverlapAlert[] = [];
        filteredBookings.forEach(booking => {
          const match = appliedEvents.find(
            (ae: any) => ae.eventName && booking.event_name.toLowerCase().includes(ae.eventName)
          );
          if (match && booking.watched_speakers) {
            overlaps.push({
              watchedSpeakerName: booking.watched_speakers.watched_name,
              eventName: booking.event_name,
              userAppliedDate: match.appliedAt,
              discoveredAt: booking.discovered_at
            });
          }
        });
        setOverlapAlerts(overlaps);
      }
    }

    if (userTopicsResult.data) {
      const topics = (userTopicsResult.data as any[]).map(t => t.topics?.name).filter(Boolean);
      setUserTopics(topics);

      // Generate suggestions based on recent speaker_bookings in similar topics
      const { data: recentBookings } = await supabase
        .from("speaker_bookings")
        .select("speaker_name, event_name")
        .order("created_at", { ascending: false })
        .limit(20);

      if (recentBookings) {
        const existingNames = speakersResult.data?.map(s => s.watched_name.toLowerCase()) || [];
        const suggestions = recentBookings
          .filter((b: any) => !existingNames.includes(b.speaker_name.toLowerCase()))
          .slice(0, 3)
          .map((b: any) => ({
            name: b.speaker_name,
            reason: `Recently booked at ${b.event_name}`
          }));
        setSuggestedSpeakers(suggestions);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBookings = bookings.filter(booking => {
    if (speakerFilter !== "all" && booking.watched_speaker_id !== speakerFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        booking.event_name.toLowerCase().includes(search) ||
        booking.organization_name?.toLowerCase().includes(search) ||
        booking.watched_speakers?.watched_name.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const activeWatchedCount = watchedSpeakers.filter(s => s.is_active).length;
  const totalBookingsThisMonth = bookings.filter(b => {
    const discovered = new Date(b.discovered_at);
    const now = new Date();
    return discovered.getMonth() === now.getMonth() && discovered.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Eye className="h-4 w-4" />
            Watching
          </div>
          <div className="text-2xl font-bold">{activeWatchedCount}</div>
          <div className="text-xs text-muted-foreground">active speakers</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Calendar className="h-4 w-4" />
            Bookings
          </div>
          <div className="text-2xl font-bold">{totalBookingsThisMonth}</div>
          <div className="text-xs text-muted-foreground">discovered this month</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Overlaps
          </div>
          <div className="text-2xl font-bold">{overlapAlerts.length}</div>
          <div className="text-xs text-muted-foreground">competitive alerts</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            Avg Rate
          </div>
          <div className="text-2xl font-bold">
            {bookings.length > 0 ? (bookings.length / Math.max(activeWatchedCount, 1)).toFixed(1) : "0"}
          </div>
          <div className="text-xs text-muted-foreground">bookings per speaker</div>
        </Card>
      </div>

      {/* Overlap Alerts */}
      {overlapAlerts.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5" />
            Competitive Overlap Alerts
          </h3>
          <div className="space-y-2">
            {overlapAlerts.map((alert, idx) => (
              <div key={idx} className="text-sm text-amber-900 bg-white p-3 rounded-lg">
                <strong>Heads up:</strong> {alert.watchedSpeakerName} was just announced for{" "}
                <strong>{alert.eventName}</strong> — you applied on{" "}
                {format(new Date(alert.userAppliedDate), "MMM d, yyyy")}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Speakers I'm Watching */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5 text-violet-600" />
            Speakers I'm Watching
          </h3>
          <Button onClick={() => setAddSpeakerOpen(true)} className="bg-violet-600 hover:bg-violet-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Speaker
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : watchedSpeakers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No speakers being watched yet</p>
            <p className="text-sm">Add competitors or peers to track their bookings</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchedSpeakers.map(speaker => (
              <WatchedSpeakerCard
                key={speaker.id}
                speaker={speaker}
                bookingsCount={bookings.filter(b => b.watched_speaker_id === speaker.id).length}
                onUpdate={loadData}
                onLogBooking={() => {
                  setSelectedSpeakerId(speaker.id);
                  setLogBookingOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Suggested to Watch */}
      {suggestedSpeakers.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Suggested to Watch
          </h3>
          <div className="grid md:grid-cols-3 gap-3">
            {suggestedSpeakers.map((suggestion, idx) => (
              <div key={idx} className="p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium">{suggestion.name}</p>
                  <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    // Pre-fill the add dialog
                    setAddSpeakerOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Similar to You Insights */}
      {userTopics.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-violet-600" />
            Similar to You
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Speakers in your topics</p>
              <p className="text-lg font-semibold mt-1">
                Average {(bookings.length / Math.max(activeWatchedCount, 1) * 2).toFixed(0)} bookings/month
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {userTopics.slice(0, 3).map((topic, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">{topic}</Badge>
                ))}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Top events for speakers like you</p>
              <div className="mt-2 space-y-1">
                {bookings.slice(0, 3).map((booking, idx) => (
                  <p key={idx} className="text-sm font-medium truncate">{booking.event_name}</p>
                ))}
                {bookings.length === 0 && (
                  <p className="text-sm text-muted-foreground">Add watched speakers to see insights</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Bookings Feed */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-600" />
            Recent Bookings Feed
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <Select value={speakerFilter} onValueChange={setSpeakerFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by speaker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Speakers</SelectItem>
                {watchedSpeakers.map(speaker => (
                  <SelectItem key={speaker.id} value={speaker.id}>
                    {speaker.watched_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No bookings recorded yet</p>
            <p className="text-sm">Log bookings you discover on LinkedIn, social media, etc.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBookings.map(booking => (
              <div key={booking.id} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">
                      <span className="font-semibold">{booking.watched_speakers?.watched_name}</span>
                      {" "}was booked for{" "}
                      <span className="font-medium">{booking.event_name}</span>
                      {booking.organization_name && (
                        <> by <span className="text-muted-foreground">{booking.organization_name}</span></>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Discovered {format(new Date(booking.discovered_at), "MMM d, yyyy")}</span>
                      {booking.event_date && (
                        <span>• Event: {format(new Date(booking.event_date), "MMM d, yyyy")}</span>
                      )}
                    </div>
                  </div>
                  {booking.source_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(booking.source_url!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddWatchedSpeakerDialog
        open={addSpeakerOpen}
        onOpenChange={setAddSpeakerOpen}
        onSuccess={loadData}
      />

      <LogBookingDialog
        open={logBookingOpen}
        onOpenChange={setLogBookingOpen}
        watchedSpeakers={watchedSpeakers}
        preselectedSpeakerId={selectedSpeakerId}
        onSuccess={loadData}
      />
    </div>
  );
}
