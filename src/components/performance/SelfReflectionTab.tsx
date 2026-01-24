import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Brain, Save, Calendar, Zap, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Booking {
  id: string;
  event_name: string;
  event_date: string | null;
}

interface Metrics {
  id?: string;
  booking_id: string;
  audience_size_actual: number | null;
  engagement_score: number | null;
  standing_ovation: boolean;
  qa_questions_count: number | null;
  energy_level: number | null;
  audience_responsiveness: number | null;
  what_went_well: string;
  what_to_improve: string;
  notes_for_next_time: string;
  personal_learnings: string;
}

export function SelfReflectionTab() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    if (selectedBookingId) {
      fetchMetrics(selectedBookingId);
    }
  }, [selectedBookingId]);

  const fetchBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("confirmed_bookings")
        .select("id, event_name, event_date")
        .eq("speaker_id", user.id)
        .order("event_date", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
      
      if (data && data.length > 0) {
        setSelectedBookingId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async (bookingId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("performance_metrics")
        .select("*")
        .eq("booking_id", bookingId)
        .eq("speaker_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setMetrics(data);
      } else {
        // Initialize empty metrics
        setMetrics({
          booking_id: bookingId,
          audience_size_actual: null,
          engagement_score: null,
          standing_ovation: false,
          qa_questions_count: null,
          energy_level: null,
          audience_responsiveness: null,
          what_went_well: "",
          what_to_improve: "",
          notes_for_next_time: "",
          personal_learnings: "",
        });
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  const saveMetrics = async () => {
    if (!metrics || !selectedBookingId) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        speaker_id: user.id,
        booking_id: selectedBookingId,
        audience_size_actual: metrics.audience_size_actual,
        engagement_score: metrics.engagement_score,
        standing_ovation: metrics.standing_ovation,
        qa_questions_count: metrics.qa_questions_count,
        energy_level: metrics.energy_level,
        audience_responsiveness: metrics.audience_responsiveness,
        what_went_well: metrics.what_went_well,
        what_to_improve: metrics.what_to_improve,
        notes_for_next_time: metrics.notes_for_next_time,
        personal_learnings: metrics.personal_learnings,
      };

      if (metrics.id) {
        const { error } = await supabase
          .from("performance_metrics")
          .update(payload)
          .eq("id", metrics.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("performance_metrics")
          .insert(payload);

        if (error) throw error;
      }

      toast({ title: "Reflection saved!" });
      fetchMetrics(selectedBookingId);
    } catch (error) {
      console.error("Error saving metrics:", error);
      toast({ title: "Error saving reflection", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateMetrics = <K extends keyof Metrics>(field: K, value: Metrics[K]) => {
    if (metrics) {
      setMetrics({ ...metrics, [field]: value });
    }
  };

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  const ScoreSelector = ({
    label,
    value,
    onChange,
    max,
    icon,
  }: {
    label: string;
    value: number | null;
    onChange: (v: number) => void;
    max: number;
    icon: React.ReactNode;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              value === num
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Brain className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No events to reflect on</h3>
          <p className="text-muted-foreground text-center">
            Complete a booking to start recording your reflections
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Self-Reflection</h2>
          <p className="text-muted-foreground">
            Record your personal reflections after each event
          </p>
        </div>
      </div>

      {/* Event Selector */}
      <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
        <SelectTrigger className="w-full max-w-md">
          <SelectValue placeholder="Select an event" />
        </SelectTrigger>
        <SelectContent>
          {bookings.map((booking) => (
            <SelectItem key={booking.id} value={booking.id}>
              <div className="flex items-center gap-2">
                <span>{booking.event_name}</span>
                {booking.event_date && (
                  <span className="text-muted-foreground">
                    • {format(new Date(booking.event_date), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {metrics && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Quantitative Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Actual Audience Size</Label>
                <input
                  type="number"
                  value={metrics.audience_size_actual || ""}
                  onChange={(e) =>
                    updateMetrics("audience_size_actual", parseInt(e.target.value) || null)
                  }
                  placeholder="How many attended?"
                  className="w-full mt-1 p-2 border rounded-md bg-background"
                />
              </div>

              <div>
                <Label>Q&A Questions Received</Label>
                <input
                  type="number"
                  value={metrics.qa_questions_count || ""}
                  onChange={(e) =>
                    updateMetrics("qa_questions_count", parseInt(e.target.value) || null)
                  }
                  placeholder="Number of questions"
                  className="w-full mt-1 p-2 border rounded-md bg-background"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="standing-ovation"
                  checked={metrics.standing_ovation}
                  onChange={(e) => updateMetrics("standing_ovation", e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="standing-ovation" className="cursor-pointer">
                  🎉 Standing ovation!
                </Label>
              </div>

              <ScoreSelector
                label="Your Energy Level"
                value={metrics.energy_level}
                onChange={(v) => updateMetrics("energy_level", v)}
                max={5}
                icon={<Zap className="h-4 w-4" />}
              />

              <ScoreSelector
                label="Audience Responsiveness"
                value={metrics.audience_responsiveness}
                onChange={(v) => updateMetrics("audience_responsiveness", v)}
                max={5}
                icon={<Users className="h-4 w-4" />}
              />
            </CardContent>
          </Card>

          {/* Qualitative Reflections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Reflections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>What went well?</Label>
                <Textarea
                  value={metrics.what_went_well}
                  onChange={(e) => updateMetrics("what_went_well", e.target.value)}
                  placeholder="Moments that worked great..."
                  rows={3}
                />
              </div>

              <div>
                <Label>What to improve next time?</Label>
                <Textarea
                  value={metrics.what_to_improve}
                  onChange={(e) => updateMetrics("what_to_improve", e.target.value)}
                  placeholder="Areas to work on..."
                  rows={3}
                />
              </div>

              <div>
                <Label>Notes if invited back</Label>
                <Textarea
                  value={metrics.notes_for_next_time}
                  onChange={(e) => updateMetrics("notes_for_next_time", e.target.value)}
                  placeholder="Things to remember for this venue/organizer..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Personal learnings</Label>
                <Textarea
                  value={metrics.personal_learnings}
                  onChange={(e) => updateMetrics("personal_learnings", e.target.value)}
                  placeholder="What did you learn from this experience?"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Button onClick={saveMetrics} disabled={saving} className="w-full md:w-auto">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving..." : "Save Reflection"}
      </Button>
    </div>
  );
}
