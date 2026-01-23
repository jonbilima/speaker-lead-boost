import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OpportunityModal } from "@/components/OpportunityModal";
import { AppLayout } from "@/components/AppLayout";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { TopOpportunities } from "@/components/dashboard/TopOpportunities";
import { FollowUpsDue } from "@/components/dashboard/FollowUpsDue";
import { FollowUpEmailDialog } from "@/components/dashboard/FollowUpEmailDialog";
import { InboundLeadsWidget } from "@/components/dashboard/InboundLeadsWidget";
import { OrganizerResearchSheet } from "@/components/organizer/OrganizerResearchSheet";
import { useFollowUpReminders } from "@/hooks/useFollowUpReminders";

interface Opportunity {
  id: string;
  event_name: string;
  organizer_name: string | null;
  organizer_email: string | null;
  description: string | null;
  deadline: string | null;
  fee_estimate_min: number | null;
  fee_estimate_max: number | null;
  event_date: string | null;
  location: string | null;
  audience_size: number | null;
  event_url: string | null;
  ai_score: number;
  ai_reason: string | null;
  topics: string[];
}

interface Deadline {
  id: string;
  event_name: string;
  deadline: string;
  daysRemaining: number;
}

interface ActivityItem {
  id: string;
  activity_type: string;
  created_at: string;
  subject?: string | null;
  notes?: string | null;
}

interface CalendarEntry {
  id: string;
  title: string;
  start_date: string;
  start_time?: string | null;
  location?: string | null;
  is_virtual?: boolean;
  entry_type: string;
}

interface Stats {
  today: number;
  week: number;
  applied: number;
  accepted: number;
}

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({ today: 0, week: 0, applied: 0, accepted: 0 });
  const [followUpEmailOpen, setFollowUpEmailOpen] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<{ opportunityId: string; reminderType: string } | null>(null);
  const [researchSheetOpen, setResearchSheetOpen] = useState(false);
  const [researchOrganizer, setResearchOrganizer] = useState<{ name: string; email?: string | null } | null>(null);
  const navigate = useNavigate();
  
  const { reminders, refresh: refreshReminders } = useFollowUpReminders(user?.id || null);

  const loadDashboardData = useCallback(async (userId: string) => {
    try {
      // Load all data in parallel
      const [scoresResult, deadlinesResult, activitiesResult, calendarResult] = await Promise.all([
        // Fetch opportunity scores with opportunities
        supabase
          .from('opportunity_scores')
          .select(`
            ai_score,
            ai_reason,
            pipeline_stage,
            calculated_at,
            opportunities (
              id,
              event_name,
              organizer_name,
              organizer_email,
              description,
              deadline,
              fee_estimate_min,
              fee_estimate_max,
              event_date,
              location,
              audience_size,
              event_url,
              opportunity_topics (
                topics (
                  name
                )
              )
            )
          `)
          .eq('user_id', userId)
          .order('ai_score', { ascending: false })
          .limit(10),
        
        // Fetch upcoming deadlines (next 14 days)
        supabase
          .from('opportunities')
          .select('id, event_name, deadline')
          .gte('deadline', new Date().toISOString())
          .lte('deadline', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
          .order('deadline', { ascending: true })
          .limit(10),
        
        // Fetch recent activities
        supabase
          .from('outreach_activities')
          .select('id, activity_type, created_at, subject, notes')
          .eq('speaker_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        
        // Fetch upcoming calendar entries
        supabase
          .from('speaker_calendar')
          .select('id, title, start_date, start_time, location, is_virtual, entry_type')
          .eq('speaker_id', userId)
          .gte('start_date', new Date().toISOString().split('T')[0])
          .order('start_date', { ascending: true })
          .limit(3)
      ]);

      // Process opportunities
      if (scoresResult.error) throw scoresResult.error;
      
      const scores = scoresResult.data || [];
      
      if (scores.length === 0) {
        // No scores yet, trigger ranking
        toast.info("Finding opportunities for you...");
        const { data: rankData, error: rankError } = await supabase.functions.invoke('rank-opportunities');
        
        if (rankError || rankData?.error) {
          const errorMsg = rankError?.message || rankData?.message || '';
          
          if (errorMsg.includes('No topics selected') || errorMsg.includes('complete your profile')) {
            toast.error('Please complete your profile with speaking topics first', {
              action: {
                label: 'Go to Profile',
                onClick: () => navigate('/profile')
              }
            });
            setLoading(false);
            return;
          }
          
          toast.error('Failed to rank opportunities. Please try again.');
          setLoading(false);
          return;
        }
        
        setTimeout(() => loadDashboardData(userId), 3000);
        return;
      }

      const formattedOpps: Opportunity[] = scores.map((score: any) => ({
        id: score.opportunities.id,
        event_name: score.opportunities.event_name,
        organizer_name: score.opportunities.organizer_name,
        organizer_email: score.opportunities.organizer_email,
        description: score.opportunities.description,
        deadline: score.opportunities.deadline,
        fee_estimate_min: score.opportunities.fee_estimate_min,
        fee_estimate_max: score.opportunities.fee_estimate_max,
        event_date: score.opportunities.event_date,
        location: score.opportunities.location,
        audience_size: score.opportunities.audience_size,
        event_url: score.opportunities.event_url,
        ai_score: score.ai_score,
        ai_reason: score.ai_reason,
        topics: score.opportunities.opportunity_topics?.map((ot: any) => ot.topics.name) || []
      }));

      setOpportunities(formattedOpps);

      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const todayCount = scores.filter((s: any) => 
        new Date(s.calculated_at) >= todayStart
      ).length;

      const weekCount = scores.filter((s: any) => 
        new Date(s.calculated_at) >= weekAgo
      ).length;

      const appliedCount = scores.filter((s: any) => 
        s.pipeline_stage === 'applied'
      ).length;

      const acceptedCount = scores.filter((s: any) => 
        s.pipeline_stage === 'accepted'
      ).length;

      setStats({ today: todayCount, week: weekCount, applied: appliedCount, accepted: acceptedCount });

      // Process deadlines
      if (!deadlinesResult.error && deadlinesResult.data) {
        const formattedDeadlines: Deadline[] = deadlinesResult.data.map((d: any) => ({
          id: d.id,
          event_name: d.event_name,
          deadline: d.deadline,
          daysRemaining: Math.ceil((new Date(d.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }));
        setDeadlines(formattedDeadlines);
      }

      // Process activities
      if (!activitiesResult.error && activitiesResult.data) {
        setActivities(activitiesResult.data);
      }

      // Process calendar entries
      if (!calendarResult.error && calendarResult.data) {
        setCalendarEntries(calendarResult.data);
      }

    } catch (error) {
      console.error('Load dashboard error:', error);
      toast.error('Failed to load dashboard data');
    }
  }, [navigate]);

  const handleRefreshOpportunities = async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('rank-opportunities');
      if (error) throw error;
      
      toast.success('Refreshing opportunities...');
      setTimeout(() => {
        loadDashboardData(user.id);
        setRefreshing(false);
      }, 3000);
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error('Failed to refresh opportunities');
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }
      
      setUser(session.user);
      await loadDashboardData(session.user.id);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, loadDashboardData]);

  const handleViewDetails = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setModalOpen(true);
  };

  const handleResearchOrganizer = (organizerName: string, organizerEmail?: string | null) => {
    setResearchOrganizer({ name: organizerName, email: organizerEmail });
    setResearchSheetOpen(true);
  };

  if (loading) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome back! 👋</h1>
          <p className="text-muted-foreground">
            Your speaking opportunities dashboard
          </p>
        </div>

        {/* Stats Row */}
        <DashboardStats
          todayCount={stats.today}
          weekCount={stats.week}
          appliedCount={stats.applied}
          acceptedCount={stats.accepted}
        />

        {/* Quick Actions */}
        <QuickActions 
          onRefreshOpportunities={handleRefreshOpportunities}
          isRefreshing={refreshing}
        />

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Top Opportunities */}
          <div className="lg:col-span-2">
            <TopOpportunities
              opportunities={opportunities}
              onViewDetails={handleViewDetails}
              onResearchOrganizer={handleResearchOrganizer}
              loading={loading}
            />
          </div>

          {/* Right Column - Widgets */}
          <div className="space-y-6">
            <FollowUpsDue
              reminders={reminders}
              onUpdate={refreshReminders}
              onGenerateFollowUp={(opportunityId, reminderType) => {
                setSelectedFollowUp({ opportunityId, reminderType });
                setFollowUpEmailOpen(true);
              }}
            />
            <InboundLeadsWidget />
            <UpcomingDeadlines deadlines={deadlines} />
            <RecentActivity activities={activities} />
            <CalendarWidget entries={calendarEntries} />
          </div>
        </div>
      </div>

      <OrganizerResearchSheet
        open={researchSheetOpen}
        onOpenChange={setResearchSheetOpen}
        organizerName={researchOrganizer?.name || null}
        organizerEmail={researchOrganizer?.email}
      />

      <OpportunityModal
        opportunity={selectedOpp}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onApplied={() => {
          if (user) loadDashboardData(user.id);
        }}
      />

      {selectedFollowUp && (
        <FollowUpEmailDialog
          open={followUpEmailOpen}
          onOpenChange={setFollowUpEmailOpen}
          opportunityId={selectedFollowUp.opportunityId}
          reminderType={selectedFollowUp.reminderType}
        />
      )}
    </AppLayout>
  );
};

export default Dashboard;
