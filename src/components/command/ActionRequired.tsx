import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  Mail,
  DollarSign,
  UserPlus,
  Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { addDays } from "date-fns";
import { FollowUpEmailDialog } from "@/components/dashboard/FollowUpEmailDialog";

interface ActionItem {
  id: string;
  type: "follow_up" | "deadline" | "invoice" | "lead";
  title: string;
  subtitle: string;
  urgency: "high" | "medium" | "low";
  dueDate?: string;
  metadata?: any;
}

interface ActionRequiredProps {
  userId: string;
  onRefresh?: () => void;
}

export function ActionRequired({ userId, onRefresh }: ActionRequiredProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem("command_action_collapsed");
    return stored !== "true";
  });
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<{
    opportunityId: string;
    reminderId: string;
    reminderType: string;
    matchId: string;
    organizerEmail?: string | null;
    organizerName?: string | null;
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem("command_action_collapsed", (!isOpen).toString());
  }, [isOpen]);

  useEffect(() => {
    loadActions();
  }, [userId]);

  const loadActions = async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const weekLater = addDays(today, 7).toISOString();

      // Load follow-ups without the problematic join
      const { data: followUpsRaw, error: followUpsError } = await supabase
        .from("follow_up_reminders")
        .select("id, reminder_type, due_date, match_id")
        .eq("speaker_id", userId)
        .eq("is_completed", false)
        .lte("due_date", todayStr)
        .order("due_date", { ascending: true })
        .limit(5);

      // Get opportunity details separately if we have follow-ups
      let followUpsWithDetails: any[] = [];
      if (!followUpsError && followUpsRaw && followUpsRaw.length > 0) {
        const matchIds = [...new Set(followUpsRaw.map(f => f.match_id))];
        const { data: scoresData } = await supabase
          .from("opportunity_scores")
          .select(`
            id,
            opportunity_id,
            opportunities (
              id,
              event_name,
              organizer_name,
              organizer_email
            )
          `)
          .in("id", matchIds);
        
        const scoreMap = new Map((scoresData || []).map((s: any) => [s.id, s]));
        followUpsWithDetails = followUpsRaw.map(f => ({
          ...f,
          opportunity_scores: scoreMap.get(f.match_id)
        }));
      }

      const [deadlinesResult, leadsResult] = await Promise.all([

        // Upcoming deadlines (within 7 days)
        supabase
          .from("opportunity_scores")
          .select(`
            id,
            opportunity_id,
            opportunities!inner (
              id,
              event_name,
              deadline,
              organizer_name
            )
          `)
          .eq("user_id", userId)
          .not("pipeline_stage", "in", '("accepted","rejected","completed")')
          .lte("opportunities.deadline", weekLater)
          .gte("opportunities.deadline", today.toISOString())
          .order("opportunities(deadline)", { ascending: true })
          .limit(5),

        // New leads
        supabase
          .from("inbound_leads")
          .select("id, name, company, event_name, created_at")
          .eq("speaker_id", userId)
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const items: ActionItem[] = [];

      // Process follow-ups
      if (followUpsWithDetails.length > 0) {
        followUpsWithDetails.forEach((fu: any) => {
          const opportunity = fu.opportunity_scores?.opportunities;
          const eventName = opportunity?.event_name || "Unknown Event";
          items.push({
            id: fu.id,
            type: "follow_up",
            title: `Follow-up: ${eventName}`,
            subtitle: `${fu.reminder_type} follow-up overdue`,
            urgency: "high",
            dueDate: fu.due_date,
            metadata: {
              matchId: fu.match_id,
              opportunityId: fu.opportunity_scores?.opportunity_id,
              reminderType: fu.reminder_type,
              organizerName: opportunity?.organizer_name,
              organizerEmail: opportunity?.organizer_email,
            },
          });
        });
      }

      // Process deadlines
      if (!deadlinesResult.error && deadlinesResult.data) {
        deadlinesResult.data.forEach((d: any) => {
          const deadline = new Date(d.opportunities.deadline);
          const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          items.push({
            id: d.opportunity_id,
            type: "deadline",
            title: d.opportunities.event_name,
            subtitle: daysRemaining <= 0 ? "Deadline today!" : `Deadline in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}`,
            urgency: daysRemaining <= 3 ? "high" : "medium",
            dueDate: d.opportunities.deadline,
            metadata: { opportunityId: d.opportunity_id },
          });
        });
      }

      // Process leads
      if (!leadsResult.error && leadsResult.data) {
        leadsResult.data.forEach((lead: any) => {
          items.push({
            id: lead.id,
            type: "lead",
            title: `New lead: ${lead.name}`,
            subtitle: lead.company || lead.event_name || "Inbound inquiry",
            urgency: "low",
            metadata: { leadId: lead.id },
          });
        });
      }

      // Sort by urgency
      items.sort((a, b) => {
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });

      setActions(items.slice(0, 5));
    } catch (error) {
      console.error("Error loading actions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUpComplete = async (id: string) => {
    const { error } = await supabase
      .from("follow_up_reminders")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to mark as done");
    } else {
      toast.success("Marked as done");
      loadActions();
      onRefresh?.();
    }
  };

  const handleFollowUpSnooze = async (id: string, currentDueDate: string) => {
    const newDate = addDays(new Date(currentDueDate), 3).toISOString().split("T")[0];
    const { error } = await supabase
      .from("follow_up_reminders")
      .update({ due_date: newDate })
      .eq("id", id);

    if (error) {
      toast.error("Failed to snooze");
    } else {
      toast.success("Snoozed for 3 days");
      loadActions();
      onRefresh?.();
    }
  };

  const handleOpenEmailDialog = (action: ActionItem) => {
    setSelectedFollowUp({
      opportunityId: action.metadata.opportunityId,
      reminderId: action.id,
      reminderType: action.metadata.reminderType,
      matchId: action.metadata.matchId,
      organizerEmail: action.metadata.organizerEmail,
      organizerName: action.metadata.organizerName,
    });
    setEmailDialogOpen(true);
  };

  const getIcon = (type: ActionItem["type"]) => {
    switch (type) {
      case "follow_up":
        return <Mail className="h-4 w-4" />;
      case "deadline":
        return <Clock className="h-4 w-4" />;
      case "invoice":
        return <DollarSign className="h-4 w-4" />;
      case "lead":
        return <UserPlus className="h-4 w-4" />;
    }
  };

  const getUrgencyColor = (urgency: ActionItem["urgency"]) => {
    switch (urgency) {
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "medium":
        return "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-400";
      case "low":
        return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400";
    }
  };

  const totalActions = actions.length;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-destructive/20 bg-gradient-to-r from-destructive/5 to-transparent">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Action Required
                  {totalActions > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {totalActions}
                    </Badge>
                  )}
                </CardTitle>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : actions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>All caught up! No urgent actions needed.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${getUrgencyColor(action.urgency)}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">{getIcon(action.type)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{action.title}</div>
                          <div className="text-sm opacity-80 truncate">{action.subtitle}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {action.type === "follow_up" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleOpenEmailDialog(action)}
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleFollowUpComplete(action.id)}
                            >
                              Done
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFollowUpSnooze(action.id, action.dueDate!)}
                            >
                              +3 Days
                            </Button>
                          </>
                        )}
                        {action.type === "deadline" && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate("/pipeline")}
                            >
                              View
                            </Button>
                          </>
                        )}
                        {action.type === "lead" && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate("/business")}
                            >
                              View
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {totalActions >= 5 && (
                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground"
                      onClick={() => navigate("/pipeline")}
                    >
                      View all items
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {selectedFollowUp && (
        <FollowUpEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          opportunityId={selectedFollowUp.opportunityId}
          reminderId={selectedFollowUp.reminderId}
          reminderType={selectedFollowUp.reminderType}
          matchId={selectedFollowUp.matchId}
          organizerEmail={selectedFollowUp.organizerEmail}
          organizerName={selectedFollowUp.organizerName}
          onFollowUpSent={() => {
            loadActions();
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}
