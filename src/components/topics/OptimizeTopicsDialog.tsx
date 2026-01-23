import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, Minus, Check, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Topic {
  id: string;
  name: string;
}

interface TopicWithStats {
  id: string;
  name: string;
  count: number;
  userHas: boolean;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface OptimizeTopicsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicStats: TopicWithStats[];
  userTopics: Topic[];
  onAddTopic: (topicId: string) => void;
  onRemoveTopic: (topicId: string) => void;
  onSuccess: () => void;
}

export function OptimizeTopicsDialog({
  open,
  onOpenChange,
  topicStats,
  userTopics,
  onAddTopic,
  onRemoveTopic,
  onSuccess
}: OptimizeTopicsDialogProps) {
  const [appliedChanges, setAppliedChanges] = useState<Set<string>>(new Set());

  // Calculate suggestions
  const userTopicIds = new Set(userTopics.map(t => t.id));

  // Topics to add: high demand, rising trend, user doesn't have
  const toAdd = topicStats
    .filter(t => !t.userHas && t.count > 0 && t.trend !== 'down')
    .slice(0, 5);

  // Topics to consider removing: user has, declining trend, low demand
  const toConsiderRemoving = topicStats
    .filter(t => t.userHas && (t.trend === 'down' || t.count === 0))
    .slice(0, 3);

  // Calculate potential improvement
  const currentMatchCount = topicStats.filter(t => t.userHas && t.count > 0).length;
  const potentialNewMatches = toAdd.reduce((sum, t) => sum + t.count, 0);

  const handleApplyAdd = async (topicId: string) => {
    await onAddTopic(topicId);
    setAppliedChanges(prev => new Set(prev).add(`add-${topicId}`));
  };

  const handleApplyRemove = async (topicId: string) => {
    await onRemoveTopic(topicId);
    setAppliedChanges(prev => new Set(prev).add(`remove-${topicId}`));
  };

  const handleApplyAll = async () => {
    for (const topic of toAdd) {
      if (!appliedChanges.has(`add-${topic.id}`)) {
        await onAddTopic(topic.id);
      }
    }
    toast.success("All recommended topics added!");
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Optimize Your Topics
          </DialogTitle>
          <DialogDescription>
            AI-powered recommendations based on market demand and trends
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary */}
          <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg">
            <p className="text-sm">
              By following these recommendations, you could:
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Match <span className="font-bold">{potentialNewMatches}</span> more opportunities
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Align with rising industry trends
              </li>
            </ul>
          </div>

          {/* Topics to Add */}
          {toAdd.length > 0 && (
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Plus className="h-4 w-4 text-green-600" />
                Recommended to Add
              </h4>
              <div className="space-y-2">
                {toAdd.map(topic => (
                  <div 
                    key={topic.id}
                    className="p-3 bg-green-50 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{topic.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {topic.count} events
                      </Badge>
                      {topic.trend === 'up' && (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    {appliedChanges.has(`add-${topic.id}`) ? (
                      <Badge className="bg-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Added
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplyAdd(topic.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topics to Consider Removing */}
          {toConsiderRemoving.length > 0 && (
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Minus className="h-4 w-4 text-amber-600" />
                Consider Removing
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                These topics have low demand or declining interest
              </p>
              <div className="space-y-2">
                {toConsiderRemoving.map(topic => (
                  <div 
                    key={topic.id}
                    className="p-3 bg-amber-50 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{topic.name}</span>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {topic.count} events
                      </Badge>
                      {topic.trend === 'down' && (
                        <TrendingDown className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    {appliedChanges.has(`remove-${topic.id}`) ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Removed
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-amber-700 hover:text-red-600"
                        onClick={() => handleApplyRemove(topic.id)}
                      >
                        <Minus className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {toAdd.length === 0 && toConsiderRemoving.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Your topics are already well-optimized!</p>
              <p className="text-sm">No major changes recommended at this time.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {toAdd.length > 0 && (
            <Button 
              onClick={handleApplyAll}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Add All Recommended
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
