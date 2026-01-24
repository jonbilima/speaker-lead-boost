import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Clock, Mail, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays, addDays } from "date-fns";

interface FollowUpReminder {
  id: string;
  match_id: string;
  reminder_type: "first" | "second" | "final";
  due_date: string;
  is_completed: boolean;
  event_name: string;
  organizer_name: string | null;
  organizer_email?: string | null;
  opportunity_id: string;
}

interface FollowUpsDueProps {
  reminders: FollowUpReminder[];
  onUpdate: () => void;
  onGenerateFollowUp: (
    opportunityId: string,
    reminderType: string,
    reminderId: string,
    matchId: string,
    organizerEmail?: string | null,
    organizerName?: string | null
  ) => void;
}

const reminderLabels: Record<string, { label: string; number: number }> = {
  first: { label: "1st Follow-up", number: 1 },
  second: { label: "2nd Follow-up", number: 2 },
  final: { label: "Final Follow-up", number: 3 },
};

export function FollowUpsDue({ reminders, onUpdate, onGenerateFollowUp }: FollowUpsDueProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const categorizeReminders = () => {
    const overdue: FollowUpReminder[] = [];
    const dueToday: FollowUpReminder[] = [];
    const upcoming: FollowUpReminder[] = [];

    reminders.forEach((reminder) => {
      const dueDate = new Date(reminder.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = differenceInDays(dueDate, today);

      if (diffDays < 0) {
        overdue.push(reminder);
      } else if (diffDays === 0) {
        dueToday.push(reminder);
      } else if (diffDays <= 7) {
        upcoming.push(reminder);
      }
    });

    return { overdue, dueToday, upcoming };
  };

  const { overdue, dueToday, upcoming } = categorizeReminders();

  const handleMarkComplete = async (reminderId: string) => {
    setActionLoading(reminderId);
    try {
      const { error } = await supabase
        .from("follow_up_reminders")
        .update({ 
          is_completed: true, 
          completed_at: new Date().toISOString() 
        })
        .eq("id", reminderId);

      if (error) throw error;
      toast.success("Follow-up marked as complete");
      onUpdate();
    } catch (error) {
      console.error("Error marking complete:", error);
      toast.error("Failed to update reminder");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSnooze = async (reminderId: string, currentDueDate: string) => {
    setActionLoading(reminderId);
    try {
      const newDueDate = addDays(new Date(currentDueDate), 3);
      const { error } = await supabase
        .from("follow_up_reminders")
        .update({ due_date: newDueDate.toISOString().split("T")[0] })
        .eq("id", reminderId);

      if (error) throw error;
      toast.success("Snoozed for 3 days");
      onUpdate();
    } catch (error) {
      console.error("Error snoozing:", error);
      toast.error("Failed to snooze reminder");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSkip = async (reminderId: string) => {
    setActionLoading(reminderId);
    try {
      const { error } = await supabase
        .from("follow_up_reminders")
        .update({ 
          is_completed: true, 
          completed_at: new Date().toISOString() 
        })
        .eq("id", reminderId);

      if (error) throw error;
      toast.success("Follow-up skipped");
      onUpdate();
    } catch (error) {
      console.error("Error skipping:", error);
      toast.error("Failed to skip reminder");
    } finally {
      setActionLoading(null);
    }
  };

  const renderReminderItem = (reminder: FollowUpReminder, status: "overdue" | "today" | "upcoming") => {
    const dueDate = new Date(reminder.due_date);
    const diffDays = differenceInDays(dueDate, today);
    const isLoading = actionLoading === reminder.id;

    return (
      <div
        key={reminder.id}
        className="p-3 border rounded-lg space-y-2 bg-card"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{reminder.event_name}</span>
              <Badge
                variant={status === "overdue" ? "destructive" : status === "today" ? "default" : "secondary"}
                className={status === "today" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
              >
                {reminderLabels[reminder.reminder_type].label}
              </Badge>
            </div>
            {reminder.organizer_name && (
              <p className="text-sm text-muted-foreground truncate">
                {reminder.organizer_name}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {status === "overdue" ? (
                <span className="text-destructive font-medium">
                  {Math.abs(diffDays)} day{Math.abs(diffDays) !== 1 ? "s" : ""} overdue
                </span>
              ) : status === "today" ? (
                <span className="text-yellow-600 font-medium">Due today</span>
              ) : (
                <span>Due in {diffDays} day{diffDays !== 1 ? "s" : ""}</span>
              )}
              {" · "}
              {format(dueDate, "MMM d")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleMarkComplete(reminder.id)}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onGenerateFollowUp(
                reminder.opportunity_id,
                reminder.reminder_type,
                reminder.id,
                reminder.match_id,
                reminder.organizer_email,
                reminder.organizer_name
              )
            }
            disabled={isLoading}
            className="h-7 text-xs"
          >
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleSnooze(reminder.id, reminder.due_date)}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            <Clock className="h-3 w-3 mr-1" />
            +3 days
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleSkip(reminder.id)}
            disabled={isLoading}
            className="h-7 text-xs text-muted-foreground"
          >
            <SkipForward className="h-3 w-3 mr-1" />
            Skip
          </Button>
        </div>
      </div>
    );
  };

  const totalCount = overdue.length + dueToday.length + upcoming.length;

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Follow-ups Due
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No follow-ups due. You're all caught up! 🎉
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Follow-ups Due
          {overdue.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {overdue.length} overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {overdue.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-destructive uppercase tracking-wider">
              Overdue
            </h4>
            {overdue.map((r) => renderReminderItem(r, "overdue"))}
          </div>
        )}

        {dueToday.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-yellow-600 uppercase tracking-wider">
              Due Today
            </h4>
            {dueToday.map((r) => renderReminderItem(r, "today"))}
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              This Week
            </h4>
            {upcoming.map((r) => renderReminderItem(r, "upcoming"))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
