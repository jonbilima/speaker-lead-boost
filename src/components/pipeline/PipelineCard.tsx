import { Draggable } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, MapPin, DollarSign, Clock, Building2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FollowUpIndicator } from "./FollowUpIndicator";

export interface PipelineOpportunity {
  id: string;
  score_id: string;
  event_name: string;
  organizer_name: string | null;
  organizer_email?: string | null;
  description: string | null;
  deadline: string | null;
  event_date: string | null;
  location: string | null;
  fee_estimate_min: number | null;
  fee_estimate_max: number | null;
  event_url: string | null;
  ai_score: number;
  ai_reason: string | null;
  pipeline_stage: string;
  calculated_at: string;
  tags?: string[];
}

interface PipelineCardProps {
  opportunity: PipelineOpportunity;
  index: number;
  onClick: () => void;
  onResearchOrganizer?: (organizerName: string, organizerEmail?: string | null) => void;
  onOpenToolkit?: (context: any) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (scoreId: string) => void;
  tags?: { id: string; name: string; color: string }[];
}

export function PipelineCard({ 
  opportunity, 
  index, 
  onClick, 
  onResearchOrganizer,
  selectionMode,
  isSelected,
  onToggleSelection,
  tags,
}: PipelineCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500 text-white";
    if (score >= 60) return "bg-yellow-500 text-white";
    return "bg-red-400 text-white";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatFee = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `$${min.toLocaleString()}+`;
    return `Up to $${max?.toLocaleString()}`;
  };

  const handleResearchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (opportunity.organizer_name && onResearchOrganizer) {
      onResearchOrganizer(opportunity.organizer_name, opportunity.organizer_email);
    }
  };

  const handleClick = () => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(opportunity.score_id);
    } else {
      onClick();
    }
  };

  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(opportunity.score_id);
    }
  };

  // Find tag objects for this opportunity
  const opportunityTags = (opportunity.tags || [])
    .map((tagId) => tags?.find((t) => t.id === tagId))
    .filter(Boolean);

  return (
    <Draggable draggableId={opportunity.score_id} index={index} isDragDisabled={selectionMode}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={handleClick}
          className={`p-3 mb-2 cursor-pointer transition-all hover:shadow-md ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-violet-400" : ""
          } ${isSelected ? "ring-2 ring-primary bg-primary/5" : ""}`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            {selectionMode && (
              <div onClick={handleCheckboxChange} className="shrink-0 mt-0.5">
                <Checkbox checked={isSelected} />
              </div>
            )}
            <h4 className="font-medium text-sm line-clamp-2 flex-1">
              {opportunity.event_name}
            </h4>
            <Badge className={`${getScoreColor(opportunity.ai_score)} text-xs shrink-0`}>
              {opportunity.ai_score}
            </Badge>
          </div>

          {opportunity.organizer_name && (
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground line-clamp-1 flex-1">
                {opportunity.organizer_name}
              </p>
              {onResearchOrganizer && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                  onClick={handleResearchClick}
                >
                  <Building2 className="h-3 w-3 mr-1" />
                  Research
                </Button>
              )}
            </div>
          )}

          {/* Follow-up Indicator for Applied stage */}
          {opportunity.pipeline_stage === "pitched" && (
            <div className="mb-2">
              <FollowUpIndicator
                matchId={opportunity.score_id}
                pipelineStage={opportunity.pipeline_stage}
                compact
              />
            </div>
          )}

          <div className="space-y-1.5 text-xs text-muted-foreground">
            {opportunity.event_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(opportunity.event_date)}</span>
              </div>
            )}

            {opportunity.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                <span className="line-clamp-1">{opportunity.location}</span>
              </div>
            )}

            {formatFee(opportunity.fee_estimate_min, opportunity.fee_estimate_max) && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3 w-3" />
                <span>{formatFee(opportunity.fee_estimate_min, opportunity.fee_estimate_max)}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-muted-foreground/70">
              <Clock className="h-3 w-3" />
              <span>
                {formatDistanceToNow(new Date(opportunity.calculated_at), { addSuffix: true })}
              </span>
            </div>

            {/* Tags */}
            {opportunityTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {opportunityTags.map((tag) => (
                  <span
                    key={tag!.id}
                    className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: tag!.color }}
                  >
                    {tag!.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </Draggable>
  );
}
