import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, Mail, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";

interface FollowUpIndicatorProps {
  matchId: string;
  pipelineStage: string;
  onSendFollowUp?: () => void;
  compact?: boolean;
}

interface FollowUpReminder {
  id: string;
  due_date: string;
  reminder_type: string;
  is_completed: boolean;
}

export function FollowUpIndicator({
  matchId,
  pipelineStage,
  onSendFollowUp,
  compact = false,
}: FollowUpIndicatorProps) {
  const [nextReminder, setNextReminder] = useState<FollowUpReminder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNextReminder = async () => {
      if (pipelineStage !== "pitched") {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("follow_up_reminders")
        .select("id, due_date, reminder_type, is_completed")
        .eq("match_id", matchId)
        .eq("is_completed", false)
        .order("due_date", { ascending: true })
        .limit(1);

      if (!error && data && data.length > 0) {
        setNextReminder(data[0]);
      }
      setLoading(false);
    };

    loadNextReminder();
  }, [matchId, pipelineStage]);

  if (loading || !nextReminder || pipelineStage !== "pitched") {
    return null;
  }

  const dueDate = new Date(nextReminder.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const daysUntilDue = differenceInDays(dueDate, today);

  let status: "on_track" | "due_soon" | "overdue" = "on_track";
  let statusColor = "text-green-600 bg-green-50 border-green-200";
  let statusText = `Follow-up in ${daysUntilDue} days`;

  if (daysUntilDue < 0) {
    status = "overdue";
    statusColor = "text-red-600 bg-red-50 border-red-200";
    statusText = `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? "s" : ""}`;
  } else if (daysUntilDue <= 2) {
    status = "due_soon";
    statusColor = "text-yellow-600 bg-yellow-50 border-yellow-200";
    statusText = daysUntilDue === 0 ? "Due today" : daysUntilDue === 1 ? "Due tomorrow" : `Due in ${daysUntilDue} days`;
  }

  const reminderLabel =
    nextReminder.reminder_type === "first"
      ? "1st"
      : nextReminder.reminder_type === "second"
      ? "2nd"
      : "Final";

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${statusColor} cursor-default text-xs px-1.5`}
          >
            <Clock className="h-3 w-3 mr-1" />
            {reminderLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusText}</p>
          <p className="text-xs text-muted-foreground">
            Due: {format(dueDate, "MMM d, yyyy")}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`${statusColor} text-xs`}>
        <Clock className="h-3 w-3 mr-1" />
        {statusText}
      </Badge>
      {onSendFollowUp && (status === "overdue" || status === "due_soon") && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onSendFollowUp();
          }}
        >
          <Mail className="h-3 w-3 mr-1" />
          Send
        </Button>
      )}
    </div>
  );
}

export async function markFollowUpComplete(reminderId: string) {
  const { error } = await supabase
    .from("follow_up_reminders")
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq("id", reminderId);

  return !error;
}
