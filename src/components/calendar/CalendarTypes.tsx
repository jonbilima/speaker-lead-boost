import { format, isSameDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CalendarEntry {
  id: string;
  title: string;
  entry_type: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  is_virtual: boolean;
  meeting_url: string | null;
  notes: string | null;
  color: string | null;
  event_id: string | null;
  match_id: string | null;
  google_calendar_id?: string | null;
  sync_status?: string | null;
  external_source?: string | null;
}

export interface UpcomingDeadline {
  id: string;
  event_name: string;
  deadline: string;
  ai_score: number;
}

export const ENTRY_TYPES = [
  { id: "speaking_engagement", label: "Speaking Event", color: "bg-violet-500", textColor: "text-violet-700", bgLight: "bg-violet-100" },
  { id: "deadline", label: "Application Deadline", color: "bg-red-500", textColor: "text-red-700", bgLight: "bg-red-100" },
  { id: "travel", label: "Travel Day", color: "bg-blue-500", textColor: "text-blue-700", bgLight: "bg-blue-100" },
  { id: "blocked", label: "Blocked/Unavailable", color: "bg-gray-500", textColor: "text-gray-700", bgLight: "bg-gray-100" },
  { id: "follow_up", label: "Follow-up Task", color: "bg-yellow-500", textColor: "text-yellow-700", bgLight: "bg-yellow-100" },
  { id: "confirmed", label: "Confirmed Booking", color: "bg-green-500", textColor: "text-green-700", bgLight: "bg-green-100" },
  { id: "external", label: "Google Calendar", color: "bg-slate-400", textColor: "text-slate-600", bgLight: "bg-slate-100" },
] as const;

export function getEntryTypeConfig(entryType: string) {
  return ENTRY_TYPES.find(t => t.id === entryType) || ENTRY_TYPES[0];
}

interface CalendarEntryPillProps {
  entry: CalendarEntry | { title: string; entry_type: string };
  compact?: boolean;
}

export function CalendarEntryPill({ entry, compact = false }: CalendarEntryPillProps) {
  const config = getEntryTypeConfig(entry.entry_type);
  
  return (
    <div
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium truncate",
        config.color,
        "text-white",
        compact ? "text-[10px]" : ""
      )}
      title={entry.title}
    >
      {entry.title}
    </div>
  );
}

interface CalendarLegendProps {
  className?: string;
}

export function CalendarLegend({ className }: CalendarLegendProps) {
  return (
    <Card className={cn("p-4", className)}>
      <h3 className="font-medium text-sm mb-3">Legend</h3>
      <div className="space-y-2">
        {ENTRY_TYPES.map(type => (
          <div key={type.id} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded", type.color)} />
            <span className="text-xs text-muted-foreground">{type.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
