import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Mail, Phone, MessageSquare, Calendar, FileText, PenLine } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  activity_type: string;
  created_at: string;
  subject?: string | null;
  notes?: string | null;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  loading?: boolean;
}

const activityIcons: Record<string, typeof Mail> = {
  email_sent: Mail,
  pitch_drafted: PenLine,
  email_opened: Mail,
  email_replied: MessageSquare,
  phone_call: Phone,
  meeting: Calendar,
  proposal_sent: FileText,
  follow_up: Mail,
};

const activityLabels: Record<string, string> = {
  email_sent: "Email Sent",
  pitch_drafted: "Drafted — Not Sent",
  email_opened: "Email Opened",
  email_replied: "Reply Received",
  phone_call: "Phone Call",
  meeting: "Meeting",
  proposal_sent: "Proposal Sent",
  follow_up: "Follow-up",
};

export const RecentActivity = ({ activities, loading }: RecentActivityProps) => {
  if (loading) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5" />
        Recent Activity
      </h3>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No recent activity yet. Start reaching out to organizers!
        </p>
      ) : (
        <div className="space-y-3">
          {activities.map((item) => {
            const Icon = activityIcons[item.activity_type] || Activity;
            const label = activityLabels[item.activity_type] || item.activity_type;
            const isDraft = item.activity_type === "pitch_drafted";

            return (
              <div 
                key={item.id} 
                className="flex items-start gap-3 p-3 rounded-lg border bg-card"
              >
                <div className={`p-2 rounded-full ${isDraft ? "bg-amber-500/10" : "bg-primary/10"}`}>
                  <Icon className={`h-4 w-4 ${isDraft ? "text-amber-600 dark:text-amber-500" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isDraft ? "secondary" : "outline"}
                      className={`text-xs ${isDraft ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : ""}`}
                    >
                      {label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {item.subject && (
                    <p className="text-sm mt-1 truncate">{item.subject}</p>
                  )}
                  {isDraft && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Drafted only — not emailed to the organizer
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
