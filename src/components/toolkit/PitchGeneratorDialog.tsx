import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Copy, Check, Send, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmailSender } from "@/hooks/useEmailSender";
import { addDays } from "date-fns";

interface Opportunity {
  id: string;
  event_name: string;
  organizer_name: string | null;
  organizer_email: string | null;
}

interface PitchGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId?: string;
  onPitchSent?: () => void;
}

export function PitchGeneratorDialog({
  open,
  onOpenChange,
  opportunityId,
  onPitchSent,
}: PitchGeneratorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState(opportunityId || "");
  const [tone, setTone] = useState("professional");
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [subject, setSubject] = useState("");
  const { sendEmail, isSending } = useEmailSender();

  const selectedOpp = opportunities.find((o) => o.id === selectedOpportunity);

  useEffect(() => {
    if (open) {
      loadOpportunities();
    }
  }, [open]);

  useEffect(() => {
    if (opportunityId) {
      setSelectedOpportunity(opportunityId);
    }
  }, [opportunityId]);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("opportunity_scores")
        .select(`
          opportunity_id,
          opportunities (
            id,
            event_name,
            organizer_name,
            organizer_email
          )
        `)
        .eq("user_id", session.user.id)
        .not("pipeline_stage", "in", '("accepted","rejected","completed")')
        .limit(50);

      if (data) {
        interface OpportunityScoreRow {
          opportunity_id: string;
          opportunities: { id: string; event_name: string; organizer_name: string | null; organizer_email: string | null } | null;
        }
        const opps = (data as OpportunityScoreRow[])
          .filter((d) => d.opportunities)
          .map((d) => ({
            id: d.opportunities!.id,
            event_name: d.opportunities!.event_name,
            organizer_name: d.opportunities!.organizer_name,
            organizer_email: d.opportunities!.organizer_email,
          }));
        setOpportunities(opps);
      }
    } catch (error) {
      console.error("Error loading opportunities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedOpportunity) {
      toast.error("Please select an opportunity");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pitch", {
        body: {
          opportunityId: selectedOpportunity,
          tone,
        },
      });

      if (error) throw error;

      setSubject(data.subject_line || "");
      setGeneratedPitch(data.email_body || "");
      toast.success("Pitch generated!");
    } catch (error) {
      console.error("Error generating pitch:", error);
      toast.error("Failed to generate pitch");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    const fullPitch = `Subject: ${subject}\n\n${generatedPitch}`;
    await navigator.clipboard.writeText(fullPitch);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendPitch = async () => {
    if (!selectedOpp?.organizer_email) {
      toast.error("No organizer email available");
      return;
    }

    try {
      const result = await sendEmail({
        to: selectedOpp.organizer_email,
        subject: subject,
        body: generatedPitch,
        relatedType: "pitch",
        relatedId: selectedOpportunity,
      });

      if (result.success) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Update or create opportunity score with pitched status
          const { data: existingScore } = await supabase
            .from("opportunity_scores")
            .select("id")
            .eq("opportunity_id", selectedOpportunity)
            .eq("user_id", session.user.id)
            .single();

          if (existingScore) {
            await supabase
              .from("opportunity_scores")
              .update({
                pipeline_stage: "pitched",
                interested_at: new Date().toISOString(),
              })
              .eq("id", existingScore.id);

            // Log activity
            await supabase.from("outreach_activities").insert({
              match_id: existingScore.id,
              speaker_id: session.user.id,
              activity_type: "email_sent",
              subject: subject,
              body: generatedPitch,
              email_sent_at: new Date().toISOString(),
            });

            // Schedule first follow-up
            const { data: profile } = await supabase
              .from("profiles")
              .select("follow_up_interval_1")
              .eq("id", session.user.id)
              .single();

            const interval = profile?.follow_up_interval_1 || 7;
            await supabase.from("follow_up_reminders").insert({
              speaker_id: session.user.id,
              match_id: existingScore.id,
              reminder_type: "first",
              due_date: addDays(new Date(), interval).toISOString().split("T")[0],
            });
          }

          // Save pitch to pitches table
          await supabase.from("pitches").insert({
            user_id: session.user.id,
            opportunity_id: selectedOpportunity,
            subject_line: subject,
            email_body: generatedPitch,
            tone: tone,
          });

          // Log to applied_logs
          await supabase.from("applied_logs").insert({
            user_id: session.user.id,
            opportunity_id: selectedOpportunity,
            notes: "Pitch sent via email",
          });
        }

        if (result.testMode) {
          toast.success("Pitch sent (Test Mode)");
        } else {
          toast.success("Pitch email sent successfully!");
        }

        onPitchSent?.();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error sending pitch:", error);
      toast.error("Failed to send pitch email");
    }
  };

  const hasEmail = !!selectedOpp?.organizer_email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Pitch</DialogTitle>
          <DialogDescription>
            Create and send a personalized pitch to event organizers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Select Opportunity</Label>
              <Select
                value={selectedOpportunity}
                onValueChange={setSelectedOpportunity}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an opportunity" />
                </SelectTrigger>
                <SelectContent>
                  {opportunities.map((opp) => (
                    <SelectItem key={opp.id} value={opp.id}>
                      <div className="flex items-center gap-2">
                        {opp.event_name}
                        {!opp.organizer_email && (
                          <span className="text-xs text-muted-foreground">(no email)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedOpp && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Organizer:</span>
              <span className="font-medium">{selectedOpp.organizer_name || "Unknown"}</span>
              {selectedOpp.organizer_email ? (
                <Badge variant="outline" className="text-xs">
                  {selectedOpp.organizer_email}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  No email on file
                </Badge>
              )}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating || !selectedOpportunity}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Pitch"
            )}
          </Button>

          {generatedPitch && (
            <div className="space-y-4 pt-4 border-t">
              {!hasEmail && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    No organizer email available. Copy the pitch to send manually.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Textarea
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  rows={1}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Email Body</Label>
                <Textarea
                  value={generatedPitch}
                  onChange={(e) => setGeneratedPitch(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCopy} variant="outline" className="flex-1">
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
                {hasEmail && (
                  <Button
                    onClick={handleSendPitch}
                    disabled={isSending || !subject || !generatedPitch}
                    className="flex-1"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Pitch
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
