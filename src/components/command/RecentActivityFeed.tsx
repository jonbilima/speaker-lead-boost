import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Activity, Eye, UserPlus, Mail, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface ActivityEvent {
  id: string;
  type: "package_view" | "lead" | "email_opened" | "email_sent" | "application";
  title: string;
  subtitle: string;
  timestamp: string;
  link?: string;
}

interface RecentActivityFeedProps {
  userId: string;
}

export function RecentActivityFeed({ userId }: RecentActivityFeedProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem("command_activity_collapsed");
    return stored !== "true";
  });
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem("command_activity_collapsed", (!isOpen).toString());
  }, [isOpen]);

  useEffect(() => {
    loadActivities();
  }, [userId]);

  const loadActivities = async () => {
    try {
      const [packageViewsResult, leadsResult, outreachResult] = await Promise.all([
        // Package views
        supabase
          .from("package_views")
          .select(`
            id,
            timestamp,
            event_type,
            application_packages!inner (
              package_title,
              tracking_code,
              speaker_id
            )
          `)
          .eq("application_packages.speaker_id", userId)
          .eq("event_type", "view")
          .order("timestamp", { ascending: false })
          .limit(3),

        // Leads
        supabase
          .from("inbound_leads")
          .select("id, name, company, created_at")
          .eq("speaker_id", userId)
          .order("created_at", { ascending: false })
          .limit(3),

        // Outreach activities
        supabase
          .from("outreach_activities")
          .select("id, activity_type, subject, created_at, email_opened_at")
          .eq("speaker_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const activityItems: ActivityEvent[] = [];

      // Process package views
      if (!packageViewsResult.error && packageViewsResult.data) {
        packageViewsResult.data.forEach((view: any) => {
          activityItems.push({
            id: `pv-${view.id}`,
            type: "package_view",
            title: "Package viewed",
            subtitle: view.application_packages?.package_title || "Your package",
            timestamp: view.timestamp,
            link: `/p/${view.application_packages?.tracking_code}`,
          });
        });
      }

      // Process leads
      if (!leadsResult.error && leadsResult.data) {
        leadsResult.data.forEach((lead: any) => {
          activityItems.push({
            id: `lead-${lead.id}`,
            type: "lead",
            title: `New lead: ${lead.name}`,
            subtitle: lead.company || "Inbound inquiry",
            timestamp: lead.created_at,
            link: "/business",
          });
        });
      }

      // Process outreach
      if (!outreachResult.error && outreachResult.data) {
        outreachResult.data.forEach((activity: any) => {
          if (activity.email_opened_at) {
            activityItems.push({
              id: `open-${activity.id}`,
              type: "email_opened",
              title: "Email opened",
              subtitle: activity.subject || "Your pitch",
              timestamp: activity.email_opened_at,
            });
          }
          if (activity.activity_type === "email") {
            activityItems.push({
              id: `sent-${activity.id}`,
              type: "email_sent",
              title: "Email sent",
              subtitle: activity.subject || "Outreach email",
              timestamp: activity.created_at,
            });
          }
          if (activity.activity_type === "application") {
            activityItems.push({
              id: `app-${activity.id}`,
              type: "application",
              title: "Application submitted",
              subtitle: activity.subject || "New application",
              timestamp: activity.created_at,
            });
          }
        });
      }

      // Sort by timestamp and take top 5
      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(activityItems.slice(0, 5));
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "package_view":
        return <Eye className="h-4 w-4 text-blue-500" />;
      case "lead":
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case "email_opened":
        return <Mail className="h-4 w-4 text-primary" />;
      case "email_sent":
        return <Mail className="h-4 w-4 text-muted-foreground" />;
      case "application":
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Recent Activity
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
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => activity.link && navigate(activity.link)}
                  >
                    <div className="flex-shrink-0">
                      {getIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{activity.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {activity.subtitle}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
