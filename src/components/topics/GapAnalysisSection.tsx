import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Plus, ArrowRight } from "lucide-react";

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
}

interface GapAnalysisSectionProps {
  topicStats: TopicWithStats[];
  userTopics: Topic[];
  onAddTopic: (topicId: string) => void;
}

export function GapAnalysisSection({ topicStats, userTopics, onAddTopic }: GapAnalysisSectionProps) {
  // Find high-demand topics the user doesn't have
  const gapTopics = topicStats
    .filter(t => !t.userHas && t.count > 0)
    .slice(0, 8);

  // Calculate how many additional opportunities each would open
  const userTopicIds = new Set(userTopics.map(t => t.id));
  const currentCoverage = topicStats.filter(t => userTopicIds.has(t.id)).reduce((sum, t) => sum + t.count, 0);

  return (
    <Card className="p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-2">
        <Lightbulb className="h-5 w-5 text-amber-500" />
        Gap Analysis
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Topics you might consider adding based on market demand
      </p>

      {gapTopics.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-3">
          {gapTopics.map(topic => (
            <div 
              key={topic.id}
              className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{topic.name}</p>
                <p className="text-sm text-muted-foreground">
                  Would open <span className="font-semibold text-amber-700">{topic.count}</span> additional opportunities
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddTopic(topic.id)}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Great job! You've covered most high-demand topics.</p>
        </div>
      )}

      {gapTopics.length > 0 && (
        <div className="mt-4 p-3 bg-violet-50 rounded-lg">
          <p className="text-sm text-violet-900">
            <strong>Pro tip:</strong> Adding just the top 3 recommended topics could increase your opportunity matches by up to{" "}
            <span className="font-bold">
              {Math.round((gapTopics.slice(0, 3).reduce((sum, t) => sum + t.count, 0) / Math.max(currentCoverage, 1)) * 100)}%
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}
