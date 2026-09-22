import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, ExternalLink, RefreshCw, Send, Sparkles } from "lucide-react";
import { useEmailSender } from "@/hooks/useEmailSender";
import { formatEventDate } from "@/lib/eventDates";
import type { NextCycleOpportunity } from "@/pages/NextCycle";

interface NextCyclePitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: NextCycleOpportunity | null;
  contactEmail: string | null;
  contactUrl: string | null;
}

export function NextCyclePitchDialog({
  open,
  onOpenChange,
  opportunity,
  contactEmail,
  contactUrl,
}: NextCyclePitchDialogProps) {
  const { sendEmail, isSending } = useEmailSender();
  const [generating, setGenerating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const generate = async () => {
    if (!opportunity) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pitch", {
        body: { opportunity_id: opportunity.id, mode: "next_cycle" },
      });
      if (error) throw error;
      const first = data?.pitches?.[0];
      if (first) {
        setSubject(first.subject_line ?? "");
        setBody(first.email_body ?? "");
      } else {
        toast.error("No pitch came back. Try again.");
      }
    } catch (err) {
      console.error("Next cycle pitch error:", err);
      toast.error(err instanceof Error ? err.message : "Could not write the pitch");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (open && opportunity) {
      setSubject("");
      setBody("");
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, opportunity?.id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      toast.success("Pitch copied");
    } catch {
      toast.error("Could not copy the pitch");
    }
  };

  const send = async () => {
    if (!opportunity || !contactEmail) return;
    const result = await sendEmail({
      to: contactEmail,
      subject,
      body,
      relatedType: "pitch",
      relatedId: opportunity.id,
    });
    if (result.limitReached) return;
    if (!result.success) {
      toast.error(result.error || "Could not send the email");
      return;
    }
    toast.success("Sent to the organizer");
    onOpenChange(false);
  };

  if (!opportunity) return null;

  const closed = formatEventDate(opportunity.deadline);
  const runs = formatEventDate(opportunity.event_date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Pitch for the next cycle
          </DialogTitle>
          <DialogDescription>
            {opportunity.event_name}
            {closed && ` • call closed ${closed}`}
            {runs && ` • event runs ${runs}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Early outreach, not an application</Badge>
            {contactEmail ? (
              <Badge variant="outline">{contactEmail}</Badge>
            ) : contactUrl ? (
              <a
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1 underline underline-offset-2"
              >
                Organizer contact page <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <Badge variant="outline">No contact on file — copy and send yourself</Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nc-subject">Subject</Label>
            <Input
              id="nc-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={generating ? "Writing…" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nc-body">Message</Label>
            <Textarea
              id="nc-body"
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={generating ? "Writing your next-cycle outreach…" : ""}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={generate} disabled={generating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} />
            Rewrite
          </Button>
          <Button variant="outline" onClick={copy} disabled={!body}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button onClick={send} disabled={!contactEmail || !body || isSending}>
            <Send className="h-4 w-4 mr-2" />
            {contactEmail ? "Send to organizer" : "No email on file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
