import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { CommandStats } from "@/components/command/CommandStats";
import { ActionRequired } from "@/components/command/ActionRequired";
import { CommandTopOpportunities } from "@/components/command/CommandTopOpportunities";
import { WeekCalendar } from "@/components/command/WeekCalendar";
import { RecentActivityFeed } from "@/components/command/RecentActivityFeed";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    revenueGoal: 100000,
    newMatches: 0,
    matchesTrend: "flat" as "up" | "down" | "flat",
    activePipeline: 0,
    responseRate: 0,
    responseRateTrend: "flat" as "up" | "down" | "flat",
  });
  const navigate = useNavigate();

  const loadStats = useCallback(async (userId: string) => {
    try {
      const [profileResult, revenueResult, pipelineResult, matchesResult] = await Promise.all([
        supabase.from("profiles").select("annual_revenue_goal").eq("id", userId).single(),
        supabase.from("confirmed_bookings").select("confirmed_fee").eq("speaker_id", userId),
        supabase.from("opportunity_scores").select("id, pipeline_stage").eq("user_id", userId).not("pipeline_stage", "in", '("accepted","rejected","completed")'),
        supabase.from("opportunity_scores").select("id, calculated_at").eq("user_id", userId).gte("calculated_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const revenueGoal = profileResult.data?.annual_revenue_goal || 100000;
      const revenue = (revenueResult.data || []).reduce((sum: number, b: any) => sum + (b.confirmed_fee || 0), 0);
      const activePipeline = (pipelineResult.data || []).length;
      const newMatches = (matchesResult.data || []).length;

      setStats({
        revenue,
        revenueGoal,
        newMatches,
        matchesTrend: newMatches > 5 ? "up" : "flat",
        activePipeline,
        responseRate: 24,
        responseRateTrend: "up",
      });
    } catch (error) {
      console.error("Error loading stats:", error);
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
      await loadStats(session.user.id);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth");
      else setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [navigate, loadStats]);

  if (loading || !user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Command Center</h1>
          <p className="text-muted-foreground">Your speaking business at a glance</p>
        </div>

        <CommandStats {...stats} />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ActionRequired userId={user.id} onRefresh={() => loadStats(user.id)} />
            <CommandTopOpportunities userId={user.id} onRefresh={() => loadStats(user.id)} />
          </div>
          <div className="space-y-6">
            <WeekCalendar userId={user.id} />
            <RecentActivityFeed userId={user.id} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
