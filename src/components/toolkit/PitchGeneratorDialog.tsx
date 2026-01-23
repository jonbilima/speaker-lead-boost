import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PitchGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId?: string;
}

export function PitchGeneratorDialog({
  open,
  onOpenChange,
  opportunityId,
}: PitchGeneratorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [opportunities, setOpportunities] = useState<Array<{ id: string; event_name: string; organizer_name: string | null }>>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState(opportunityId || "");
  const [tone, setTone] = useState("professional");
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [subject, setSubject] = useState("");

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
            organizer_name
          )
        `)
        .eq("user_id", session.user.id)
        .not("pipeline_stage", "in", '("accepted","rejected","completed")')
        .limit(50);

      if (data) {
        interface OpportunityScoreRow {
          opportunity_id: string;
          opportunities: { id: string; event_name: string; organizer_name: string | null } | null;
        }
        const opps = (data as OpportunityScoreRow[])
          .filter((d) => d.opportunities)
          .map((d) => ({
            id: d.opportunities!.id,
            event_name: d.opportunities!.event_name,
            organizer_name: d.opportunities!.organizer_name,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Pitch</DialogTitle>
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
                      {opp.event_name}
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

              <Button onClick={handleCopy} variant="outline" className="w-full">
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
