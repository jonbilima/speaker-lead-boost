import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ENTRY_TYPES } from "./CalendarTypes";

interface AddCalendarEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onEntryAdded: () => void;
}

export function AddCalendarEntryDialog({
  open,
  onOpenChange,
  selectedDate,
  onEntryAdded,
}: AddCalendarEntryDialogProps) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState<string>("speaking_engagement");
  const [startDate, setStartDate] = useState<Date>(selectedDate);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isVirtual, setIsVirtual] = useState(false);
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setTitle("");
    setEntryType("speaking_engagement");
    setStartDate(selectedDate);
    setEndDate(undefined);
    setAllDay(true);
    setStartTime("09:00");
    setEndTime("10:00");
    setIsVirtual(false);
    setLocation("");
    setMeetingUrl("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in");
      setSaving(false);
      return;
    }

    // Map UI entry types to database enum
    let dbEntryType: "speaking_engagement" | "travel" | "prep" | "meeting" | "follow_up" | "blocked" | "other" = "other";
    if (entryType === "speaking_engagement" || entryType === "confirmed") {
      dbEntryType = "speaking_engagement";
    } else if (entryType === "travel") {
      dbEntryType = "travel";
    } else if (entryType === "blocked") {
      dbEntryType = "blocked";
    } else if (entryType === "follow_up") {
      dbEntryType = "follow_up";
    }

    const { error } = await supabase.from("speaker_calendar").insert({
      speaker_id: session.user.id,
      title: title.trim(),
      entry_type: dbEntryType,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      all_day: allDay,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      is_virtual: isVirtual,
      location: isVirtual ? null : location || null,
      meeting_url: isVirtual ? meetingUrl || null : null,
      notes: notes || null,
      color: ENTRY_TYPES.find(t => t.id === entryType)?.color || null,
    });

    if (error) {
      console.error("Error adding entry:", error);
      toast.error("Failed to add entry");
    } else {
      toast.success("Entry added");
      resetForm();
      onOpenChange(false);
      onEntryAdded();
    }

    setSaving(false);
  };

  // Update startDate when selectedDate changes
  if (open && startDate.toDateString() !== selectedDate.toDateString()) {
    setStartDate(selectedDate);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Calendar Entry</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., TechConf 2026 Keynote"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Entry Type</Label>
            <Select value={entryType} onValueChange={setEntryType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_TYPES.filter(t => t.id !== "deadline").map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded", type.color)} />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "Optional"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="allDay"
              checked={allDay}
              onCheckedChange={(checked) => setAllDay(checked === true)}
            />
            <Label htmlFor="allDay" className="text-sm font-normal">
              All day event
            </Label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isVirtual"
              checked={isVirtual}
              onCheckedChange={(checked) => setIsVirtual(checked === true)}
            />
            <Label htmlFor="isVirtual" className="text-sm font-normal">
              Virtual event
            </Label>
          </div>

          {isVirtual ? (
            <div className="space-y-2">
              <Label htmlFor="meetingUrl">Meeting URL</Label>
              <Input
                id="meetingUrl"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://zoom.us/..."
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Convention Center, NYC"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              disabled={saving}
            >
              {saving ? "Adding..." : "Add Entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
