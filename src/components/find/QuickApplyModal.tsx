import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Send, RefreshCw, MapPin, Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { Opportunity } from "@/pages/Find";
import { useEmailSender } from "@/hooks/useEmailSender";

interface QuickApplyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
  onSuccess: () => void;
}

export function QuickApplyModal({ open, onOpenChange, opportunity, onSuccess }: QuickApplyModalProps) {
  const { sendEmail, isSending: emailSending } = useEmailSender();
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [subjectLine, setSubjectLine] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [noEmailWarning, setNoEmailWarning] = useState(false);

  useEffect(() => {
    if (open && opportunity) {
      setSubjectLine("");
      setEmailBody("");
      setHasGenerated(false);
      setNoEmailWarning(!opportunity.organizer_email);
      generatePitch();
    }
  }, [open, opportunity?.id]);

  const generatePitch = async () => {
    if (!opportunity) return;
    
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-pitch', {
        body: { opportunity_id: opportunity.id }
      });

      if (error) throw error;

      if (data?.pitches && data.pitches.length > 0) {
        const firstPitch = data.pitches[0];
        setSubjectLine(firstPitch.subject_line);
        setEmailBody(firstPitch.email_body);
        setHasGenerated(true);
      }
    } catch (error) {
      console.error('Generate pitch error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate pitch";
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendApplication = async () => {
    if (!opportunity) return;
    
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // If organizer email exists, send actual email
      if (opportunity.organizer_email) {
        const emailResult = await sendEmail({
          to: opportunity.organizer_email,
          subject: subjectLine,
          body: emailBody,
          relatedType: "pitch",
          relatedId: opportunity.id,
        });

        if (!emailResult.success) {
          throw new Error(emailResult.error || "Failed to send email");
        }
      }

      // Check if score exists
      const { data: existing } = await supabase
        .from("opportunity_scores")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("opportunity_id", opportunity.id)
        .single();

      const now = new Date().toISOString();
      let scoreId = existing?.id;

      if (existing) {
        await supabase
          .from("opportunity_scores")
          .update({ 
            pipeline_stage: "pitched", 
            interested_at: now,
          })
          .eq("id", existing.id);
      } else {
        const { data: newScore } = await supabase
          .from("opportunity_scores")
          .insert({
            user_id: session.user.id,
            opportunity_id: opportunity.id,
            pipeline_stage: "pitched",
            interested_at: now,
          })
          .select("id")
          .single();
        scoreId = newScore?.id;
      }

      // Log the application
      await supabase
        .from("applied_logs")
        .insert({
          user_id: session.user.id,
          opportunity_id: opportunity.id,
          status: "applied",
        });

      // Log outreach activity
      await supabase
        .from("outreach_activities")
        .insert({
          speaker_id: session.user.id,
          match_id: scoreId,
          activity_type: "email_sent",
          subject: subjectLine,
          body: emailBody,
          email_sent_at: now,
        });

      // Create follow-up reminder for 7 days
      if (scoreId) {
        await supabase
          .from("follow_up_reminders")
          .insert({
            speaker_id: session.user.id,
            match_id: scoreId,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            reminder_type: "follow_up_1",
          });
      }

      toast.success(
        opportunity.organizer_email 
          ? "Application sent! Added to pipeline with follow-up scheduled." 
          : "Application logged! No email sent (organizer email not available)."
      );
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Send application error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send application";
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  if (!opportunity) return null;

  const formatFee = (min: number | null, max: number | null) => {
    if (!min && !max) return "Fee TBD";
    if (min && max) return `$${(min/1000).toFixed(0)}k - $${(max/1000).toFixed(0)}k`;
    if (max) return `Up to $${(max/1000).toFixed(0)}k`;
    return `From $${(min!/1000).toFixed(0)}k`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Apply
          </DialogTitle>
          <DialogDescription>
            Review and send your AI-generated pitch
          </DialogDescription>
        </DialogHeader>

        {/* Event Summary */}
        <Card className="bg-muted/50">
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold">{opportunity.event_name}</h3>
            {opportunity.organizer_name && (
              <p className="text-sm text-muted-foreground">{opportunity.organizer_name}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {opportunity.location && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {opportunity.location}
                </span>
              )}
              {opportunity.event_date && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(opportunity.event_date).toLocaleDateString()}
                </span>
              )}
              <span className="flex items-center gap-1 text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                {formatFee(opportunity.fee_estimate_min, opportunity.fee_estimate_max)}
              </span>
              <Badge variant="outline">{opportunity.ai_score}% match</Badge>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* No Email Warning */}
        {noEmailWarning && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              No organizer email found. Your pitch will be saved but not sent automatically.
            </p>
          </div>
        )}

        {/* Pitch Editor */}
        {generating ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Generating your personalized pitch...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subjectLine}
                onChange={(e) => setSubjectLine(e.target.value)}
                placeholder="Enter subject line..."
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Email Body</Label>
                <Button variant="ghost" size="sm" onClick={generatePitch} disabled={generating}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate
                </Button>
              </div>
              <Textarea
                id="body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={12}
                placeholder="Your pitch will appear here..."
                className="font-mono text-sm"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Word count: {emailBody.split(/\s+/).filter(Boolean).length}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendApplication} 
            disabled={sending || emailSending || !hasGenerated || !subjectLine || !emailBody}
          >
            {sending || emailSending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {noEmailWarning ? "Log Application" : "Send Application"}
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Post-send info */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>After sending, this opportunity will be added to your Pipeline as "Applied"</p>
          <p>A follow-up reminder will be set for 7 days from now</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}