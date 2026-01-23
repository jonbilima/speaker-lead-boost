import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, MapPin, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface CalendarEntry {
  id: string;
  title: string;
  start_date: string;
  start_time?: string | null;
  location?: string | null;
  is_virtual?: boolean;
  entry_type: string;
}

interface CalendarWidgetProps {
  entries: CalendarEntry[];
  loading?: boolean;
}

const entryTypeColors: Record<string, string> = {
  speaking_engagement: "bg-violet-500",
  conference: "bg-blue-500",
  meeting: "bg-green-500",
  travel: "bg-orange-500",
  preparation: "bg-yellow-500",
  deadline: "bg-red-500",
};

export const CalendarWidget = ({ entries, loading }: CalendarWidgetProps) => {
  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Your Calendar
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Your Calendar
        </h3>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/calendar" className="flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No upcoming events scheduled
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div 
              key={entry.id} 
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div 
                className={`w-1 h-full min-h-[40px] rounded-full ${entryTypeColors[entry.entry_type] || 'bg-muted'}`} 
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{entry.title}</p>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{format(new Date(entry.start_date), 'MMM d')}</span>
                  {entry.start_time && (
                    <span>at {entry.start_time.slice(0, 5)}</span>
                  )}
                </div>
                {(entry.location || entry.is_virtual) && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    {entry.is_virtual ? (
                      <>
                        <Video className="h-3 w-3" />
                        <span>Virtual</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{entry.location}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
