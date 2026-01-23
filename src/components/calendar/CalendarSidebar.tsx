import { format, isSameDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Calendar,
  MapPin,
  Video,
  Clock,
  ExternalLink,
  Trash2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  CalendarEntry,
  CalendarLegend,
  UpcomingDeadline,
  getEntryTypeConfig,
} from "./CalendarTypes";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Google Calendar icon inline
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4Z" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="9" cy="14" r="1.5" fill="#4285F4"/>
    <circle cx="15" cy="14" r="1.5" fill="#34A853"/>
  </svg>
);

interface CalendarSidebarProps {
  selectedDate: Date;
  entries: CalendarEntry[];
  deadlines: UpcomingDeadline[];
  onAddEntry: () => void;
  onEntryDeleted: () => void;
}

export function CalendarSidebar({
  selectedDate,
  entries,
  deadlines,
  onAddEntry,
  onEntryDeleted,
}: CalendarSidebarProps) {
  const selectedDateEntries = entries.filter((entry) => {
    const startDate = new Date(entry.start_date);
    const endDate = entry.end_date ? new Date(entry.end_date) : startDate;
    return selectedDate >= startDate && selectedDate <= endDate;
  });

  const selectedDateDeadlines = deadlines.filter((d) =>
    isSameDay(selectedDate, new Date(d.deadline))
  );

  const upcomingDeadlines = deadlines
    .filter((d) => new Date(d.deadline) >= new Date())
    .slice(0, 5);

  const handleDeleteEntry = async (entryId: string) => {
    const { error } = await supabase
      .from("speaker_calendar")
      .delete()
      .eq("id", entryId);

    if (error) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry");
    } else {
      toast.success("Entry deleted");
      onEntryDeleted();
    }
  };

  return (
    <div className="w-80 flex flex-col gap-4">
      {/* Selected Day */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            {format(selectedDate, "EEEE, MMMM d")}
          </h3>
          <Button
            size="sm"
            onClick={onAddEntry}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {selectedDateEntries.length === 0 && selectedDateDeadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No entries for this day
          </p>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {/* Deadlines first */}
              {selectedDateDeadlines.map((deadline) => (
                <Card
                  key={`deadline-${deadline.id}`}
                  className="p-3 bg-red-50 border-red-200"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2">
                        📅 Application Deadline
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {deadline.event_name}
                      </p>
                      <Badge
                        className={cn(
                          "mt-1 text-[10px]",
                          deadline.ai_score >= 80
                            ? "bg-green-500"
                            : deadline.ai_score >= 60
                            ? "bg-yellow-500"
                            : "bg-red-400"
                        )}
                      >
                        Score: {deadline.ai_score}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Calendar entries */}
              {selectedDateEntries.map((entry) => {
                const typeConfig = getEntryTypeConfig(entry.entry_type);
                const isExternal = entry.entry_type === 'external' || entry.external_source === 'google';
                const isSynced = entry.google_calendar_id && entry.sync_status === 'synced';
                const hasSyncError = entry.sync_status === 'error';
                const isPending = entry.sync_status === 'pending' || entry.sync_status === 'local';

                return (
                  <Card key={entry.id} className={cn("p-3", isExternal && "opacity-75 border-dashed")}>
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          entry.color || typeConfig.color
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm line-clamp-2">
                              {entry.title}
                            </p>
                            {/* Sync status icons */}
                            {isExternal && (
                              <GoogleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            {isSynced && !isExternal && (
                              <RefreshCw className="h-3 w-3 text-green-500 shrink-0" />
                            )}
                            {hasSyncError && (
                              <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                            )}
                            {isPending && !isExternal && (
                              <RefreshCw className="h-3 w-3 text-muted-foreground animate-pulse shrink-0" />
                            )}
                          </div>
                          {!isExternal && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-500"
                              onClick={() => handleDeleteEntry(entry.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        <Badge
                          variant="secondary"
                          className={cn("text-[10px] mt-1", typeConfig.bgLight, typeConfig.textColor)}
                        >
                          {typeConfig.label}
                        </Badge>

                        {!entry.all_day && entry.start_time && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {entry.start_time}
                            {entry.end_time && ` - ${entry.end_time}`}
                          </div>
                        )}

                        {entry.is_virtual && entry.meeting_url && (
                          <a
                            href={entry.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
                          >
                            <Video className="h-3 w-3" />
                            Join Meeting
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {!entry.is_virtual && entry.location && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {entry.location}
                          </div>
                        )}

                        {entry.notes && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Upcoming Deadlines */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-red-500" />
          Upcoming Deadlines
        </h3>

        {upcomingDeadlines.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No upcoming deadlines
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingDeadlines.map((deadline) => (
              <div
                key={deadline.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate flex-1">{deadline.event_name}</span>
                <span className="text-muted-foreground shrink-0">
                  {format(new Date(deadline.deadline), "MMM d")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Legend */}
      <CalendarLegend />
    </div>
  );
}
