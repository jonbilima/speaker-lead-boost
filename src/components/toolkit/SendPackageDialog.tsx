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
import { Loader2, Package, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PackageBuilderDialog } from "@/components/pipeline/PackageBuilderDialog";
import { PipelineOpportunity } from "@/components/pipeline/PipelineCard";
import {
  PACKAGE_LOCKED_STAGES,
  PACKAGE_UNLOCKED_STAGES,
  PACKAGE_UNLOCK_STAGE_LABEL,
  canBuildPackage,
} from "@/lib/packageStages";

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
  const [loadError, setLoadError] = useState(false);

  const selectedScore = opportunityScores.find((o) => o.id === selectedId);
  const readyCount = opportunityScores.filter((o) => canBuildPackage(o.pipeline_stage)).length;

  useEffect(() => {
    if (open) {
      loadOpportunities();
      setSelectedId("");
    }
  }, [open]);

  const loadOpportunities = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Only gigs the speaker has engaged with. Untouched "New" rows are every
      // scored lead in the system, and would bury the ones that matter.
      const { data, error } = await supabase
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
        .in("pipeline_stage", [...PACKAGE_UNLOCKED_STAGES, ...PACKAGE_LOCKED_STAGES])
        // opportunity_scores has no created_at. Ordering by it made this query
        // fail on every open, and the swallowed error showed as an empty list.
        .order("calculated_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Error loading package opportunities:", error);
        setLoadError(true);
        return;
      }

      // Ready-to-package gigs first, then the locked ones beneath them.
      const rows = (data || []).filter((d) => d.opportunities) as OpportunityScore[];
      rows.sort((a, b) => Number(canBuildPackage(b.pipeline_stage)) - Number(canBuildPackage(a.pipeline_stage)));
      setOpportunityScores(rows);
    } catch (error) {
      console.error("Error loading opportunities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePackage = () => {
    if (selectedScore && canBuildPackage(selectedScore.pipeline_stage)) {
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
              Create Speaker Package
            </DialogTitle>
            <DialogDescription>
              Your package is your pricing, contract and terms in one place, sent while you're
              negotiating. We'll email it to the organizer if we have their address, or give you a
              link to share yourself.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : loadError ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  We couldn't load your pipeline just now.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={loadOpportunities}>
                  Try again
                </Button>
              </div>
            ) : opportunityScores.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nothing in your pipeline is ready for a package yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Packages unlock at {PACKAGE_UNLOCK_STAGE_LABEL}. Move a gig there in your{" "}
                  <Link to="/pipeline" className="underline" onClick={() => onOpenChange(false)}>
                    Pipeline
                  </Link>
                  , or add your own gig.
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
                      {opportunityScores.map((opp) => {
                        const ready = canBuildPackage(opp.pipeline_stage);
                        return (
                          <SelectItem key={opp.id} value={opp.id} disabled={!ready}>
                            <span className={ready ? "" : "text-muted-foreground"}>
                              {!ready && <Lock className="inline h-3 w-3 mr-1 -mt-0.5" />}
                              {opp.opportunities?.event_name}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {readyCount < opportunityScores.length && (
                    <p className="text-xs text-muted-foreground">
                      Greyed-out gigs unlock once you move them to {PACKAGE_UNLOCK_STAGE_LABEL}.
                    </p>
                  )}
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
