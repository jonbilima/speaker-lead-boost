import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface Topic {
  id: string;
  name: string;
  category: string | null;
}

interface TopicWithStats {
  id: string;
  name: string;
  count: number;
  userHas: boolean;
  trend: 'up' | 'down' | 'stable';
}

interface TopicsMatchWidgetProps {
  matchPercentage: number;
  userTopics: Topic[];
  topicStats: TopicWithStats[];
}

export function TopicsMatchWidget({ matchPercentage, userTopics, topicStats }: TopicsMatchWidgetProps) {
  // Get user's topics sorted by event count
  const userTopicsWithCounts = userTopics
    .map(topic => {
      const stat = topicStats.find(t => t.id === topic.id);
      return {
        ...topic,
        count: stat?.count || 0
      };
    })
    .sort((a, b) => b.count - a.count);

  const topMatching = userTopicsWithCounts.filter(t => t.count > 0).slice(0, 5);

  const chartData = [
    { name: 'Match', value: matchPercentage },
    { name: 'Gap', value: 100 - matchPercentage }
  ];

  const COLORS = ['#8B5CF6', '#E5E7EB'];

  return (
    <Card className="p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-violet-600" />
        Your Topics Match
      </h3>

      <div className="flex items-center gap-6">
        {/* Donut Chart */}
        <div className="relative w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={35}
                outerRadius={50}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-2xl font-bold">{matchPercentage}%</span>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-3">
            Your topics match <span className="font-semibold text-foreground">{matchPercentage}%</span> of current opportunities
          </p>
          
          {topMatching.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Top matching topics:</p>
              <div className="space-y-1">
                {topMatching.slice(0, 3).map(topic => (
                  <div key={topic.id} className="flex items-center justify-between text-sm">
                    <span>{topic.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {topic.count} events
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
