import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isBefore } from "date-fns";
import { EVENT_TYPES, BUDGET_RANGES, WidgetSettings } from "@/components/widget/WidgetTypes";
import { Json } from "@/integrations/supabase/types";

interface SpeakerData {
  id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  slug: string | null;
  widget_settings: Json | null;
}

interface TopicData {
  topic_id: string;
  topics: { name: string };
}

interface CalendarEntry {
  start_date: string;
  end_date: string | null;
}

const EmbedWidget = () => {
  const { slug } = useParams<{ slug: string }>();
  const [speaker, setSpeaker] = useState<SpeakerData | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const currentMonth = new Date();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    event_name: "",
    event_type: "",
    event_date: "",
    estimated_audience: "",
    budget_range: "",
    message: "",
  });

  useEffect(() => {
    loadSpeakerData();
  }, [slug]);

  const loadSpeakerData = async () => {
    if (!slug) return;

    // Load speaker profile
    const { data: speakerData, error: speakerError } = await supabase
      .from("profiles")
      .select("id, name, headline, bio, slug, widget_settings")
      .eq("slug", slug)
      .eq("is_public", true)
      .single();

    if (speakerError || !speakerData) {
      setLoading(false);
      return;
    }

    setSpeaker(speakerData);

    // Load topics
    const { data: topicsData } = await supabase
      .from("user_topics")
      .select("topic_id, topics(name)")
      .eq("user_id", speakerData.id)
      .limit(5);

    if (topicsData) {
      setTopics((topicsData as unknown as TopicData[]).map(t => t.topics.name));
    }

    // Load blocked dates (calendar entries)
    const threeMonthsFromNow = addMonths(new Date(), 3);
    const { data: calendarData } = await supabase
      .from("speaker_calendar")
      .select("start_date, end_date")
      .eq("speaker_id", speakerData.id)
      .gte("start_date", new Date().toISOString().split("T")[0])
      .lte("start_date", threeMonthsFromNow.toISOString().split("T")[0]);

    if (calendarData) {
      const blocked = new Set<string>();
      (calendarData as CalendarEntry[]).forEach(entry => {
        const start = new Date(entry.start_date);
        const end = entry.end_date ? new Date(entry.end_date) : start;
        const days = eachDayOfInterval({ start, end });
        days.forEach(day => blocked.add(format(day, "yyyy-MM-dd")));
      });
      setBlockedDates(blocked);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!speaker) return;

    setSubmitting(true);

    const { error } = await supabase.from("inbound_leads").insert({
      speaker_id: speaker.id,
      name: formData.name,
      email: formData.email,
      company: formData.company || null,
      event_name: formData.event_name || null,
      event_type: formData.event_type || null,
      event_date: formData.event_date || null,
      estimated_audience: formData.estimated_audience || null,
      budget_range: formData.budget_range || null,
      message: formData.message || null,
      source: "widget",
    });

    setSubmitting(false);

    if (error) {
      toast.error("Failed to submit inquiry. Please try again.");
      return;
    }

    setSubmitted(true);
  };

  const renderMiniCalendar = () => {
    const months = [currentMonth, addMonths(currentMonth, 1), addMonths(currentMonth, 2)];
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Availability</span>
          <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-200" /> Available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gray-300" /> Booked
            </span>
          </div>
        </div>
        <div className={showCalendar ? "grid grid-cols-1 gap-4" : "grid grid-cols-3 gap-2"}>
          {months.map((month, idx) => (
            <div key={idx} className="text-center">
              <div className="text-xs font-medium mb-1">{format(month, "MMM yyyy")}</div>
              <div className={`grid grid-cols-7 gap-0.5 ${showCalendar ? "text-sm" : "text-[8px]"}`}>
                {showCalendar && ["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="text-muted-foreground font-medium p-1">{d}</div>
                ))}
                {eachDayOfInterval({
                  start: startOfMonth(month),
                  end: endOfMonth(month),
                }).map((day, dayIdx) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const isBlocked = blockedDates.has(dateStr);
                  const isPast = isBefore(day, new Date()) && !isToday(day);
                  
                  return (
                    <div
                      key={dayIdx}
                      className={`
                        ${showCalendar ? "p-1" : "p-0.5"} rounded
                        ${isPast ? "opacity-30" : ""}
                        ${isBlocked ? "bg-gray-300" : "bg-green-200"}
                        ${isToday(day) ? "ring-1 ring-primary" : ""}
                      `}
                      style={{ 
                        marginLeft: dayIdx === 0 ? `${day.getDay() * (100 / 7)}%` : undefined,
                        gridColumnStart: dayIdx === 0 ? day.getDay() + 1 : undefined,
                      }}
                    >
                      {showCalendar && day.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setShowCalendar(!showCalendar)}
        >
          {showCalendar ? "Collapse" : "Check Availability"}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!speaker) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-background">
        <p className="text-muted-foreground">Speaker not found</p>
      </div>
    );
  }

  const defaultSettings: WidgetSettings = {
    primary_color: "#8B5CF6",
    show_photo: true,
    show_topics: true,
    show_availability: true,
  };
  
  const settings: WidgetSettings = speaker.widget_settings 
    ? { ...defaultSettings, ...(speaker.widget_settings as Record<string, unknown>) } as WidgetSettings
    : defaultSettings;

  if (submitted) {
    return (
      <div 
        className="min-h-[400px] p-6 flex flex-col items-center justify-center text-center"
        style={{ background: `linear-gradient(135deg, ${settings.primary_color}10, ${settings.primary_color}05)` }}
      >
        <CheckCircle className="h-16 w-16 mb-4" style={{ color: settings.primary_color }} />
        <h2 className="text-xl font-semibold mb-2">Thank You!</h2>
        <p className="text-muted-foreground">
          Your inquiry has been sent to {speaker.name}. They'll be in touch soon!
        </p>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="p-4 bg-background min-h-[400px] overflow-y-auto">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => setShowForm(false)}
        >
          ← Back
        </Button>
        
        <h3 className="font-semibold mb-4">Request {speaker.name}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Company</Label>
            <Input
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Organization name"
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Event Name</Label>
              <Input
                value={formData.event_name}
                onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                placeholder="Event name"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Event Type</Label>
              <Select value={formData.event_type} onValueChange={(v) => setFormData({ ...formData, event_type: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Preferred Date</Label>
              <Input
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Est. Audience</Label>
              <Input
                value={formData.estimated_audience}
                onChange={(e) => setFormData({ ...formData, estimated_audience: e.target.value })}
                placeholder="e.g., 200"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Budget Range</Label>
            <Select value={formData.budget_range} onValueChange={(v) => setFormData({ ...formData, budget_range: v })}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select budget" />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_RANGES.map(range => (
                  <SelectItem key={range} value={range}>{range}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Message</Label>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Tell us about your event..."
              rows={3}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
            style={{ backgroundColor: settings.primary_color }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send Inquiry
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-4 bg-background min-h-[400px]">
      {/* Speaker Header */}
      <div className="text-center mb-4">
        {settings.show_photo && (
          <div 
            className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-white"
            style={{ backgroundColor: settings.primary_color }}
          >
            {speaker.name?.charAt(0) || "S"}
          </div>
        )}
        <h2 className="font-semibold text-lg">{speaker.name}</h2>
        {speaker.headline && (
          <p className="text-sm text-muted-foreground">{speaker.headline}</p>
        )}
      </div>

      {/* Topics */}
      {settings.show_topics && topics.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Speaking Topics</p>
          <div className="flex flex-wrap gap-1">
            {topics.map((topic, idx) => (
              <Badge 
                key={idx} 
                variant="secondary" 
                className="text-xs"
                style={{ backgroundColor: `${settings.primary_color}20`, color: settings.primary_color }}
              >
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Availability Calendar */}
      {settings.show_availability && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          {renderMiniCalendar()}
        </div>
      )}

      {/* CTA Button */}
      <Button
        className="w-full"
        size="lg"
        onClick={() => setShowForm(true)}
        style={{ backgroundColor: settings.primary_color }}
      >
        <Mail className="h-4 w-4 mr-2" />
        Request This Speaker
      </Button>

      <p className="text-xs text-center text-muted-foreground mt-3">
        Powered by NextMic
      </p>
    </div>
  );
};

export default EmbedWidget;
