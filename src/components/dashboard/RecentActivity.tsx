import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Mail, Phone, MessageSquare, Calendar, FileText } from "lucide-react";
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
  email_opened: Mail,
  email_replied: MessageSquare,
  phone_call: Phone,
  meeting: Calendar,
  proposal_sent: FileText,
  follow_up: Mail,
};

const activityLabels: Record<string, string> = {
  email_sent: "Email Sent",
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
            
            return (
              <div 
                key={item.id} 
                className="flex items-start gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="p-2 rounded-full bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {item.subject && (
                    <p className="text-sm mt-1 truncate">{item.subject}</p>
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
