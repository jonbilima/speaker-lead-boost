import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2, Sparkles, Link as LinkIcon, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

interface SmartSubmitDialogProps {
  onSuccess?: () => void;
}

interface ExtractedData {
  event_name: string;
  organizer_name?: string | null;
  organizer_email?: string | null;
  deadline?: string | null;
  event_date?: string | null;
  location?: string | null;
  audience_size?: number | null;
  description?: string | null;
  fee_estimate_min?: number | null;
  fee_estimate_max?: number | null;
  covers_travel?: boolean | null;
  covers_accommodation?: boolean | null;
}

export function SmartSubmitDialog({ onSuccess }: SmartSubmitDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"url" | "review" | "success">("url");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [karmaPoints, setKarmaPoints] = useState(0);

  const handleExtract = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-opportunity-from-url", {
        body: { url: url.trim() },
      });

      if (error) throw error;

      if (data.success && data.data) {
        setExtracted(data.data);
        setStep("review");
        toast.success("Details extracted! Please review.");
      } else {
        throw new Error(data.error || "Failed to extract details");
      }
    } catch (error) {
      console.error("Extract error:", error);
      toast.error("Failed to extract details. You can still enter them manually.");
      // Show manual form with URL pre-filled
      setExtracted({
        event_name: "",
        event_url: url,
      } as ExtractedData);
      setStep("review");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!extracted?.event_name) {
      toast.error("Event name is required");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in");
        return;
      }

      // Submit the opportunity
      const { error } = await supabase
        .from("opportunities")
        .insert({
          event_name: extracted.event_name,
          organizer_name: extracted.organizer_name || null,
          organizer_email: extracted.organizer_email || null,
          event_url: url.trim() || null,
          deadline: extracted.deadline || null,
          event_date: extracted.event_date || null,
          location: extracted.location || null,
          fee_estimate_min: extracted.fee_estimate_min || null,
          fee_estimate_max: extracted.fee_estimate_max || null,
          audience_size: extracted.audience_size || null,
          description: extracted.description || null,
          covers_travel: extracted.covers_travel || null,
          covers_accommodation: extracted.covers_accommodation || null,
          source: "manual",
          submitted_by: session.user.id,
          is_verified: false,
          is_active: true,
          scraped_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Award karma points
      const { error: karmaError } = await supabase
        .from("opportunity_karma")
        .insert({
          user_id: session.user.id,
          action: "submitted",
          points: 5,
        });

      if (!karmaError) {
        setKarmaPoints(5);
      }

      setStep("success");
      toast.success("Opportunity submitted!");
      onSuccess?.();
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit opportunity");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep("url");
      setUrl("");
      setExtracted(null);
      setKarmaPoints(0);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-accent to-primary hover:opacity-90">
          <PlusCircle className="h-4 w-4" />
          Add Opportunity
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "success" ? (
              <>
                <Award className="h-5 w-5 text-yellow-500" />
                Thanks for Contributing!
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 text-accent" />
                Add a Speaking Opportunity
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === "url" && "Paste a URL and we'll automatically extract the details"}
            {step === "review" && "Review and edit the extracted information"}
            {step === "success" && "Your contribution helps the speaker community!"}
          </DialogDescription>
        </DialogHeader>

        {step === "url" && (
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="url" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Event URL
              </Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://conference.com/cfp or https://linkedin.com/events/..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Works with conference sites, LinkedIn, Eventbrite, Meetup, etc.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleExtract}
                disabled={loading || !url.trim()}
                className="flex-1 gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Extract Details
                  </>
                )}
              </Button>
            </div>

            <div className="text-center">
              <Button
                variant="link"
                className="text-sm"
                onClick={() => {
                  setExtracted({ event_name: "" });
                  setStep("review");
                }}
              >
                Or enter details manually →
              </Button>
            </div>
          </div>
        )}

        {step === "review" && extracted && (
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="event_name">Event Name *</Label>
              <Input
                id="event_name"
                value={extracted.event_name || ""}
                onChange={(e) => setExtracted({ ...extracted, event_name: e.target.value })}
                placeholder="Tech Conference 2025"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="organizer">Organizer</Label>
                <Input
                  id="organizer"
                  value={extracted.organizer_name || ""}
                  onChange={(e) => setExtracted({ ...extracted, organizer_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Contact Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={extracted.organizer_email || ""}
                  onChange={(e) => setExtracted({ ...extracted, organizer_email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deadline">CFP Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={extracted.deadline?.split("T")[0] || ""}
                  onChange={(e) => setExtracted({ ...extracted, deadline: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="event_date">Event Date</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={extracted.event_date?.split("T")[0] || ""}
                  onChange={(e) => setExtracted({ ...extracted, event_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={extracted.location || ""}
                onChange={(e) => setExtracted({ ...extracted, location: e.target.value })}
                placeholder="San Francisco, CA or Virtual"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="fee_min">Min Fee ($)</Label>
                <Input
                  id="fee_min"
                  type="number"
                  value={extracted.fee_estimate_min || ""}
                  onChange={(e) => setExtracted({ ...extracted, fee_estimate_min: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div>
                <Label htmlFor="fee_max">Max Fee ($)</Label>
                <Input
                  id="fee_max"
                  type="number"
                  value={extracted.fee_estimate_max || ""}
                  onChange={(e) => setExtracted({ ...extracted, fee_estimate_max: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div>
                <Label htmlFor="audience">Audience</Label>
                <Input
                  id="audience"
                  type="number"
                  value={extracted.audience_size || ""}
                  onChange={(e) => setExtracted({ ...extracted, audience_size: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={extracted.description || ""}
                onChange={(e) => setExtracted({ ...extracted, description: e.target.value })}
                rows={3}
              />
            </div>

            <Card className="p-3 bg-accent/10 border-accent/20">
              <div className="flex items-center gap-2 text-sm">
                <Award className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">+5 karma points</span>
                <span className="text-muted-foreground">for contributing this opportunity</span>
              </div>
            </Card>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("url")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !extracted.event_name} className="flex-1">
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
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center mx-auto">
              <Award className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">+{karmaPoints} Karma Points!</p>
              <p className="text-muted-foreground mt-1">
                Your submission is being reviewed. Once approved, it'll help speakers everywhere!
              </p>
            </div>
            <Button onClick={handleClose} className="mt-4">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}