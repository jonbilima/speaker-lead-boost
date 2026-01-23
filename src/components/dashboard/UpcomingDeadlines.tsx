import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle } from "lucide-react";

interface Deadline {
  id: string;
  event_name: string;
  deadline: string;
  daysRemaining: number;
}

interface UpcomingDeadlinesProps {
  deadlines: Deadline[];
  loading?: boolean;
}

export const UpcomingDeadlines = ({ deadlines, loading }: UpcomingDeadlinesProps) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Upcoming Deadlines
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
        <Clock className="h-5 w-5" />
        Upcoming Deadlines
      </h3>
      {deadlines.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No upcoming deadlines in the next 14 days
        </p>
      ) : (
        <div className="space-y-3">
          {deadlines.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.event_name}</p>
                <p className="text-sm text-muted-foreground">
                  Due {formatDate(item.deadline)}
                </p>
              </div>
              <Badge 
                variant={item.daysRemaining <= 3 ? "destructive" : "secondary"}
                className="ml-2 flex items-center gap-1"
              >
                {item.daysRemaining <= 3 && <AlertCircle className="h-3 w-3" />}
                {item.daysRemaining === 0 ? 'Today' : 
                 item.daysRemaining === 1 ? '1 day' : 
                 `${item.daysRemaining} days`}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
