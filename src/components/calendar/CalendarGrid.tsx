import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarEntry, CalendarEntryPill, UpcomingDeadline } from "./CalendarTypes";

interface CalendarGridProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  entries: CalendarEntry[];
  deadlines: UpcomingDeadline[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
  currentMonth,
  onMonthChange,
  selectedDate,
  onDateSelect,
  entries,
  deadlines,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEntriesForDay = (day: Date) => {
    const dayEntries: Array<CalendarEntry | { id: string; title: string; entry_type: string }> = [];

    // Add calendar entries
    entries.forEach((entry) => {
      const startDate = new Date(entry.start_date);
      const endDate = entry.end_date ? new Date(entry.end_date) : startDate;
      
      if (day >= startDate && day <= endDate) {
        dayEntries.push(entry);
      }
    });

    // Add deadlines
    deadlines.forEach((deadline) => {
      const deadlineDate = new Date(deadline.deadline);
      if (isSameDay(day, deadlineDate)) {
        dayEntries.push({
          id: `deadline-${deadline.id}`,
          title: `📅 ${deadline.event_name}`,
          entry_type: "deadline",
        });
      }
    });

    return dayEntries;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-t-lg overflow-hidden">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-border flex-1 rounded-b-lg overflow-hidden">
        {days.map((day) => {
          const dayEntries = getEntriesForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const displayEntries = dayEntries.slice(0, 3);
          const moreCount = dayEntries.length - 3;

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "bg-background min-h-[100px] p-1 cursor-pointer transition-colors hover:bg-muted/50",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                isSelected && "bg-violet-50"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1",
                  isTodayDate && "border-2 border-violet-500 text-violet-600",
                  isSelected && !isTodayDate && "bg-violet-100 text-violet-700"
                )}
              >
                {format(day, "d")}
              </div>

              <div className="space-y-0.5">
                {displayEntries.map((entry, idx) => (
                  <CalendarEntryPill key={entry.id || idx} entry={entry} compact />
                ))}
                {moreCount > 0 && (
                  <div className="text-[10px] text-muted-foreground pl-1">
                    +{moreCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
