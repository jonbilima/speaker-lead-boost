import { Card } from "@/components/ui/card";
import { Calendar, CheckCircle, Send, TrendingUp } from "lucide-react";

interface DashboardStatsProps {
  todayCount: number;
  weekCount: number;
  appliedCount: number;
  acceptedCount: number;
}

export const DashboardStats = ({ 
  todayCount, 
  weekCount, 
  appliedCount, 
  acceptedCount 
}: DashboardStatsProps) => {
  const stats = [
    {
      label: "Today's Opportunities",
      value: todayCount,
      icon: TrendingUp,
      color: "text-blue-500"
    },
    {
      label: "This Week",
      value: weekCount,
      icon: Calendar,
      color: "text-violet-500"
    },
    {
      label: "Applied",
      value: appliedCount,
      icon: Send,
      color: "text-orange-500"
    },
    {
      label: "Accepted",
      value: acceptedCount,
      icon: CheckCircle,
      color: "text-green-500"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5">
          <div className="flex items-center justify-between mb-2">
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </div>
          <div className="text-3xl font-bold">{stat.value}</div>
          <div className="text-sm text-muted-foreground">{stat.label}</div>
        </Card>
      ))}
    </div>
  );
};
