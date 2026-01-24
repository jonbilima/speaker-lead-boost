import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Users, Calendar, ThumbsUp, TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";

interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  ratingTrend: number;
  totalAudience: number;
  recommendRate: number;
  completedEvents: number;
  ratingsByCategory: {
    content: number;
    delivery: number;
    engagement: number;
  };
  ratingsByMonth: { month: string; rating: number }[];
  insights: string[];
}

export function AnalyticsDashboardTab() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all submitted feedback
      const { data: feedback, error } = await supabase
        .from("event_feedback")
        .select("*")
        .eq("speaker_id", user.id)
        .not("submitted_at", "is", null);

      if (error) throw error;

      // Fetch bookings for audience data
      const { data: bookings } = await supabase
        .from("confirmed_bookings")
        .select("id")
        .eq("speaker_id", user.id);

      // Fetch metrics for audience data
      const { data: metrics } = await supabase
        .from("performance_metrics")
        .select("audience_size_actual")
        .eq("speaker_id", user.id);

      const feedbackList = feedback || [];
      const totalFeedback = feedbackList.length;

      if (totalFeedback === 0) {
        setStats({
          totalFeedback: 0,
          averageRating: 0,
          ratingTrend: 0,
          totalAudience: 0,
          recommendRate: 0,
          completedEvents: bookings?.length || 0,
          ratingsByCategory: { content: 0, delivery: 0, engagement: 0 },
          ratingsByMonth: [],
          insights: [],
        });
        setLoading(false);
        return;
      }

      // Calculate averages
      const validRatings = feedbackList.filter((f) => f.overall_rating);
      const averageRating =
        validRatings.reduce((sum, f) => sum + (f.overall_rating || 0), 0) /
        (validRatings.length || 1);

      const contentRatings = feedbackList.filter((f) => f.content_rating);
      const deliveryRatings = feedbackList.filter((f) => f.delivery_rating);
      const engagementRatings = feedbackList.filter((f) => f.engagement_rating);

      const ratingsByCategory = {
        content:
          contentRatings.reduce((sum, f) => sum + (f.content_rating || 0), 0) /
          (contentRatings.length || 1),
        delivery:
          deliveryRatings.reduce((sum, f) => sum + (f.delivery_rating || 0), 0) /
          (deliveryRatings.length || 1),
        engagement:
          engagementRatings.reduce((sum, f) => sum + (f.engagement_rating || 0), 0) /
          (engagementRatings.length || 1),
      };

      // Calculate recommend rate
      const recommendFeedback = feedbackList.filter((f) => f.would_recommend !== null);
      const recommendRate =
        (recommendFeedback.filter((f) => f.would_recommend).length /
          (recommendFeedback.length || 1)) *
        100;

      // Group ratings by month
      const monthlyData: Record<string, number[]> = {};
      feedbackList.forEach((f) => {
        if (f.submitted_at && f.overall_rating) {
          const month = format(new Date(f.submitted_at), "MMM yyyy");
          if (!monthlyData[month]) monthlyData[month] = [];
          monthlyData[month].push(f.overall_rating);
        }
      });

      const ratingsByMonth = Object.entries(monthlyData)
        .map(([month, ratings]) => ({
          month,
          rating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
        }))
        .slice(-12);

      // Calculate trend (last 3 months vs previous 3 months)
      const now = new Date();
      const threeMonthsAgo = subMonths(now, 3);
      const sixMonthsAgo = subMonths(now, 6);

      const recentFeedback = feedbackList.filter(
        (f) => f.submitted_at && new Date(f.submitted_at) >= threeMonthsAgo && f.overall_rating
      );
      const olderFeedback = feedbackList.filter(
        (f) =>
          f.submitted_at &&
          new Date(f.submitted_at) >= sixMonthsAgo &&
          new Date(f.submitted_at) < threeMonthsAgo &&
          f.overall_rating
      );

      const recentAvg =
        recentFeedback.reduce((sum, f) => sum + (f.overall_rating || 0), 0) /
        (recentFeedback.length || 1);
      const olderAvg =
        olderFeedback.reduce((sum, f) => sum + (f.overall_rating || 0), 0) /
        (olderFeedback.length || 1);
      const ratingTrend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

      // Total audience from metrics
      const totalAudience =
        metrics?.reduce((sum, m) => sum + (m.audience_size_actual || 0), 0) || 0;

      // Generate insights
      const insights: string[] = [];
      
      const categories = [
        { name: "Content", rating: ratingsByCategory.content },
        { name: "Delivery", rating: ratingsByCategory.delivery },
        { name: "Engagement", rating: ratingsByCategory.engagement },
      ];
      const best = categories.sort((a, b) => b.rating - a.rating)[0];
      const worst = categories.sort((a, b) => a.rating - b.rating)[0];

      if (best.rating > 0) {
        insights.push(`Your strongest area: ${best.name} (${best.rating.toFixed(1)} avg)`);
      }
      if (worst.rating > 0 && worst.rating < best.rating) {
        insights.push(`Focus area for improvement: ${worst.name}`);
      }
      if (ratingTrend > 5) {
        insights.push(`Great news! Your ratings are trending up ${ratingTrend.toFixed(0)}% this quarter`);
      }
      if (recommendRate >= 90) {
        insights.push(`${recommendRate.toFixed(0)}% of respondents would recommend you!`);
      }

      setStats({
        totalFeedback,
        averageRating,
        ratingTrend,
        totalAudience,
        recommendRate,
        completedEvents: bookings?.length || 0,
        ratingsByCategory,
        ratingsByMonth,
        insights,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const categoryData = [
    { name: "Content", rating: stats.ratingsByCategory.content },
    { name: "Delivery", rating: stats.ratingsByCategory.delivery },
    { name: "Engagement", rating: stats.ratingsByCategory.engagement },
  ];

  return (
    <div className="space-y-6">
      {/* Key Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Average Rating</span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold">
                {stats.averageRating.toFixed(1)}
              </span>
              <span className="text-muted-foreground">/5</span>
              {stats.ratingTrend !== 0 && (
                <span
                  className={`text-sm flex items-center ${
                    stats.ratingTrend > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stats.ratingTrend > 0 ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  )}
                  {Math.abs(stats.ratingTrend).toFixed(0)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Events Completed</span>
            </div>
            <p className="text-3xl font-bold mt-2">{stats.completedEvents}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Audience</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {stats.totalAudience.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Would Recommend</span>
            </div>
            <p className="text-3xl font-bold mt-2">{stats.recommendRate.toFixed(0)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rating Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.ratingsByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stats.ratingsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis domain={[0, 5]} className="text-xs" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Not enough data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ratings by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.totalFeedback > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 5]} className="text-xs" />
                  <YAxis dataKey="name" type="category" width={80} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="rating" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Not enough data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {stats.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {stats.insights.map((insight, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-primary">{i + 1}</span>
                  </div>
                  <p className="text-sm">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
