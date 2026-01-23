import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FollowUpEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  reminderType: string;
}

export function FollowUpEmailDialog({
  open,
  onOpenChange,
  opportunityId,
  reminderType,
}: FollowUpEmailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [subjectLine, setSubjectLine] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: { opportunity_id: opportunityId, reminder_type: reminderType },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubjectLine(data.followup.subject_line);
      setEmailBody(data.followup.email_body);
      setGenerated(true);
    } catch (error) {
      console.error("Error generating follow-up:", error);
      toast.error("Failed to generate follow-up email");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleCopyAll = async () => {
    const fullEmail = `Subject: ${subjectLine}\n\n${emailBody}`;
    await navigator.clipboard.writeText(fullEmail);
    toast.success("Full email copied to clipboard");
  };

  const handleClose = () => {
    setSubjectLine("");
    setEmailBody("");
    setGenerated(false);
    onOpenChange(false);
  };

  const reminderLabels: Record<string, string> = {
    first: "1st Follow-up",
    second: "2nd Follow-up",
    final: "Final Follow-up",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate {reminderLabels[reminderType]} Email</DialogTitle>
          <DialogDescription>
            Create a polite follow-up email that adds value and references your original pitch.
          </DialogDescription>
        </DialogHeader>

        {!generated ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <p className="text-muted-foreground text-center">
              Click below to generate a personalized follow-up email based on the opportunity
              details and your profile.
            </p>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Follow-up Email"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="subject">Subject Line</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(subjectLine, "Subject")}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <Input
                id="subject"
                value={subjectLine}
                onChange={(e) => setSubjectLine(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Email Body</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(emailBody, "Body")}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <Textarea
                id="body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
              <Button onClick={handleCopyAll}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Full Email
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
