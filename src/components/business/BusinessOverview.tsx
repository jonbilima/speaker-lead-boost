import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { DollarSign, CalendarCheck, TrendingUp, FileText, Plus, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MonthlyRevenueChart } from "@/components/revenue/MonthlyRevenueChart";
import { AddBookingDialog } from "@/components/revenue/AddBookingDialog";

interface BusinessOverviewProps {
  userId: string;
}

interface MonthlyData {
  month: string;
  shortMonth: string;
  current: number;
  lastYear: number;
  projected?: number;
}

export function BusinessOverview({ userId }: BusinessOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState(100000);
  const [editingGoal, setEditingGoal] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [stats, setStats] = useState({
    totalRevenue: 0,
    bookingsCount: 0,
    averageFee: 0,
    outstandingInvoices: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [addBookingOpen, setAddBookingOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Load profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("annual_revenue_goal")
        .eq("id", userId)
        .single();

      if (profile?.annual_revenue_goal) {
        setGoal(profile.annual_revenue_goal);
      }

      // Load bookings
      const { data: bookings } = await supabase
        .from("confirmed_bookings")
        .select("*")
        .eq("speaker_id", userId);

      const thisYearBookings = (bookings || []).filter(b => {
        if (!b.event_date) return true;
        return new Date(b.event_date).getFullYear() === currentYear;
      }).filter(b => b.payment_status !== "cancelled");

      const totalRevenue = thisYearBookings.reduce((sum, b) => sum + (b.confirmed_fee || 0), 0);
      const averageFee = thisYearBookings.length > 0 ? totalRevenue / thisYearBookings.length : 0;

      // Load outstanding invoices - handle case where table might not exist yet
      let outstandingInvoices = 0;
      try {
        const { data: invoices } = await supabase
          .from("invoices")
          .select("total")
          .eq("speaker_id", userId)
          .in("status", ["sent", "overdue"]);

        outstandingInvoices = (invoices || []).reduce((sum, inv) => sum + (inv.total || 0), 0);
      } catch (e) {
        // Table might not exist yet
      }

      setStats({
        totalRevenue,
        bookingsCount: thisYearBookings.length,
        averageFee,
        outstandingInvoices,
      });

      // Monthly data
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentMonth = new Date().getMonth();

      const monthlyTotals: MonthlyData[] = months.map((month, index) => {
        const currentMonthRevenue = (bookings || [])
          .filter(b => {
            if (!b.event_date || b.payment_status === "cancelled") return false;
            const date = new Date(b.event_date);
            return date.getFullYear() === currentYear && date.getMonth() === index;
          })
          .reduce((sum, b) => sum + (b.confirmed_fee || 0), 0);

        const lastYearRevenue = (bookings || [])
          .filter(b => {
            if (!b.event_date || b.payment_status === "cancelled") return false;
            const date = new Date(b.event_date);
            return date.getFullYear() === lastYear && date.getMonth() === index;
          })
          .reduce((sum, b) => sum + (b.confirmed_fee || 0), 0);

        let projected: number | undefined;
        if (index > currentMonth && currentMonth > 0) {
          projected = totalRevenue / (currentMonth + 1);
        }

        return { month, shortMonth: shortMonths[index], current: currentMonthRevenue, lastYear: lastYearRevenue, projected };
      });

      setMonthlyData(monthlyTotals);
    } catch (error) {
      console.error("Error loading business data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadData();
  }, [userId, loadData]);

  const handleSaveGoal = async () => {
    const newGoal = parseFloat(editValue);
    if (isNaN(newGoal) || newGoal <= 0) {
      toast.error("Please enter a valid goal");
      return;
    }

    try {
      await supabase
        .from("profiles")
        .update({ annual_revenue_goal: newGoal, revenue_goal_year: new Date().getFullYear() })
        .eq("id", userId);

      setGoal(newGoal);
      setEditingGoal(false);
      toast.success("Goal updated!");
    } catch (error) {
      toast.error("Failed to update goal");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  };

  const progressPercent = goal > 0 ? Math.min((stats.totalRevenue / goal) * 100, 100) : 0;

  const statCards = [
    { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: "text-green-600" },
    { label: "Bookings", value: stats.bookingsCount.toString(), icon: CalendarCheck, color: "text-primary" },
    { label: "Avg Fee", value: formatCurrency(stats.averageFee), icon: TrendingUp, color: "text-blue-600" },
    { label: "Outstanding", value: formatCurrency(stats.outstandingInvoices), icon: FileText, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Revenue Goal */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Annual Revenue Goal</p>
              {editingGoal ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl">$</span>
                  <Input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-32 h-8"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveGoal}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingGoal(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{formatCurrency(goal)}</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6"
                    onClick={() => { setEditValue(goal.toString()); setEditingGoal(true); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Progress</p>
              <p className="text-2xl font-bold text-primary">{progressPercent.toFixed(0)}%</p>
            </div>
          </div>
          <Progress value={progressPercent} className="h-3" />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>{formatCurrency(stats.totalRevenue)} earned</span>
            <span>{formatCurrency(Math.max(0, goal - stats.totalRevenue))} to go</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <MonthlyRevenueChart data={monthlyData} />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => setAddBookingOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Booking
          </Button>
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </CardContent>
      </Card>

      <AddBookingDialog
        open={addBookingOpen}
        onOpenChange={setAddBookingOpen}
        userId={userId}
        onSuccess={loadData}
      />
    </div>
  );
}