import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  MapPin,
  DollarSign,
  ExternalLink,
  Mail,
  Phone,
  FileText,
  Clock,
  Send,
  MessageSquare,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { PipelineOpportunity } from "./PipelineCard";
import { PackageBuilderDialog } from "./PackageBuilderDialog";
import { PackageStats } from "./PackageStats";

interface Activity {
  id: string;
  activity_type: string;
  subject: string | null;
  body: string | null;
  notes: string | null;
  created_at: string;
}

interface PipelineDetailModalProps {
  opportunity: PipelineOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivityLogged: () => void;
}

const activityTypeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  email_sent: { label: "Email Sent", icon: <Send className="h-4 w-4" />, color: "bg-blue-100 text-blue-700" },
  email_received: { label: "Email Received", icon: <Mail className="h-4 w-4" />, color: "bg-green-100 text-green-700" },
  call: { label: "Call", icon: <Phone className="h-4 w-4" />, color: "bg-purple-100 text-purple-700" },
  meeting: { label: "Meeting", icon: <Calendar className="h-4 w-4" />, color: "bg-orange-100 text-orange-700" },
  note: { label: "Note", icon: <FileText className="h-4 w-4" />, color: "bg-gray-100 text-gray-700" },
  follow_up: { label: "Follow Up", icon: <Clock className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-700" },
  social_interaction: { label: "Social", icon: <MessageSquare className="h-4 w-4" />, color: "bg-pink-100 text-pink-700" },
};

export function PipelineDetailModal({
  opportunity,
  open,
  onOpenChange,
  onActivityLogged,
}: PipelineDetailModalProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);
  const [packageBuilderOpen, setPackageBuilderOpen] = useState(false);
  const [hasPackage, setHasPackage] = useState(false);

  useEffect(() => {
    if (opportunity && open) {
      checkForPackage();
    }
  }, [opportunity, open]);

  const checkForPackage = async () => {
    if (!opportunity) return;
    const { data } = await supabase
      .from("application_packages")
      .select("id")
      .eq("match_id", opportunity.score_id)
      .maybeSingle();
    setHasPackage(!!data);
  };

  useEffect(() => {
    if (opportunity && open) {
      loadActivities();
    }
  }, [opportunity, open]);

  const loadActivities = async () => {
    if (!opportunity) return;
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("outreach_activities")
      .select("*")
      .eq("match_id", opportunity.score_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading activities:", error);
    } else {
      setActivities(data || []);
    }
    setLoading(false);
  };

  const logActivity = async (activityType: "email_sent" | "email_received" | "call" | "meeting" | "note" | "follow_up" | "social_interaction", subject?: string, body?: string, notes?: string) => {
    if (!opportunity) return;
    setSavingActivity(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in");
      setSavingActivity(false);
      return;
    }

    const { error } = await supabase.from("outreach_activities").insert({
      match_id: opportunity.score_id,
      speaker_id: session.user.id,
      activity_type: activityType,
      subject: subject || null,
      body: body || null,
      notes: notes || null,
      email_sent_at: activityType === "email_sent" ? new Date().toISOString() : null,
    });

    if (error) {
      console.error("Error logging activity:", error);
      toast.error("Failed to log activity");
    } else {
      toast.success("Activity logged");
      await loadActivities();
      onActivityLogged();
      setNoteText("");
    }
    setSavingActivity(false);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    logActivity("note", null, null, noteText);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500 text-white";
    if (score >= 60) return "bg-yellow-500 text-white";
    return "bg-red-400 text-white";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Not specified";
    return format(new Date(dateStr), "MMMM d, yyyy");
  };

  if (!opportunity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Badge className={`${getScoreColor(opportunity.ai_score)} shrink-0`}>
              {opportunity.ai_score}
            </Badge>
            <div className="flex-1">
              <DialogTitle className="text-lg">{opportunity.event_name}</DialogTitle>
              {opportunity.organizer_name && (
                <p className="text-sm text-muted-foreground mt-1">
                  {opportunity.organizer_name}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
            <TabsTrigger value="notes">Add Note</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="details" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Event Date</p>
                      <p className="font-medium">{formatDate(opportunity.event_date)}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Location</p>
                      <p className="font-medium">{opportunity.location || "Not specified"}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Fee Range</p>
                      <p className="font-medium">
                        {opportunity.fee_estimate_min && opportunity.fee_estimate_max
                          ? `$${opportunity.fee_estimate_min.toLocaleString()} - $${opportunity.fee_estimate_max.toLocaleString()}`
                          : "Not specified"}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Deadline</p>
                      <p className="font-medium">{formatDate(opportunity.deadline)}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {opportunity.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {opportunity.description}
                  </p>
                </div>
              )}

              {opportunity.ai_reason && (
                <div>
                  <h4 className="font-medium mb-2">Why This Matches You</h4>
                  <p className="text-sm text-muted-foreground">{opportunity.ai_reason}</p>
                </div>
              )}

              {/* Package Stats */}
              {hasPackage && (
                <PackageStats matchId={opportunity.score_id} eventName={opportunity.event_name} />
              )}

              <div className="flex gap-2">
                {opportunity.event_url && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(opportunity.event_url!, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Event
                  </Button>
                )}
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-700"
                  onClick={() => setPackageBuilderOpen(true)}
                >
                  <Package className="h-4 w-4 mr-2" />
                  {hasPackage ? "Send New Package" : "Send Application Package"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => logActivity("email_sent", "Outreach email")}
                  disabled={savingActivity}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Log Email Sent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => logActivity("call", "Phone call")}
                  disabled={savingActivity}
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Log Call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => logActivity("meeting", "Meeting")}
                  disabled={savingActivity}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Log Meeting
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No activities logged yet</p>
                  <p className="text-xs mt-1">Use the buttons above to track your outreach</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => {
                    const typeInfo = activityTypeLabels[activity.activity_type] || {
                      label: activity.activity_type,
                      icon: <FileText className="h-4 w-4" />,
                      color: "bg-gray-100 text-gray-700",
                    };

                    return (
                      <Card key={activity.id} className="p-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${typeInfo.color}`}>
                            {typeInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm">{typeInfo.label}</p>
                              <p className="text-xs text-muted-foreground shrink-0">
                                {formatDistanceToNow(new Date(activity.created_at), {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                            {activity.subject && (
                              <p className="text-sm text-muted-foreground">{activity.subject}</p>
                            )}
                            {activity.notes && (
                              <p className="text-sm mt-1 whitespace-pre-wrap">{activity.notes}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-4">
              <Textarea
                placeholder="Add a note about this opportunity..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
              />
              <Button
                onClick={handleAddNote}
                disabled={!noteText.trim() || savingActivity}
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                {savingActivity ? "Saving..." : "Add Note"}
              </Button>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>

      <PackageBuilderDialog
        opportunity={opportunity}
        open={packageBuilderOpen}
        onOpenChange={setPackageBuilderOpen}
        onPackageCreated={() => {
          checkForPackage();
          onActivityLogged();
        }}
      />
    </Dialog>
  );
}
