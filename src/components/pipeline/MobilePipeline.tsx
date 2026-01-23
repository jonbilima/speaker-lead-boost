import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  MapPin, 
  DollarSign, 
  ChevronLeft, 
  ChevronRight,
  Building2,
  Check,
  X
} from "lucide-react";
import { PipelineOpportunity } from "./PipelineCard";
import { cn } from "@/lib/utils";

interface MobilePipelineProps {
  stages: Array<{
    id: string;
    label: string;
    color: string;
    bgColor: string;
  }>;
  opportunities: PipelineOpportunity[];
  currentStage: string;
  onStageChange: (stageId: string) => void;
  onCardClick: (opp: PipelineOpportunity) => void;
  onMoveToStage: (oppId: string, newStage: string) => void;
  onResearchOrganizer?: (organizerName: string, organizerEmail?: string | null) => void;
}

export function MobilePipeline({
  stages,
  opportunities,
  currentStage,
  onStageChange,
  onCardClick,
  onMoveToStage,
  onResearchOrganizer,
}: MobilePipelineProps) {
  const currentIndex = stages.findIndex(s => s.id === currentStage);
  const stageOpps = opportunities.filter(o => o.pipeline_stage === currentStage);

  const goToStage = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < stages.length) {
      onStageChange(stages[newIndex].id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stage Navigator */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goToStage("prev")}
          disabled={currentIndex === 0}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 justify-center">
            {stages.map((stage, i) => {
              const count = opportunities.filter(o => o.pipeline_stage === stage.id).length;
              return (
                <button
                  key={stage.id}
                  onClick={() => onStageChange(stage.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                    currentStage === stage.id
                      ? `${stage.bgColor} ${stage.color.replace('border-', 'text-').replace('-400', '-700')}`
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {stage.label}
                  {count > 0 && (
                    <span className="ml-1.5 bg-background/80 px-1.5 py-0.5 rounded-full text-[10px]">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goToStage("next")}
          disabled={currentIndex === stages.length - 1}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {stageOpps.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No opportunities in this stage</p>
            <p className="text-xs mt-1">Swipe left/right to navigate stages</p>
          </Card>
        ) : (
          stageOpps.map((opp) => (
            <MobileOpportunityCard
              key={opp.score_id}
              opportunity={opp}
              onClick={() => onCardClick(opp)}
              onAdvance={() => {
                const nextIndex = currentIndex + 1;
                if (nextIndex < stages.length) {
                  onMoveToStage(opp.score_id, stages[nextIndex].id);
                }
              }}
              onReject={() => onMoveToStage(opp.score_id, "rejected")}
              onResearch={onResearchOrganizer}
              canAdvance={currentIndex < stages.length - 1 && currentStage !== "rejected"}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface MobileOpportunityCardProps {
  opportunity: PipelineOpportunity;
  onClick: () => void;
  onAdvance: () => void;
  onReject: () => void;
  onResearch?: (name: string, email?: string | null) => void;
  canAdvance: boolean;
}

function MobileOpportunityCard({
  opportunity,
  onClick,
  onAdvance,
  onReject,
  onResearch,
  canAdvance,
}: MobileOpportunityCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const threshold = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;
    // Limit the swipe distance
    const limitedDiff = Math.max(-120, Math.min(120, diff));
    setSwipeX(limitedDiff);
  };

  const handleTouchEnd = () => {
    if (swipeX > threshold && canAdvance) {
      onAdvance();
    } else if (swipeX < -threshold) {
      onReject();
    }
    setSwipeX(0);
    setIsSwiping(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-400";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatFee = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    if (min && max) return `$${(min / 1000).toFixed(0)}k-$${(max / 1000).toFixed(0)}k`;
    if (min) return `$${(min / 1000).toFixed(0)}k+`;
    return `Up to $${((max || 0) / 1000).toFixed(0)}k`;
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe Background Indicators */}
      <div className="absolute inset-0 flex">
        <div 
          className={cn(
            "flex-1 flex items-center justify-start pl-4 transition-opacity",
            swipeX < -20 ? "bg-red-100 dark:bg-red-950" : "bg-transparent"
          )}
          style={{ opacity: Math.min(1, Math.abs(swipeX) / threshold) }}
        >
          {swipeX < -20 && <X className="h-6 w-6 text-red-600" />}
        </div>
        <div 
          className={cn(
            "flex-1 flex items-center justify-end pr-4 transition-opacity",
            swipeX > 20 ? "bg-green-100 dark:bg-green-950" : "bg-transparent"
          )}
          style={{ opacity: Math.min(1, Math.abs(swipeX) / threshold) }}
        >
          {swipeX > 20 && <Check className="h-6 w-6 text-green-600" />}
        </div>
      </div>

      {/* Card Content */}
      <Card
        className="relative transition-transform touch-pan-y"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onClick}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Score Badge */}
            <div className={cn(
              "h-12 w-12 rounded-lg flex items-center justify-center shrink-0",
              getScoreColor(opportunity.ai_score)
            )}>
              <span className="text-lg font-bold text-white">{opportunity.ai_score}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm line-clamp-2">{opportunity.event_name}</h4>
              
              {opportunity.organizer_name && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground truncate">
                    {opportunity.organizer_name}
                  </p>
                  {onResearch && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1.5 text-[10px] text-violet-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResearch(opportunity.organizer_name!, opportunity.organizer_email);
                      }}
                    >
                      <Building2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}

              {/* Key Info Row */}
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                {opportunity.event_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(opportunity.event_date)}</span>
                  </div>
                )}
                {formatFee(opportunity.fee_estimate_min, opportunity.fee_estimate_max) && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    <span>{formatFee(opportunity.fee_estimate_min, opportunity.fee_estimate_max)}</span>
                  </div>
                )}
                {opportunity.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate max-w-[100px]">{opportunity.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Swipe Hint */}
          <div className="mt-3 text-center text-[10px] text-muted-foreground/60">
            Swipe right to advance • Swipe left to pass
          </div>
        </div>
      </Card>
    </div>
  );
}
