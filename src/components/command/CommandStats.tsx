import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CommandStatsProps {
  revenue: number;
  revenueGoal: number;
  newMatches: number;
  matchesTrend: "up" | "down" | "flat";
  activePipeline: number;
  responseRate: number;
  responseRateTrend: "up" | "down" | "flat";
}

export function CommandStats({
  revenue,
  revenueGoal,
  newMatches,
  matchesTrend,
  activePipeline,
  responseRate,
  responseRateTrend,
}: CommandStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const revenueProgress = Math.min((revenue / revenueGoal) * 100, 100);

  const TrendIcon = ({ trend }: { trend: "up" | "down" | "flat" }) => {
    if (trend === "up") return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-3 w-3 text-destructive" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Revenue */}
      <Card className="border-primary/10">
        <CardContent className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-1">Revenue</div>
          <div className="text-lg font-bold">
            {formatCurrency(revenue)}
            <span className="text-muted-foreground font-normal text-sm"> of {formatCurrency(revenueGoal)}</span>
          </div>
          <Progress value={revenueProgress} className="h-1.5 mt-2" />
        </CardContent>
      </Card>

      {/* New Matches */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-1">New Matches</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{newMatches}</span>
            <span className="text-sm text-muted-foreground">this week</span>
            <TrendIcon trend={matchesTrend} />
          </div>
        </CardContent>
      </Card>

      {/* Active Pipeline */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-1">Active Pipeline</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{activePipeline}</span>
            <span className="text-sm text-muted-foreground">opportunities</span>
          </div>
        </CardContent>
      </Card>

      {/* Response Rate */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-1">Response Rate</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{responseRate}%</span>
            <TrendIcon trend={responseRateTrend} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
