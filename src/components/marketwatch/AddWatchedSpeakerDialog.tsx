import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddWatchedSpeakerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddWatchedSpeakerDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddWatchedSpeakerDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    watched_name: "",
    watched_linkedin_url: "",
    watched_website: "",
    notes: "",
  });
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");

  const handleAddTopic = () => {
    const topic = topicInput.trim();
    if (topic && !topics.includes(topic)) {
      setTopics([...topics, topic]);
      setTopicInput("");
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setTopics(topics.filter(t => t !== topic));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.watched_name.trim()) {
      toast.error("Speaker name is required");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("watched_speakers").insert({
      speaker_id: session.user.id,
      watched_name: formData.watched_name.trim(),
      watched_linkedin_url: formData.watched_linkedin_url.trim() || null,
      watched_website: formData.watched_website.trim() || null,
      watched_topics: topics,
      notes: formData.notes.trim() || null,
    });

    setSaving(false);

    if (error) {
      toast.error("Failed to add speaker");
      return;
    }

    toast.success("Speaker added to watch list");
    setFormData({
      watched_name: "",
      watched_linkedin_url: "",
      watched_website: "",
      notes: "",
    });
    setTopics([]);
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Speaker to Watch</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Speaker Name *</Label>
            <Input
              value={formData.watched_name}
              onChange={(e) => setFormData({ ...formData, watched_name: e.target.value })}
              placeholder="e.g., Jane Smith"
            />
          </div>

          <div>
            <Label>LinkedIn URL</Label>
            <Input
              type="url"
              value={formData.watched_linkedin_url}
              onChange={(e) => setFormData({ ...formData, watched_linkedin_url: e.target.value })}
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          <div>
            <Label>Website</Label>
            <Input
              type="url"
              value={formData.watched_website}
              onChange={(e) => setFormData({ ...formData, watched_website: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label>Topics</Label>
            <div className="flex gap-2">
              <Input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Add a topic"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddTopic}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {topics.map((topic, idx) => (
                  <Badge key={idx} variant="secondary" className="pr-1">
                    {topic}
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(topic)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Why are you watching this speaker?"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Speaker
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
