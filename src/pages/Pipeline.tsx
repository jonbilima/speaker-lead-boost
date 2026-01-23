import { useEffect, useState, useCallback } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Kanban, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { PipelineDetailModal } from "@/components/pipeline/PipelineDetailModal";
import { PipelineOpportunity } from "@/components/pipeline/PipelineCard";
import { createFollowUpReminders, getUserFollowUpIntervals } from "@/hooks/useFollowUpReminders";

const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "border-gray-400", bgColor: "bg-gray-100" },
  { id: "interested", label: "Interested", color: "border-blue-400", bgColor: "bg-blue-100" },
  { id: "pitched", label: "Applied", color: "border-yellow-400", bgColor: "bg-yellow-100" },
  { id: "negotiating", label: "In Conversation", color: "border-purple-400", bgColor: "bg-purple-100" },
  { id: "accepted", label: "Accepted", color: "border-green-400", bgColor: "bg-green-100" },
  { id: "rejected", label: "Rejected", color: "border-red-400", bgColor: "bg-red-100" },
];

const Pipeline = () => {
  const [opportunities, setOpportunities] = useState<PipelineOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpp, setSelectedOpp] = useState<PipelineOpportunity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadOpportunities = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("opportunity_scores")
      .select(`
        id,
        ai_score,
        ai_reason,
        pipeline_stage,
        calculated_at,
        opportunities (
          id,
          event_name,
          organizer_name,
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
      .order("ai_score", { ascending: false });

    if (error) {
      console.error("Error loading pipeline:", error);
      toast.error("Failed to load pipeline");
    } else {
      const formatted: PipelineOpportunity[] = (data || []).map((score: any) => ({
        id: score.opportunities.id,
        score_id: score.id,
        event_name: score.opportunities.event_name,
        organizer_name: score.opportunities.organizer_name,
        description: score.opportunities.description,
        deadline: score.opportunities.deadline,
        event_date: score.opportunities.event_date,
        location: score.opportunities.location,
        fee_estimate_min: score.opportunities.fee_estimate_min,
        fee_estimate_max: score.opportunities.fee_estimate_max,
        event_url: score.opportunities.event_url,
        ai_score: score.ai_score,
        ai_reason: score.ai_reason,
        pipeline_stage: score.pipeline_stage || "new",
        calculated_at: score.calculated_at,
      }));
      setOpportunities(formatted);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    // Dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStage = destination.droppableId as "new" | "interested" | "pitched" | "negotiating" | "accepted" | "rejected" | "researching" | "completed";

    // Optimistically update UI
    setOpportunities((prev) =>
      prev.map((opp) =>
        opp.score_id === draggableId ? { ...opp, pipeline_stage: newStage } : opp
      )
    );

    // Update in database
    const updateData: Record<string, any> = {
      pipeline_stage: newStage,
    };
    
    if (newStage === "interested") updateData.interested_at = new Date().toISOString();
    if (newStage === "accepted") updateData.accepted_at = new Date().toISOString();
    if (newStage === "rejected") updateData.rejected_at = new Date().toISOString();
    if (newStage === "completed") updateData.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from("opportunity_scores")
      .update(updateData)
      .eq("id", draggableId);

    if (error) {
      console.error("Error updating pipeline stage:", error);
      toast.error("Failed to update stage");
      // Revert on error
      loadOpportunities();
    } else {
      // Log the stage change as an activity
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const stageLabel = PIPELINE_STAGES.find((s) => s.id === newStage)?.label || newStage;
        await supabase.from("outreach_activities").insert({
          match_id: draggableId,
          speaker_id: session.user.id,
          activity_type: "note",
          notes: `Moved to "${stageLabel}" stage`,
        });

        // Create follow-up reminders when moved to "pitched" (Applied) stage
        if (newStage === "pitched") {
          try {
            const intervals = await getUserFollowUpIntervals(session.user.id);
            await createFollowUpReminders(
              session.user.id,
              draggableId,
              new Date(),
              intervals
            );
            toast.success("Follow-up reminders created for 7, 14, and 21 days");
          } catch (reminderError) {
            console.error("Error creating follow-up reminders:", reminderError);
          }
        }
      }
      toast.success(`Moved to ${PIPELINE_STAGES.find((s) => s.id === newStage)?.label}`);
    }
  };

  const getOpportunitiesByStage = (stageId: string) => {
    return opportunities.filter((opp) => opp.pipeline_stage === stageId);
  };

  const handleCardClick = (opp: PipelineOpportunity) => {
    setSelectedOpp(opp);
    setModalOpen(true);

    // Mark as viewed if not already
    if (!opportunities.find((o) => o.score_id === opp.score_id)) return;
    
    supabase
      .from("opportunity_scores")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", opp.score_id)
      .then(({ error }) => {
        if (error) console.error("Error marking as viewed:", error);
      });
  };

  const stats = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: getOpportunitiesByStage(stage.id).length,
  }));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Kanban className="h-6 w-6 text-violet-600" />
              Outreach Pipeline
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your speaking opportunities through each stage
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadOpportunities}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((stage) => (
            <Card key={stage.id} className={`p-3 ${stage.bgColor}`}>
              <div className="text-2xl font-bold">{stage.count}</div>
              <div className="text-sm text-muted-foreground">{stage.label}</div>
            </Card>
          ))}
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        ) : opportunities.length === 0 ? (
          <Card className="p-12 text-center">
            <Kanban className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-2">No opportunities in your pipeline</h3>
            <p className="text-sm text-muted-foreground">
              Complete your profile and we'll match you with speaking opportunities
            </p>
          </Card>
        ) : (
          <div className="overflow-x-auto pb-4">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-4 min-w-max">
                {PIPELINE_STAGES.map((stage) => (
                  <PipelineColumn
                    key={stage.id}
                    stage={stage}
                    opportunities={getOpportunitiesByStage(stage.id)}
                    onCardClick={handleCardClick}
                  />
                ))}
              </div>
            </DragDropContext>
          </div>
        )}
      </div>

      <PipelineDetailModal
        opportunity={selectedOpp}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onActivityLogged={loadOpportunities}
      />
    </AppLayout>
  );
};

export default Pipeline;
