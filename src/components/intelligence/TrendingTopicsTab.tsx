import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TopicCount {
  name: string;
  count: number;
}

export function TrendingTopicsTab() {
  const [topics, setTopics] = useState<TopicCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTopics = async () => {
      const { data: topicData, error } = await supabase
        .from("opportunity_topics")
        .select(`
          topic_id,
          topics (
            name
          )
        `);

      if (error) {
        console.error("Error loading topics:", error);
        setLoading(false);
        return;
      }

      const topicCounts: Record<string, number> = {};

      interface TopicDataRow {
        topics: { name: string } | null;
      }
      (topicData as TopicDataRow[] || []).forEach((item) => {
        const topicName = item.topics?.name;
        if (topicName) {
          topicCounts[topicName] = (topicCounts[topicName] ?? 0) + 1;
        }
      });

      setTopics(
        Object.entries(topicCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      );
      setLoading(false);
    };

    loadTopics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Hash className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h3 className="font-semibold text-lg mb-2">Building Topic Trends</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          We're analyzing event data to identify in-demand speaking topics.
          Check back soon for insights.
        </p>
      </Card>
    );
  }

  const maxCount = topics[0]?.count || 1;

  return (
    <ScrollArea className="h-[600px]">
      <p className="text-xs text-muted-foreground mb-3">
        Ranked by how many current opportunities request each topic. Movement over time
        will appear once enough history is collected.
      </p>
      <div className="space-y-2">
        {topics.map((topic, index) => (
          <Card key={topic.name} className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </div>

              <div className="flex-1">
                <h4 className="font-medium">{topic.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {topic.count} event{topic.count !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min((topic.count / maxCount) * 100, 100)}%` }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
