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
import { Badge } from "@/components/ui/badge";
import { Copy, Loader2, RefreshCw, Send, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmailSender } from "@/hooks/useEmailSender";
import { addDays } from "date-fns";

interface FollowUpEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  reminderId: string;
  reminderType: string;
  organizerEmail?: string | null;
  organizerName?: string | null;
  matchId?: string;
  onFollowUpSent?: () => void;
}

export function FollowUpEmailDialog({
  open,
  onOpenChange,
  opportunityId,
  reminderId,
  reminderType,
  organizerEmail,
  organizerName,
  matchId,
  onFollowUpSent,
}: FollowUpEmailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [subjectLine, setSubjectLine] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [generated, setGenerated] = useState(false);
  const { sendEmail, isSending } = useEmailSender();

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

  const handleSendEmail = async () => {
    if (!organizerEmail) {
      toast.error("No organizer email available");
      return;
    }

    try {
      const result = await sendEmail({
        to: organizerEmail,
        subject: subjectLine,
        body: emailBody,
        relatedType: "follow_up",
        relatedId: opportunityId,
      });

      if (result.success) {
        // Mark reminder as completed
        await supabase
          .from("follow_up_reminders")
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq("id", reminderId);

        // Log activity
        const { data: { session } } = await supabase.auth.getSession();
        if (session && matchId) {
          await supabase.from("outreach_activities").insert({
            match_id: matchId,
            speaker_id: session.user.id,
            activity_type: "follow_up",
            subject: subjectLine,
            body: emailBody,
            email_sent_at: new Date().toISOString(),
          });

          // Schedule next follow-up if not final
          if (reminderType !== "final") {
            const { data: profile } = await supabase
              .from("profiles")
              .select("follow_up_interval_1, follow_up_interval_2, follow_up_interval_3")
              .eq("id", session.user.id)
              .single();

            const nextType = reminderType === "first" ? "second" : "final";
            const interval = reminderType === "first"
              ? (profile?.follow_up_interval_2 || 14)
              : (profile?.follow_up_interval_3 || 21);

            await supabase.from("follow_up_reminders").insert({
              speaker_id: session.user.id,
              match_id: matchId,
              reminder_type: nextType,
              due_date: addDays(new Date(), interval).toISOString().split("T")[0],
            });
          }
        }

        if (result.testMode) {
          toast.success("Follow-up sent (Test Mode)");
        } else {
          toast.success("Follow-up email sent!");
        }

        onFollowUpSent?.();
        handleClose();
      }
    } catch (error) {
      console.error("Error sending follow-up:", error);
      toast.error("Failed to send follow-up email");
    }
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

  const hasEmail = !!organizerEmail;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Generate {reminderLabels[reminderType]} Email
            {!hasEmail && (
              <Badge variant="secondary" className="text-xs">
                No email
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {organizerName
              ? `Sending to ${organizerName}${hasEmail ? ` (${organizerEmail})` : ""}`
              : "Create a polite follow-up email that adds value and references your original pitch."}
          </DialogDescription>
        </DialogHeader>

        {!hasEmail && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              No organizer email on file. You can generate and copy the email to send manually.
            </p>
          </div>
        )}

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
              <Button variant="outline" onClick={handleCopyAll}>
                <Copy className="h-4 w-4 mr-2" />
                Copy All
              </Button>
              {hasEmail && (
                <Button
                  onClick={handleSendEmail}
                  disabled={isSending || !subjectLine || !emailBody}
                  className="bg-primary"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
