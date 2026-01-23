import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SubmitOpportunityDialogProps {
  onSuccess?: () => void;
}

export function SubmitOpportunityDialog({ onSuccess }: SubmitOpportunityDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    event_name: "",
    organizer_name: "",
    organizer_email: "",
    event_url: "",
    deadline: "",
    event_date: "",
    location: "",
    fee_estimate_min: "",
    fee_estimate_max: "",
    audience_size: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.event_name.trim()) {
      toast.error("Event name is required");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to submit opportunities");
        return;
      }

      // Insert as manual submission (is_verified = false for admin review)
      const { error } = await supabase
        .from('opportunities')
        .insert({
          event_name: form.event_name.trim(),
          organizer_name: form.organizer_name.trim() || null,
          organizer_email: form.organizer_email.trim() || null,
          event_url: form.event_url.trim() || null,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
          event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
          location: form.location.trim() || null,
          fee_estimate_min: form.fee_estimate_min ? parseFloat(form.fee_estimate_min) : null,
          fee_estimate_max: form.fee_estimate_max ? parseFloat(form.fee_estimate_max) : null,
          audience_size: form.audience_size ? parseInt(form.audience_size) : null,
          description: form.description.trim() || null,
          source: 'manual',
          is_verified: false,
          is_active: true,
          scraped_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Opportunity submitted for review!", {
        description: "An admin will verify and approve your submission."
      });

      setForm({
        event_name: "",
        organizer_name: "",
        organizer_email: "",
        event_url: "",
        deadline: "",
        event_date: "",
        location: "",
        fee_estimate_min: "",
        fee_estimate_max: "",
        audience_size: "",
        description: "",
      });
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error submitting opportunity:", error);
      toast.error("Failed to submit opportunity");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Submit Opportunity
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a Speaking Opportunity</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="event_name">Event Name *</Label>
            <Input
              id="event_name"
              value={form.event_name}
              onChange={(e) => setForm(f => ({ ...f, event_name: e.target.value }))}
              placeholder="Tech Conference 2025"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="organizer_name">Organizer Name</Label>
              <Input
                id="organizer_name"
                value={form.organizer_name}
                onChange={(e) => setForm(f => ({ ...f, organizer_name: e.target.value }))}
                placeholder="Event Organizer"
              />
            </div>
            <div>
              <Label htmlFor="organizer_email">Organizer Email</Label>
              <Input
                id="organizer_email"
                type="email"
                value={form.organizer_email}
                onChange={(e) => setForm(f => ({ ...f, organizer_email: e.target.value }))}
                placeholder="contact@event.com"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="event_url">Event/CFP URL</Label>
            <Input
              id="event_url"
              type="url"
              value={form.event_url}
              onChange={(e) => setForm(f => ({ ...f, event_url: e.target.value }))}
              placeholder="https://conference.com/cfp"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deadline">CFP Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="event_date">Event Date</Label>
              <Input
                id="event_date"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm(f => ({ ...f, event_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="San Francisco, CA or Virtual"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="fee_min">Min Fee ($)</Label>
              <Input
                id="fee_min"
                type="number"
                min="0"
                value={form.fee_estimate_min}
                onChange={(e) => setForm(f => ({ ...f, fee_estimate_min: e.target.value }))}
                placeholder="3000"
              />
            </div>
            <div>
              <Label htmlFor="fee_max">Max Fee ($)</Label>
              <Input
                id="fee_max"
                type="number"
                min="0"
                value={form.fee_estimate_max}
                onChange={(e) => setForm(f => ({ ...f, fee_estimate_max: e.target.value }))}
                placeholder="5000"
              />
            </div>
            <div>
              <Label htmlFor="audience">Audience Size</Label>
              <Input
                id="audience"
                type="number"
                min="0"
                value={form.audience_size}
                onChange={(e) => setForm(f => ({ ...f, audience_size: e.target.value }))}
                placeholder="500"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Tell us about this speaking opportunity..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit for Review"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
