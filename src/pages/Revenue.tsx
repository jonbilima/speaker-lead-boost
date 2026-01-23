import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { DollarSign, Plus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RevenueGoalHeader } from "@/components/revenue/RevenueGoalHeader";
import { RevenueStats } from "@/components/revenue/RevenueStats";
import { MonthlyRevenueChart } from "@/components/revenue/MonthlyRevenueChart";
import { BookingsTable, Booking } from "@/components/revenue/BookingsTable";
import { AddBookingDialog } from "@/components/revenue/AddBookingDialog";
import { useConfetti } from "@/hooks/useConfetti";

interface MonthlyData {
  month: string;
  shortMonth: string;
  current: number;
  lastYear: number;
  projected?: number;
}

const Revenue = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [goal, setGoal] = useState(100000);
  const [goalYear, setGoalYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({
    totalConfirmed: 0,
    totalReceived: 0,
    pipelineValue: 0,
    winRate: 0,
    averageFee: 0,
    bookingsThisYear: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const navigate = useNavigate();

  const progressPercent = goal > 0 ? (stats.totalConfirmed / goal) * 100 : 0;
  useConfetti(progressPercent, user?.id || null);

  const loadData = useCallback(async (userId: string) => {
    try {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Load profile for goal
      const { data: profile } = await supabase
        .from("profiles")
        .select("annual_revenue_goal, revenue_goal_year")
        .eq("id", userId)
        .single();

      if (profile) {
        setGoal(profile.annual_revenue_goal || 100000);
        setGoalYear(profile.revenue_goal_year || currentYear);
      }

      // Load bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("confirmed_bookings")
        .select("*")
        .eq("speaker_id", userId)
        .order("event_date", { ascending: false });

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);

      // Calculate stats
      const thisYearBookings = (bookingsData || []).filter((b) => {
        if (!b.event_date) return true;
        return new Date(b.event_date).getFullYear() === currentYear;
      });

      const activeBookings = thisYearBookings.filter(
        (b) => b.payment_status !== "cancelled"
      );

      const totalConfirmed = activeBookings.reduce(
        (sum, b) => sum + (b.confirmed_fee || 0),
        0
      );
      const totalReceived = activeBookings.reduce(
        (sum, b) => sum + (b.amount_paid || 0),
        0
      );
      const averageFee =
        activeBookings.length > 0 ? totalConfirmed / activeBookings.length : 0;

      // Load pipeline value
      const { data: pipelineData } = await supabase
        .from("opportunity_scores")
        .select(
          `
          pipeline_stage,
          opportunities (
            fee_estimate_max
          )
        `
        )
        .eq("user_id", userId)
        .in("pipeline_stage", ["pitched", "negotiating"]);

      const pipelineValue = (pipelineData || []).reduce(
        (sum, p) => sum + (p.opportunities?.fee_estimate_max || 0),
        0
      );

      // Calculate win rate
      const { count: acceptedCount } = await supabase
        .from("opportunity_scores")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("pipeline_stage", "accepted");

      const { count: rejectedCount } = await supabase
        .from("opportunity_scores")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("pipeline_stage", "rejected");

      const total = (acceptedCount || 0) + (rejectedCount || 0);
      const winRate = total > 0 ? ((acceptedCount || 0) / total) * 100 : 0;

      setStats({
        totalConfirmed,
        totalReceived,
        pipelineValue,
        winRate,
        averageFee,
        bookingsThisYear: activeBookings.length,
      });

      // Calculate monthly data
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      const currentMonth = new Date().getMonth();
      const monthlyTotals: MonthlyData[] = months.map((month, index) => {
        const currentMonthRevenue = (bookingsData || [])
          .filter((b) => {
            if (!b.event_date || b.payment_status === "cancelled") return false;
            const date = new Date(b.event_date);
            return date.getFullYear() === currentYear && date.getMonth() === index;
          })
          .reduce((sum, b) => sum + (b.confirmed_fee || 0), 0);

        const lastYearRevenue = (bookingsData || [])
          .filter((b) => {
            if (!b.event_date || b.payment_status === "cancelled") return false;
            const date = new Date(b.event_date);
            return date.getFullYear() === lastYear && date.getMonth() === index;
          })
          .reduce((sum, b) => sum + (b.confirmed_fee || 0), 0);

        // Calculate projected for future months
        let projected: number | undefined;
        if (index > currentMonth && currentMonth > 0) {
          const avgMonthlyRevenue = totalConfirmed / (currentMonth + 1);
          projected = avgMonthlyRevenue;
        }

        return {
          month,
          shortMonth: shortMonths[index],
          current: currentMonthRevenue,
          lastYear: lastYearRevenue,
          projected,
        };
      });

      setMonthlyData(monthlyTotals);
    } catch (error) {
      console.error("Error loading revenue data:", error);
      toast.error("Failed to load revenue data");
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await loadData(session.user.id);
      setLoading(false);
    };

    checkAuth();
  }, [navigate, loadData]);

  const handleRefresh = async () => {
    if (user) {
      setLoading(true);
      await loadData(user.id);
      setLoading(false);
    }
  };

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingBooking(null);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-600" />
              Revenue Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your speaking income and financial goals
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Booking
            </Button>
          </div>
        </div>

        {/* Revenue Goal Progress */}
        <RevenueGoalHeader
          goal={goal}
          goalYear={goalYear}
          currentRevenue={stats.totalConfirmed}
          userId={user?.id}
          onGoalUpdate={(newGoal) => setGoal(newGoal)}
        />

        {/* Stats Row */}
        <RevenueStats
          totalConfirmed={stats.totalConfirmed}
          totalReceived={stats.totalReceived}
          pipelineValue={stats.pipelineValue}
          winRate={stats.winRate}
          averageFee={stats.averageFee}
          bookingsThisYear={stats.bookingsThisYear}
        />

        {/* Monthly Chart */}
        <MonthlyRevenueChart data={monthlyData} />

        {/* Bookings Table */}
        <BookingsTable
          bookings={bookings}
          onEdit={handleEditBooking}
          onRefresh={handleRefresh}
        />
      </div>

      <AddBookingDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        userId={user?.id}
        onSuccess={handleRefresh}
        editingBooking={editingBooking}
      />
    </AppLayout>
  );
};

export default Revenue;
