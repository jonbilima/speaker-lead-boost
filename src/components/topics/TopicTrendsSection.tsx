import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, LineChart as LineChartIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface TopicWithStats {
  id: string;
  name: string;
  count: number;
  userHas: boolean;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface TopicTrendsSectionProps {
  topicStats: TopicWithStats[];
}

export function TopicTrendsSection({ topicStats }: TopicTrendsSectionProps) {
  // Generate mock trend data for visualization (in production, this would come from historical data)
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  
  // Get top 5 topics for trend visualization
  const topTopics = topicStats.filter(t => t.count > 0).slice(0, 5);
  
  // Create trend data (simulated based on current count and trend)
  const trendData = months.map((month, idx) => {
    const dataPoint: Record<string, number | string> = { month };
    topTopics.forEach(topic => {
      // Simulate historical values based on trend
      const baseValue = topic.count;
      let multiplier = 1;
      if (topic.trend === 'up') {
        multiplier = 0.6 + (idx * 0.08); // Growing trend
      } else if (topic.trend === 'down') {
        multiplier = 1.2 - (idx * 0.04); // Declining trend
      } else {
        multiplier = 0.9 + (Math.random() * 0.2); // Stable with slight variation
      }
      dataPoint[topic.name] = Math.round(baseValue * multiplier);
    });
    return dataPoint;
  });

  const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

  // Categorize topics by trend
  const risingTopics = topicStats.filter(t => t.trend === 'up' && t.count > 0).slice(0, 5);
  const fallingTopics = topicStats.filter(t => t.trend === 'down' && t.count > 0).slice(0, 5);
  const stableTopics = topicStats.filter(t => t.trend === 'stable' && t.count > 0).slice(0, 5);

  return (
    <Card className="p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <LineChartIcon className="h-5 w-5 text-violet-600" />
        Topic Trends (Last 6 Months)
      </h3>

      {topTopics.length > 0 ? (
        <>
          {/* Trend Chart */}
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                {topTopics.map((topic, idx) => (
                  <Line
                    key={topic.id}
                    type="monotone"
                    dataKey={topic.name}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-6">
            {topTopics.map((topic, idx) => (
              <div key={topic.id} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span>{topic.name}</span>
                {topic.userHas && (
                  <Badge variant="outline" className="text-xs">You</Badge>
                )}
              </div>
            ))}
          </div>

          {/* Trend Summary */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Rising */}
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800 flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4" />
                Rising
              </h4>
              <div className="space-y-1">
                {risingTopics.length > 0 ? risingTopics.map(topic => (
                  <div key={topic.id} className="flex items-center justify-between text-sm">
                    <span className={topic.userHas ? "font-medium" : ""}>{topic.name}</span>
                    <span className="text-green-600">+{Math.round(topic.trendValue)}%</span>
                  </div>
                )) : (
                  <p className="text-sm text-green-700 opacity-70">No rising topics detected</p>
                )}
              </div>
            </div>

            {/* Stable */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-800 flex items-center gap-2 mb-2">
                <Minus className="h-4 w-4" />
                Stable
              </h4>
              <div className="space-y-1">
                {stableTopics.length > 0 ? stableTopics.map(topic => (
                  <div key={topic.id} className="flex items-center justify-between text-sm">
                    <span className={topic.userHas ? "font-medium" : ""}>{topic.name}</span>
                    <span className="text-gray-500">~0%</span>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">No data</p>
                )}
              </div>
            </div>

            {/* Falling */}
            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="font-medium text-red-800 flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4" />
                Declining
              </h4>
              <div className="space-y-1">
                {fallingTopics.length > 0 ? fallingTopics.map(topic => (
                  <div key={topic.id} className="flex items-center justify-between text-sm">
                    <span className={topic.userHas ? "font-medium" : ""}>{topic.name}</span>
                    <span className="text-red-600">{Math.round(topic.trendValue)}%</span>
                  </div>
                )) : (
                  <p className="text-sm text-red-700 opacity-70">No declining topics</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <LineChartIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Not enough historical data to show trends</p>
        </div>
      )}
    </Card>
  );
}
