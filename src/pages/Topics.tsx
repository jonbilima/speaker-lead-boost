import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Target, TrendingUp, TrendingDown, Sparkles, Plus, Minus, Check, Lightbulb, Flame, ChartBar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TopicsMatchWidget } from "@/components/topics/TopicsMatchWidget";
import { TopicDemandChart } from "@/components/topics/TopicDemandChart";
import { GapAnalysisSection } from "@/components/topics/GapAnalysisSection";
import { TopicCombinationsSection } from "@/components/topics/TopicCombinationsSection";
import { TopicTrendsSection } from "@/components/topics/TopicTrendsSection";
import { OptimizeTopicsDialog } from "@/components/topics/OptimizeTopicsDialog";

interface Topic {
  id: string;
  name: string;
  category: string | null;
}

interface TopicWithStats {
  id: string;
  name: string;
  count: number;
  userHas: boolean;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface UserTopic {
  topic_id: string;
  topics: Topic;
}

const Topics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userTopics, setUserTopics] = useState<Topic[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [topicStats, setTopicStats] = useState<TopicWithStats[]>([]);
  const [matchPercentage, setMatchPercentage] = useState(0);
  const [topicCombinations, setTopicCombinations] = useState<{ topic1: string; topic2: string; count: number }[]>([]);
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserId(session.user.id);
    setLoading(true);

    // Load all data in parallel
    const [userTopicsResult, allTopicsResult, opportunityTopicsResult, historicalResult] = await Promise.all([
      // User's selected topics
      supabase
        .from("user_topics")
        .select("topic_id, topics(id, name, category)")
        .eq("user_id", session.user.id),
      
      // All available topics
      supabase
        .from("topics")
        .select("id, name, category"),
      
      // Opportunity topics (current demand)
      supabase
        .from("opportunity_topics")
        .select("topic_id, opportunities!inner(is_active)")
        .eq("opportunities.is_active", true),
      
      // Historical opportunity topics (for trends - last 60 days)
      supabase
        .from("opportunity_topics")
        .select("topic_id, opportunities!inner(created_at)")
        .gte("opportunities.created_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    if (userTopicsResult.data) {
      const topics = (userTopicsResult.data as unknown as UserTopic[])
        .map(ut => ut.topics)
        .filter(Boolean);
      setUserTopics(topics);
    }

    if (allTopicsResult.data) {
      setAllTopics(allTopicsResult.data);
    }

    // Calculate topic stats
    if (opportunityTopicsResult.data && allTopicsResult.data) {
      const topicCounts: Record<string, number> = {};
      const recentCounts: Record<string, number> = {};
      const olderCounts: Record<string, number> = {};

      opportunityTopicsResult.data.forEach((ot: any) => {
        topicCounts[ot.topic_id] = (topicCounts[ot.topic_id] || 0) + 1;
      });

      // Calculate trends (last 30 days vs previous 30 days)
      if (historicalResult.data) {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        historicalResult.data.forEach((ot: any) => {
          const createdAt = new Date(ot.opportunities.created_at).getTime();
          if (createdAt >= thirtyDaysAgo) {
            recentCounts[ot.topic_id] = (recentCounts[ot.topic_id] || 0) + 1;
          } else {
            olderCounts[ot.topic_id] = (olderCounts[ot.topic_id] || 0) + 1;
          }
        });
      }

      const userTopicIds = new Set(userTopicsResult.data?.map((ut: any) => ut.topic_id) || []);

      const stats: TopicWithStats[] = allTopicsResult.data.map(topic => {
        const count = topicCounts[topic.id] || 0;
        const recent = recentCounts[topic.id] || 0;
        const older = olderCounts[topic.id] || 0;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        let trendValue = 0;
        
        if (older > 0) {
          trendValue = ((recent - older) / older) * 100;
          if (trendValue > 10) trend = 'up';
          else if (trendValue < -10) trend = 'down';
        } else if (recent > 0) {
          trend = 'up';
          trendValue = 100;
        }

        return {
          id: topic.id,
          name: topic.name,
          count,
          userHas: userTopicIds.has(topic.id),
          trend,
          trendValue
        };
      }).sort((a, b) => b.count - a.count);

      setTopicStats(stats);

      // Calculate match percentage
      const userTopicIds2 = Array.from(userTopicIds);
      const matchingTopics = userTopicIds2.filter(id => topicCounts[id] > 0);
      const matchPct = userTopicIds2.length > 0 
        ? Math.round((matchingTopics.length / userTopicIds2.length) * 100) 
        : 0;
      setMatchPercentage(matchPct);

      // Calculate topic combinations
      await calculateCombinations();
    }

    setLoading(false);
  }, [navigate]);

  const calculateCombinations = async () => {
    // Get opportunities with multiple topics
    const { data: oppsWithTopics } = await supabase
      .from("opportunity_topics")
      .select("opportunity_id, topic_id, topics(name)");

    if (!oppsWithTopics) return;

    // Group by opportunity
    const oppTopics: Record<string, string[]> = {};
    oppsWithTopics.forEach((ot: any) => {
      if (!oppTopics[ot.opportunity_id]) {
        oppTopics[ot.opportunity_id] = [];
      }
      if (ot.topics?.name) {
        oppTopics[ot.opportunity_id].push(ot.topics.name);
      }
    });

    // Count pairs
    const pairCounts: Record<string, number> = {};
    Object.values(oppTopics).forEach(topics => {
      if (topics.length < 2) return;
      for (let i = 0; i < topics.length; i++) {
        for (let j = i + 1; j < topics.length; j++) {
          const pair = [topics[i], topics[j]].sort().join("|||");
          pairCounts[pair] = (pairCounts[pair] || 0) + 1;
        }
      }
    });

    // Get top combinations
    const combinations = Object.entries(pairCounts)
      .map(([pair, count]) => {
        const [topic1, topic2] = pair.split("|||");
        return { topic1, topic2, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setTopicCombinations(combinations);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddTopic = async (topicId: string) => {
    if (!userId) return;

    const { error } = await supabase.from("user_topics").insert({
      user_id: userId,
      topic_id: topicId
    });

    if (error) {
      toast.error("Failed to add topic");
    } else {
      toast.success("Topic added to your profile");
      loadData();
    }
  };

  const handleRemoveTopic = async (topicId: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from("user_topics")
      .delete()
      .eq("user_id", userId)
      .eq("topic_id", topicId);

    if (error) {
      toast.error("Failed to remove topic");
    } else {
      toast.success("Topic removed from your profile");
      loadData();
    }
  };

  // Get hot and declining topics
  const hotTopics = topicStats.filter(t => t.trend === 'up' && t.count > 0).slice(0, 5);
  const decliningTopics = topicStats.filter(t => t.trend === 'down' && t.count > 0).slice(0, 5);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="h-6 w-6 text-violet-600" />
              Topics Analyzer
            </h1>
            <p className="text-muted-foreground mt-1">
              Optimize your topic positioning based on market demand
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={() => setOptimizeDialogOpen(true)}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Optimize My Topics
            </Button>
          </div>
        </div>

        {/* Top Row - Summary Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Topics Match Widget */}
          <TopicsMatchWidget
            matchPercentage={matchPercentage}
            userTopics={userTopics}
            topicStats={topicStats}
          />

          {/* Hot Topics */}
          <Card className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Flame className="h-5 w-5 text-orange-500" />
              Hot Right Now
            </h3>
            <div className="space-y-2">
              {hotTopics.length > 0 ? hotTopics.map(topic => (
                <div key={topic.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{topic.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {topic.count} events
                    </Badge>
                    {topic.userHas ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleAddTopic(topic.id)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Analyzing trends...</p>
              )}
            </div>
          </Card>

          {/* Declining Topics */}
          <Card className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5 text-gray-500" />
              Declining Interest
            </h3>
            <div className="space-y-2">
              {decliningTopics.length > 0 ? decliningTopics.map(topic => (
                <div key={topic.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-muted-foreground">{topic.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {topic.count} events
                    </Badge>
                    {topic.userHas && (
                      <Badge variant="outline" className="text-xs text-amber-600">
                        You have this
                      </Badge>
                    )}
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No declining topics detected</p>
              )}
            </div>
          </Card>
        </div>

        {/* Your Selected Topics */}
        <Card className="p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <ChartBar className="h-5 w-5 text-violet-600" />
            Your Topics ({userTopics.length})
          </h3>
          {userTopics.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>You haven't selected any topics yet</p>
              <Button 
                variant="link" 
                className="mt-2"
                onClick={() => navigate("/profile")}
              >
                Go to Profile to add topics
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {userTopics.map(topic => {
                const stat = topicStats.find(t => t.id === topic.id);
                return (
                  <Badge 
                    key={topic.id} 
                    variant="secondary"
                    className="px-3 py-1.5 text-sm flex items-center gap-2"
                  >
                    {topic.name}
                    {stat && (
                      <span className="text-xs text-muted-foreground">
                        ({stat.count} events)
                      </span>
                    )}
                    {stat?.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                    {stat?.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
                    <button
                      onClick={() => handleRemoveTopic(topic.id)}
                      className="ml-1 hover:text-red-600"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </Card>

        {/* Topic Demand Chart */}
        <TopicDemandChart topicStats={topicStats} />

        {/* Gap Analysis */}
        <GapAnalysisSection
          topicStats={topicStats}
          userTopics={userTopics}
          onAddTopic={handleAddTopic}
        />

        {/* Topic Combinations */}
        <TopicCombinationsSection
          combinations={topicCombinations}
          userTopics={userTopics}
          onAddTopic={handleAddTopic}
          allTopics={allTopics}
        />

        {/* Topic Trends */}
        <TopicTrendsSection topicStats={topicStats} />
      </div>

      <OptimizeTopicsDialog
        open={optimizeDialogOpen}
        onOpenChange={setOptimizeDialogOpen}
        topicStats={topicStats}
        userTopics={userTopics}
        onAddTopic={handleAddTopic}
        onRemoveTopic={handleRemoveTopic}
        onSuccess={loadData}
      />
    </AppLayout>
  );
};

export default Topics;
