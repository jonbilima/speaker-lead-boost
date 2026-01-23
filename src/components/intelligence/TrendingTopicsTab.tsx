import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Minus, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TopicTrend {
  name: string;
  count: number;
  trend: "up" | "down" | "stable";
  change: number;
}

export function TrendingTopicsTab() {
  const [topics, setTopics] = useState<TopicTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTopics = async () => {
      // Get topics from opportunity_topics with counts
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

      // Count occurrences of each topic
      const topicCounts: Record<string, { name: string; count: number }> = {};
      
      (topicData || []).forEach((item: any) => {
        const topicName = item.topics?.name;
        if (topicName) {
          if (!topicCounts[topicName]) {
            topicCounts[topicName] = { name: topicName, count: 0 };
          }
          topicCounts[topicName].count++;
        }
      });

      // Convert to array and add mock trend data
      const topicsArray: TopicTrend[] = Object.values(topicCounts)
        .map((topic) => ({
          name: topic.name,
          count: topic.count,
          // Simulate trend data (in real app, would compare with historical data)
          trend: (Math.random() > 0.6 ? "up" : Math.random() > 0.3 ? "stable" : "down") as "up" | "down" | "stable",
          change: Math.floor(Math.random() * 30),
        }))
        .sort((a, b) => b.count - a.count);

      setTopics(topicsArray);
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
          We're analyzing event data to identify trending speaking topics. 
          Check back soon for insights on what topics are in demand.
        </p>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
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

              <div className="flex items-center gap-2">
                {topic.trend === "up" && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{topic.change}%
                  </Badge>
                )}
                {topic.trend === "down" && (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    -{topic.change}%
                  </Badge>
                )}
                {topic.trend === "stable" && (
                  <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                    <Minus className="h-3 w-3 mr-1" />
                    Stable
                  </Badge>
                )}
              </div>

              {/* Visual bar */}
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    topic.trend === "up" ? "bg-green-500" : 
                    topic.trend === "down" ? "bg-red-400" : "bg-gray-400"
                  )}
                  style={{
                    width: `${Math.min((topic.count / (topics[0]?.count || 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
