import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WatchedSpeaker } from "./MarketWatchTypes";

interface LogBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watchedSpeakers: WatchedSpeaker[];
  preselectedSpeakerId: string | null;
  onSuccess: () => void;
}

export function LogBookingDialog({
  open,
  onOpenChange,
  watchedSpeakers,
  preselectedSpeakerId,
  onSuccess,
}: LogBookingDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    watched_speaker_id: "",
    event_name: "",
    organization_name: "",
    event_date: "",
    source_url: "",
  });

  useEffect(() => {
    if (preselectedSpeakerId) {
      setFormData(prev => ({ ...prev, watched_speaker_id: preselectedSpeakerId }));
    }
  }, [preselectedSpeakerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.watched_speaker_id || !formData.event_name.trim()) {
      toast.error("Speaker and event name are required");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("watched_speaker_bookings").insert({
      watched_speaker_id: formData.watched_speaker_id,
      event_name: formData.event_name.trim(),
      organization_name: formData.organization_name.trim() || null,
      event_date: formData.event_date || null,
      source_url: formData.source_url.trim() || null,
    });

    setSaving(false);

    if (error) {
      toast.error("Failed to log booking");
      return;
    }

    toast.success("Booking logged successfully");
    setFormData({
      watched_speaker_id: "",
      event_name: "",
      organization_name: "",
      event_date: "",
      source_url: "",
    });
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Booking</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Speaker *</Label>
            <Select
              value={formData.watched_speaker_id}
              onValueChange={(v) => setFormData({ ...formData, watched_speaker_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a speaker" />
              </SelectTrigger>
              <SelectContent>
                {watchedSpeakers.map(speaker => (
                  <SelectItem key={speaker.id} value={speaker.id}>
                    {speaker.watched_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Event Name *</Label>
            <Input
              value={formData.event_name}
              onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
              placeholder="e.g., TechCrunch Disrupt 2026"
            />
          </div>

          <div>
            <Label>Organization</Label>
            <Input
              value={formData.organization_name}
              onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
              placeholder="e.g., TechCrunch"
            />
          </div>

          <div>
            <Label>Event Date</Label>
            <Input
              type="date"
              value={formData.event_date}
              onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
            />
          </div>

          <div>
            <Label>Source URL</Label>
            <Input
              type="url"
              value={formData.source_url}
              onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
              placeholder="https://linkedin.com/posts/..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Where did you discover this booking? (LinkedIn, Twitter, event page, etc.)
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log Booking
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
