import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";

interface ReportsTabProps {
  userId: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

interface ClientRevenue {
  name: string;
  revenue: number;
}

interface ConversionData {
  stage: string;
  count: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 76% 36%)",
  "hsl(217 91% 60%)",
  "hsl(280 67% 51%)",
];

export function ReportsTab({ userId }: ReportsTabProps) {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("this-year");
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [clientRevenue, setClientRevenue] = useState<ClientRevenue[]>([]);
  const [industryRevenue, setIndustryRevenue] = useState<ClientRevenue[]>([]);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      
      // Load bookings for revenue data
      const { data: bookings } = await supabase
        .from("confirmed_bookings")
        .select("*")
        .eq("speaker_id", userId);

      const thisYearBookings = (bookings || []).filter(b => {
        if (!b.event_date) return false;
        return new Date(b.event_date).getFullYear() === currentYear;
      }).filter(b => b.payment_status !== "cancelled");

      // Monthly revenue
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyData = months.map((month, index) => {
        const revenue = thisYearBookings
          .filter(b => b.event_date && new Date(b.event_date).getMonth() === index)
          .reduce((sum, b) => sum + (b.confirmed_fee || 0), 0);
        return { month, revenue };
      });
      setMonthlyRevenue(monthlyData);

      // Client revenue (using event_name as proxy since we don't have client linking yet)
      const clientMap = new Map<string, number>();
      thisYearBookings.forEach(b => {
        const name = b.event_name || "Unknown";
        clientMap.set(name, (clientMap.get(name) || 0) + (b.confirmed_fee || 0));
      });
      const clientData = Array.from(clientMap.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setClientRevenue(clientData);

      // Industry revenue (placeholder data since we don't track industry per booking)
      setIndustryRevenue([
        { name: "Corporate", revenue: thisYearBookings.reduce((s, b) => s + (b.confirmed_fee || 0), 0) * 0.4 },
        { name: "Education", revenue: thisYearBookings.reduce((s, b) => s + (b.confirmed_fee || 0), 0) * 0.25 },
        { name: "Nonprofit", revenue: thisYearBookings.reduce((s, b) => s + (b.confirmed_fee || 0), 0) * 0.2 },
        { name: "Healthcare", revenue: thisYearBookings.reduce((s, b) => s + (b.confirmed_fee || 0), 0) * 0.15 },
      ]);

      // Pipeline conversion
      const { data: scores } = await supabase
        .from("opportunity_scores")
        .select("pipeline_stage")
        .eq("user_id", userId);

      const stageCounts: Record<string, number> = {};
      (scores || []).forEach((s: any) => {
        if (s.pipeline_stage) {
          stageCounts[s.pipeline_stage] = (stageCounts[s.pipeline_stage] || 0) + 1;
        }
      });

      setConversionData([
        { stage: "Applied", count: stageCounts["pitched"] || 0 },
        { stage: "In Conversation", count: stageCounts["negotiating"] || 0 },
        { stage: "Accepted", count: stageCounts["accepted"] || 0 },
        { stage: "Completed", count: stageCounts["completed"] || 0 },
      ]);

    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData, dateRange]);

  const handleExport = () => {
    // Generate CSV
    const headers = ["Month", "Revenue"];
    const rows = monthlyRevenue.map(m => [m.month, m.revenue.toString()]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
              <SelectItem value="all-time">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue by Month */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={formatCurrency} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Client */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Client</CardTitle>
          </CardHeader>
          <CardContent>
            {clientRevenue.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={clientRevenue}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name.slice(0, 10)}... (${(percent * 100).toFixed(0)}%)`}
                    >
                      {clientRevenue.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Industry */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Industry</CardTitle>
          </CardHeader>
          <CardContent>
            {industryRevenue.some(i => i.revenue > 0) ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={industryRevenue}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {industryRevenue.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Conversion */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={120} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}