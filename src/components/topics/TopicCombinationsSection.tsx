import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, Plus, Check } from "lucide-react";

interface Topic {
  id: string;
  name: string;
}

interface TopicCombination {
  topic1: string;
  topic2: string;
  count: number;
}

interface TopicCombinationsSectionProps {
  combinations: TopicCombination[];
  userTopics: Topic[];
  onAddTopic: (topicId: string) => void;
  allTopics: Topic[];
}

export function TopicCombinationsSection({ 
  combinations, 
  userTopics, 
  onAddTopic,
  allTopics 
}: TopicCombinationsSectionProps) {
  const userTopicNames = new Set(userTopics.map(t => t.name));

  // Find combinations where user has one topic but not the other
  const relevantCombinations = combinations.filter(combo => {
    const hasTopic1 = userTopicNames.has(combo.topic1);
    const hasTopic2 = userTopicNames.has(combo.topic2);
    return (hasTopic1 && !hasTopic2) || (!hasTopic1 && hasTopic2);
  }).slice(0, 5);

  // Find topic ID by name
  const getTopicId = (name: string) => allTopics.find(t => t.name === name)?.id;

  return (
    <Card className="p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-2">
        <Link className="h-5 w-5 text-violet-600" />
        Topic Combinations
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Topics that frequently appear together in event requirements
      </p>

      {combinations.length > 0 ? (
        <div className="space-y-4">
          {/* Top Combinations */}
          <div className="grid md:grid-cols-2 gap-3">
            {combinations.slice(0, 6).map((combo, idx) => {
              const hasTopic1 = userTopicNames.has(combo.topic1);
              const hasTopic2 = userTopicNames.has(combo.topic2);
              
              return (
                <div 
                  key={idx}
                  className="p-3 bg-muted/50 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={hasTopic1 ? "default" : "outline"} className={hasTopic1 ? "bg-violet-600" : ""}>
                      {combo.topic1}
                      {hasTopic1 && <Check className="h-3 w-3 ml-1" />}
                    </Badge>
                    <span className="text-muted-foreground">+</span>
                    <Badge variant={hasTopic2 ? "default" : "outline"} className={hasTopic2 ? "bg-violet-600" : ""}>
                      {combo.topic2}
                      {hasTopic2 && <Check className="h-3 w-3 ml-1" />}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {combo.count} events
                  </span>
                </div>
              );
            })}
          </div>

          {/* Suggestions based on user's topics */}
          {relevantCombinations.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Recommended based on your topics:</h4>
              <div className="space-y-2">
                {relevantCombinations.map((combo, idx) => {
                  const hasTopic1 = userTopicNames.has(combo.topic1);
                  const missingTopic = hasTopic1 ? combo.topic2 : combo.topic1;
                  const userTopic = hasTopic1 ? combo.topic1 : combo.topic2;
                  const missingTopicId = getTopicId(missingTopic);

                  return (
                    <div 
                      key={idx}
                      className="p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg flex items-center justify-between"
                    >
                      <p className="text-sm">
                        Events looking for <span className="font-semibold">{userTopic}</span> often also want{" "}
                        <span className="font-semibold text-violet-700">{missingTopic}</span>
                      </p>
                      {missingTopicId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onAddTopic(missingTopicId)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <Link className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Not enough data to analyze topic combinations yet</p>
        </div>
      )}
    </Card>
  );
}
