import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartBar, Check } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface TopicWithStats {
  id: string;
  name: string;
  count: number;
  userHas: boolean;
  trend: 'up' | 'down' | 'stable';
}

interface TopicDemandChartProps {
  topicStats: TopicWithStats[];
}

export function TopicDemandChart({ topicStats }: TopicDemandChartProps) {
  // Take top 15 topics by demand
  const chartData = topicStats
    .filter(t => t.count > 0)
    .slice(0, 15)
    .map(topic => ({
      name: topic.name.length > 20 ? topic.name.substring(0, 20) + '...' : topic.name,
      fullName: topic.name,
      count: topic.count,
      userHas: topic.userHas
    }));

  const userTopicsCount = chartData.filter(t => t.userHas).length;
  const totalInChart = chartData.length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ChartBar className="h-5 w-5 text-violet-600" />
          Topic Demand
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-violet-600" />
            <span>Your topics</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-300" />
            <span>Other topics</span>
          </div>
          <Badge variant="outline">
            You have {userTopicsCount}/{totalInChart} top topics
          </Badge>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
              <XAxis type="number" />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border rounded-lg shadow-lg p-3">
                        <p className="font-medium">{data.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {data.count} events
                        </p>
                        {data.userHas && (
                          <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                            <Check className="h-3 w-3" /> You have this topic
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.userHas ? '#8B5CF6' : '#D1D5DB'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center text-muted-foreground">
          No topic demand data available
        </div>
      )}
    </Card>
  );
}
