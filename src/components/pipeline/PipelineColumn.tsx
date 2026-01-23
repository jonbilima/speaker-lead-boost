import { Droppable } from "@hello-pangea/dnd";
import { PipelineCard, PipelineOpportunity } from "./PipelineCard";

interface PipelineColumnProps {
  stage: {
    id: string;
    label: string;
    color: string;
    bgColor: string;
  };
  opportunities: PipelineOpportunity[];
  onCardClick: (opportunity: PipelineOpportunity) => void;
  onResearchOrganizer?: (organizerName: string, organizerEmail?: string | null) => void;
}

export function PipelineColumn({ stage, opportunities, onCardClick, onResearchOrganizer }: PipelineColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      <div className={`${stage.bgColor} rounded-t-lg px-3 py-2 border-b-2 ${stage.color}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{stage.label}</h3>
          <span className="bg-white/80 text-xs px-2 py-0.5 rounded-full font-medium">
            {opportunities.length}
          </span>
        </div>
      </div>

      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-[400px] p-2 bg-muted/30 rounded-b-lg transition-colors ${
              snapshot.isDraggingOver ? "bg-violet-50" : ""
            }`}
          >
            {opportunities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                Drop opportunities here
              </div>
            ) : (
              opportunities.map((opp, index) => (
                <PipelineCard
                  key={opp.score_id}
                  opportunity={opp}
                  index={index}
                  onClick={() => onCardClick(opp)}
                  onResearchOrganizer={onResearchOrganizer}
                />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
