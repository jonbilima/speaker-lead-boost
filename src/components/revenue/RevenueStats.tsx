import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Target, Percent, Calculator, Calendar } from "lucide-react";

interface RevenueStatsProps {
  totalConfirmed: number;
  totalReceived: number;
  pipelineValue: number;
  winRate: number;
  averageFee: number;
  bookingsThisYear: number;
}

export function RevenueStats({
  totalConfirmed,
  totalReceived,
  pipelineValue,
  winRate,
  averageFee,
  bookingsThisYear,
}: RevenueStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const stats = [
    {
      label: "Total Confirmed",
      value: formatCurrency(totalConfirmed),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Total Received",
      value: formatCurrency(totalReceived),
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      label: "Pipeline Value",
      value: formatCurrency(pipelineValue),
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      icon: Percent,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      label: "Average Fee",
      value: formatCurrency(averageFee),
      icon: Calculator,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      label: "Bookings This Year",
      value: bookingsThisYear.toString(),
      icon: Calendar,
      color: "text-violet-600",
      bgColor: "bg-violet-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <div className="text-xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
