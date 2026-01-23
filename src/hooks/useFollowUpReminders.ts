import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FollowUpReminder {
  id: string;
  match_id: string;
  reminder_type: "first" | "second" | "final";
  due_date: string;
  is_completed: boolean;
  event_name: string;
  organizer_name: string | null;
  opportunity_id: string;
}

export function useFollowUpReminders(userId: string | null) {
  const [reminders, setReminders] = useState<FollowUpReminder[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadReminders = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("follow_up_reminders")
        .select(`
          id,
          match_id,
          reminder_type,
          due_date,
          is_completed,
          opportunity_scores!inner (
            id,
            opportunities (
              id,
              event_name,
              organizer_name
            )
          )
        `)
        .eq("speaker_id", userId)
        .eq("is_completed", false)
        .order("due_date", { ascending: true });

      if (error) throw error;

      const formattedReminders: FollowUpReminder[] = (data || []).map((r: any) => ({
        id: r.id,
        match_id: r.match_id,
        reminder_type: r.reminder_type,
        due_date: r.due_date,
        is_completed: r.is_completed,
        event_name: r.opportunity_scores?.opportunities?.event_name || "Unknown Event",
        organizer_name: r.opportunity_scores?.opportunities?.organizer_name || null,
        opportunity_id: r.opportunity_scores?.opportunities?.id || "",
      }));

      setReminders(formattedReminders);

      // Calculate overdue count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdueReminders = formattedReminders.filter((r) => {
        const dueDate = new Date(r.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
      });
      setOverdueCount(overdueReminders.length);
    } catch (error) {
      console.error("Error loading follow-up reminders:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  return { reminders, overdueCount, loading, refresh: loadReminders };
}

export async function createFollowUpReminders(
  userId: string,
  matchId: string,
  appliedAt: Date,
  intervals: { interval1: number; interval2: number; interval3: number } = {
    interval1: 7,
    interval2: 14,
    interval3: 21,
  }
) {
  const reminders = [
    {
      speaker_id: userId,
      match_id: matchId,
      reminder_type: "first",
      due_date: new Date(appliedAt.getTime() + intervals.interval1 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    },
    {
      speaker_id: userId,
      match_id: matchId,
      reminder_type: "second",
      due_date: new Date(appliedAt.getTime() + intervals.interval2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    },
    {
      speaker_id: userId,
      match_id: matchId,
      reminder_type: "final",
      due_date: new Date(appliedAt.getTime() + intervals.interval3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    },
  ];

  const { error } = await supabase.from("follow_up_reminders").insert(reminders);

  if (error) {
    console.error("Error creating follow-up reminders:", error);
    throw error;
  }

  return reminders;
}

export async function getUserFollowUpIntervals(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("follow_up_interval_1, follow_up_interval_2, follow_up_interval_3")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return { interval1: 7, interval2: 14, interval3: 21 };
  }

  return {
    interval1: data.follow_up_interval_1 || 7,
    interval2: data.follow_up_interval_2 || 14,
    interval3: data.follow_up_interval_3 || 21,
  };
}
