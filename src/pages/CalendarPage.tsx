import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { AddCalendarEntryDialog } from "@/components/calendar/AddCalendarEntryDialog";
import { GoogleCalendarConnect } from "@/components/calendar/GoogleCalendarConnect";
import { CalendarEntry, UpcomingDeadline } from "@/components/calendar/CalendarTypes";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";

const CalendarPage = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [deadlines, setDeadlines] = useState<UpcomingDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLoading(true);

    // Get date range for current view (include prev/next month for calendar edges)
    const rangeStart = subMonths(startOfMonth(currentMonth), 1);
    const rangeEnd = addMonths(endOfMonth(currentMonth), 1);

    // Load calendar entries
    const { data: entriesData, error: entriesError } = await supabase
      .from("speaker_calendar")
      .select("*")
      .eq("speaker_id", session.user.id)
      .gte("start_date", rangeStart.toISOString().split("T")[0])
      .lte("start_date", rangeEnd.toISOString().split("T")[0])
      .order("start_date", { ascending: true });

    if (entriesError) {
      console.error("Error loading entries:", entriesError);
    } else {
      setEntries(entriesData || []);
    }

    // Load deadlines from opportunity_scores + opportunities
    const { data: scoresData, error: scoresError } = await supabase
      .from("opportunity_scores")
      .select(`
        id,
        ai_score,
        opportunities (
          id,
          event_name,
          deadline
        )
      `)
      .eq("user_id", session.user.id)
      .not("opportunities.deadline", "is", null);

    if (scoresError) {
      console.error("Error loading deadlines:", scoresError);
    } else {
      interface ScoreWithOpportunity {
        id: string;
        ai_score: number | null;
        opportunities: { id: string; event_name: string; deadline: string } | null;
      }
      const formattedDeadlines: UpcomingDeadline[] = (scoresData as ScoreWithOpportunity[] || [])
        .filter((s) => s.opportunities?.deadline)
        .map((s) => ({
          id: s.id,
          event_name: s.opportunities!.event_name,
          deadline: s.opportunities!.deadline,
          ai_score: s.ai_score || 0,
        }));
      setDeadlines(formattedDeadlines);
    }

    setLoading(false);
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="h-6 w-6 text-violet-600" />
              Speaking Calendar
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your speaking engagements, deadlines, and availability
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Calendar Settings</SheetTitle>
                  <SheetDescription>
                    Connect external calendars and manage sync settings
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <GoogleCalendarConnect onSyncComplete={loadData} />
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Main Calendar Grid */}
          <div className="flex-1">
            <CalendarGrid
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              entries={entries}
              deadlines={deadlines}
            />
          </div>

          {/* Sidebar */}
          <CalendarSidebar
            selectedDate={selectedDate}
            entries={entries}
            deadlines={deadlines}
            onAddEntry={() => setAddDialogOpen(true)}
            onEntryDeleted={loadData}
          />
        </div>
      </div>

      <AddCalendarEntryDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        selectedDate={selectedDate}
        onEntryAdded={loadData}
      />
    </AppLayout>
  );
};

export default CalendarPage;
