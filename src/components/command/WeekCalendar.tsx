import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Calendar, Clock, MapPin, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isSameDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  start_time: string | null;
  entry_type: string;
  location: string | null;
  is_virtual: boolean;
}

interface WeekCalendarProps {
  userId: string;
}

const entryTypeColors: Record<string, string> = {
  speaking_engagement: "bg-primary text-primary-foreground",
  deadline: "bg-destructive text-destructive-foreground",
  meeting: "bg-blue-500 text-white",
  call: "bg-green-500 text-white",
  travel: "bg-orange-500 text-white",
  follow_up: "bg-yellow-500 text-yellow-foreground",
  other: "bg-muted text-muted-foreground",
};

export function WeekCalendar({ userId }: WeekCalendarProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem("command_calendar_collapsed");
    return stored !== "true";
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem("command_calendar_collapsed", (!isOpen).toString());
  }, [isOpen]);

  useEffect(() => {
    loadEvents();
  }, [userId]);

  const loadEvents = async () => {
    try {
      const today = startOfDay(new Date());
      const weekEnd = addDays(today, 7);

      const { data, error } = await supabase
        .from("speaker_calendar")
        .select("id, title, start_date, start_time, entry_type, location, is_virtual")
        .eq("speaker_id", userId)
        .gte("start_date", today.toISOString().split("T")[0])
        .lte("start_date", weekEnd.toISOString().split("T")[0])
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error loading calendar events:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDays = () => {
    const days = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 7; i++) {
      days.push(addDays(today, i));
    }
    return days;
  };

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventDate = startOfDay(new Date(event.start_date));
      return isSameDay(eventDate, date);
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const days = getDays();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                This Week
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
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="space-y-2">
                {days.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex gap-3 p-2 rounded-lg",
                        isToday && "bg-primary/5 border border-primary/20"
                      )}
                    >
                      <div className="w-12 flex-shrink-0 text-center">
                        <div className="text-xs text-muted-foreground uppercase">
                          {format(day, "EEE")}
                        </div>
                        <div
                          className={cn(
                            "text-lg font-semibold",
                            isToday && "text-primary"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        {dayEvents.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-2">
                            No events
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {dayEvents.map((event) => (
                              <div
                                key={event.id}
                                className={cn(
                                  "flex items-center gap-2 text-sm p-2 rounded",
                                  entryTypeColors[event.entry_type] || entryTypeColors.other
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">
                                    {event.title}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs opacity-90">
                                    {event.start_time && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatTime(event.start_time)}
                                      </span>
                                    )}
                                    {event.is_virtual ? (
                                      <span className="flex items-center gap-1">
                                        <Video className="h-3 w-3" />
                                        Virtual
                                      </span>
                                    ) : event.location ? (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {event.location}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
