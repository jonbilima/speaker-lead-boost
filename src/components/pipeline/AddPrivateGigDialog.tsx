import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* A gig the speaker booked themselves: a website inquiry, a referral, a local
 * church. It lives in their pipeline like any other opportunity but is
 * private to them. Ownership is set server-side by add_private_gig from the
 * session, never from anything this form sends, and the database refuses to
 * put it in anyone else's pipeline. This is separate from "Share an
 * opportunity", which publishes to every speaker. */

export interface CreatedPrivateGig {
  matchId: string;
  opportunityId: string;
  stage: string;
  eventName: string;
  eventDate: string | null;
  fee: number | null;
}

interface AddPrivateGigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (gig: CreatedPrivateGig) => void;
}

// "New" is left out on purpose: it means a lead nobody has touched yet.
const STAGES = [
  { id: "interested", label: "Interested" },
  { id: "pitched", label: "Applied" },
  { id: "negotiating", label: "In Conversation" },
  { id: "accepted", label: "Accepted" },
  { id: "completed", label: "Completed" },
];

const EMPTY = {
  eventName: "",
  contactName: "",
  contactEmail: "",
  eventDate: "",
  location: "",
  isVirtual: false,
  topic: "",
  fee: "",
  stage: "negotiating",
  notes: "",
};

export function AddPrivateGigDialog({ open, onOpenChange, onCreated }: AddPrivateGigDialogProps) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const close = (next: boolean) => {
    if (!next && !saving) setForm(EMPTY);
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.eventName.trim();
    if (!name) {
      toast.error("Add the event or organization name.");
      return;
    }
    const fee = form.fee.trim() === "" ? null : Number(form.fee);
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
      toast.error("Enter the fee as a number, like 2500.");
      return;
    }

    // Noon local time, so the date reads the same day in every US time zone.
    const eventDate = form.eventDate ? `${form.eventDate}T12:00:00` : null;

    setSaving(true);
    const { data, error } = await supabase.rpc("add_private_gig", {
      p_event_name: name,
      p_organizer_name: form.contactName.trim() || null,
      p_organizer_email: form.contactEmail.trim() || null,
      p_event_date: eventDate ? new Date(eventDate).toISOString() : null,
      p_location: form.isVirtual ? null : form.location.trim() || null,
      p_is_virtual: form.isVirtual,
      p_topic: form.topic.trim() || null,
      p_fee: fee,
      p_stage: form.stage,
      p_notes: form.notes.trim() || null,
    });
    setSaving(false);

    if (error || !data) {
      console.error("add_private_gig failed:", error);
      toast.error(error?.message || "Couldn't add the gig. Try again, or email support@nextmic.ai.");
      return;
    }

    const result = data as { opportunity_id: string; match_id: string };
    toast.success("Added to your pipeline. Only you can see it.");
    onCreated({
      matchId: result.match_id,
      opportunityId: result.opportunity_id,
      stage: form.stage,
      eventName: name,
      eventDate,
      fee,
    });
    setForm(EMPTY);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add my own gig</DialogTitle>
            <DialogDescription>
              For engagements you found yourself, like a website inquiry, a referral or a local
              booking. It works like any gig in your pipeline: packages, invoices and fee tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 my-4 text-sm text-violet-900">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Only you can see this gig. It never goes into the shared lead pool.</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gig-name">Event or organization</Label>
              <Input
                id="gig-name"
                value={form.eventName}
                onChange={(e) => set("eventName", e.target.value)}
                placeholder="Huntsville Rotary Club keynote"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gig-contact">Contact name</Label>
                <Input
                  id="gig-contact"
                  value={form.contactName}
                  onChange={(e) => set("contactName", e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gig-email">Contact email</Label>
                <Input
                  id="gig-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gig-date">Event date</Label>
                <Input
                  id="gig-date"
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => set("eventDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gig-fee">Agreed fee (USD)</Label>
                <Input
                  id="gig-fee"
                  inputMode="decimal"
                  value={form.fee}
                  onChange={(e) => set("fee", e.target.value)}
                  placeholder="2500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="gig-location">Location</Label>
                <label htmlFor="gig-virtual" className="flex items-center gap-2 text-sm text-muted-foreground">
                  Virtual
                  <Switch
                    id="gig-virtual"
                    checked={form.isVirtual}
                    onCheckedChange={(v) => set("isVirtual", v)}
                  />
                </label>
              </div>
              <Input
                id="gig-location"
                value={form.isVirtual ? "" : form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder={form.isVirtual ? "Virtual event" : "Huntsville, AL"}
                disabled={form.isVirtual}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gig-topic">Topic</Label>
                <Input
                  id="gig-topic"
                  value={form.topic}
                  onChange={(e) => set("topic", e.target.value)}
                  placeholder="Systems thinking for leaders"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gig-stage">Stage</Label>
                <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
                  <SelectTrigger id="gig-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gig-notes">Notes</Label>
              <Textarea
                id="gig-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="How they found you, deposit terms, anything you need to remember."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add to my pipeline"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
