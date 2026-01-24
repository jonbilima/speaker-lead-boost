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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PackageBuilderDialog } from "@/components/pipeline/PackageBuilderDialog";
import { PipelineOpportunity } from "@/components/pipeline/PipelineCard";

interface OpportunityScore {
  id: string;
  opportunity_id: string;
  pipeline_stage: string;
  ai_score: number | null;
  ai_reason: string | null;
  calculated_at: string;
  opportunities: {
    id: string;
    event_name: string;
    organizer_name: string | null;
    organizer_email: string | null;
    description: string | null;
    deadline: string | null;
    event_date: string | null;
    location: string | null;
    fee_estimate_min: number | null;
    fee_estimate_max: number | null;
    event_url: string | null;
  } | null;
}

interface SendPackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendPackageDialog({ open, onOpenChange }: SendPackageDialogProps) {
  const [loading, setLoading] = useState(false);
  const [opportunityScores, setOpportunityScores] = useState<OpportunityScore[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [packageBuilderOpen, setPackageBuilderOpen] = useState(false);

  const selectedScore = opportunityScores.find((o) => o.id === selectedId);

  useEffect(() => {
    if (open) {
      loadOpportunities();
      setSelectedId("");
    }
  }, [open]);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("opportunity_scores")
        .select(`
          id,
          opportunity_id,
          pipeline_stage,
          ai_score,
          ai_reason,
          calculated_at,
          opportunities (
            id,
            event_name,
            organizer_name,
            organizer_email,
            description,
            deadline,
            event_date,
            location,
            fee_estimate_min,
            fee_estimate_max,
            event_url
          )
        `)
        .eq("user_id", session.user.id)
        .not("pipeline_stage", "in", '("rejected","completed")')
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setOpportunityScores(data.filter((d) => d.opportunities) as OpportunityScore[]);
      }
    } catch (error) {
      console.error("Error loading opportunities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePackage = () => {
    if (selectedScore) {
      setPackageBuilderOpen(true);
    }
  };

  const handlePackageCreated = () => {
    setPackageBuilderOpen(false);
    onOpenChange(false);
  };

  // Transform to the format PackageBuilderDialog expects
  const packageBuilderOpportunity: PipelineOpportunity | null = selectedScore && selectedScore.opportunities ? {
    id: selectedScore.opportunity_id,
    score_id: selectedScore.id,
    event_name: selectedScore.opportunities.event_name,
    organizer_name: selectedScore.opportunities.organizer_name,
    organizer_email: selectedScore.opportunities.organizer_email,
    description: selectedScore.opportunities.description,
    deadline: selectedScore.opportunities.deadline,
    event_date: selectedScore.opportunities.event_date,
    location: selectedScore.opportunities.location,
    fee_estimate_min: selectedScore.opportunities.fee_estimate_min,
    fee_estimate_max: selectedScore.opportunities.fee_estimate_max,
    event_url: selectedScore.opportunities.event_url,
    ai_score: selectedScore.ai_score || 0,
    ai_reason: selectedScore.ai_reason,
    pipeline_stage: selectedScore.pipeline_stage,
    calculated_at: selectedScore.calculated_at,
  } : null;

  return (
    <>
      <Dialog open={open && !packageBuilderOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Send Speaker Package
            </DialogTitle>
            <DialogDescription>
              Select an opportunity to create and send your speaker package.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : opportunityScores.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No opportunities in your pipeline yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add opportunities from the Find page first.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Opportunity</Label>
                  <Select
                    value={selectedId}
                    onValueChange={setSelectedId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an opportunity" />
                    </SelectTrigger>
                    <SelectContent>
                      {opportunityScores.map((opp) => (
                        <SelectItem key={opp.id} value={opp.id}>
                          {opp.opportunities?.event_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedScore && selectedScore.opportunities && (
                  <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                    <div className="font-medium">{selectedScore.opportunities.event_name}</div>
                    {selectedScore.opportunities.organizer_name && (
                      <div className="text-muted-foreground">
                        Organizer: {selectedScore.opportunities.organizer_name}
                      </div>
                    )}
                    {selectedScore.opportunities.event_date && (
                      <div className="text-muted-foreground">
                        Date: {new Date(selectedScore.opportunities.event_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleCreatePackage}
                  disabled={!selectedId}
                  className="w-full"
                >
                  <Package className="mr-2 h-4 w-4" />
                  Create Package
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PackageBuilderDialog
        opportunity={packageBuilderOpportunity}
        open={packageBuilderOpen}
        onOpenChange={setPackageBuilderOpen}
        onPackageCreated={handlePackageCreated}
      />
    </>
  );
}
