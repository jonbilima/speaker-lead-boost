import { Droppable } from "@hello-pangea/dnd";
import { Checkbox } from "@/components/ui/checkbox";
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
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (scoreId: string) => void;
  isAllSelected?: boolean;
  onToggleSelectAll?: () => void;
  tags?: { id: string; name: string; color: string }[];
}

export function PipelineColumn({ 
  stage, 
  opportunities, 
  onCardClick, 
  onResearchOrganizer,
  selectionMode,
  selectedIds,
  onToggleSelection,
  isAllSelected,
  onToggleSelectAll,
  tags,
}: PipelineColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      <div className={`${stage.bgColor} dark:bg-opacity-20 rounded-t-lg px-3 py-2 border-b-2 ${stage.color}`}>
        <div className="flex items-center justify-between">
          {selectionMode && opportunities.length > 0 && (
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={onToggleSelectAll}
              className="mr-2"
            />
          )}
          <h3 className="font-medium text-sm flex-1">{stage.label}</h3>
          <span className="bg-white/80 dark:bg-white/20 text-xs px-2 py-0.5 rounded-full font-medium">
            {opportunities.length}
          </span>
        </div>
      </div>

      <Droppable droppableId={stage.id} isDropDisabled={selectionMode}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-[400px] p-2 bg-muted/30 rounded-b-lg transition-colors ${
              snapshot.isDraggingOver ? "bg-violet-50 dark:bg-violet-900/20" : ""
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
                  selectionMode={selectionMode}
                  isSelected={selectedIds?.has(opp.score_id)}
                  onToggleSelection={onToggleSelection}
                  tags={tags}
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
