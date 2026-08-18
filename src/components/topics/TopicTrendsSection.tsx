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
  // Get top 5 topics referenced in the summary below
  const topTopics = topicStats.filter(t => t.count > 0).slice(0, 5);

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
          {/* Trend chart hidden: no historical topic-demand data is stored yet */}
          <p className="text-sm text-muted-foreground mb-6">
            Trend charts will appear once there is enough history of topic demand.
          </p>

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
