import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic2, LogOut, User, Sparkles, Calendar, DollarSign, MapPin } from "lucide-react";
import { toast } from "sonner";
import { OpportunityModal } from "@/components/OpportunityModal";

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

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [stats, setStats] = useState({ today: 0, week: 0, applied: 0 });
  const navigate = useNavigate();

  const loadOpportunities = async (userId: string) => {
    try {
      // Fetch ranked opportunities with topics
      const { data: scores, error } = await supabase
        .from('opportunity_scores')
        .select(`
          ai_score,
          ai_reason,
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
        .limit(10);

      if (error) throw error;

      if (!scores || scores.length === 0) {
        // No scores yet, trigger ranking
        toast.info("Finding opportunities for you...");
        const { data: rankData, error: rankError } = await supabase.functions.invoke('rank-opportunities');
        
        if (rankError || rankData?.error) {
          const errorMsg = rankError?.message || rankData?.message || '';
          
          // Check if error is due to incomplete profile
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
        
        // Retry after ranking
        setTimeout(() => loadOpportunities(userId), 3000);
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
      const today = formattedOpps.filter(o => {
        if (!o.deadline) return false;
        const deadline = new Date(o.deadline);
        return deadline.toDateString() === now.toDateString();
      }).length;

      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const week = formattedOpps.filter(o => {
        if (!o.deadline) return false;
        const deadline = new Date(o.deadline);
        return deadline <= weekFromNow;
      }).length;

      // Get applied count
      const { data: appliedData } = await supabase
        .from('applied_logs')
        .select('id')
        .eq('user_id', userId);

      setStats({
        today,
        week,
        applied: appliedData?.length || 0
      });

    } catch (error) {
      console.error('Load opportunities error:', error);
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
      await loadOpportunities(session.user.id);
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
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return "No deadline";
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return "Passed";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    return `${Math.floor(days / 30)} months`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-muted";
  };

  const handleViewDetails = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Mic2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              SpeakFlow
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back! 👋</h1>
          <p className="text-muted-foreground">
            Your speaking opportunities dashboard
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="text-sm text-muted-foreground mb-1">Today's Opportunities</div>
            <div className="text-3xl font-bold">{stats.today}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-muted-foreground mb-1">This Week</div>
            <div className="text-3xl font-bold">{stats.week}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-muted-foreground mb-1">Applied</div>
            <div className="text-3xl font-bold">{stats.applied}</div>
          </Card>
        </div>

        {/* Opportunities List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Top Opportunities</h2>
          {opportunities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mic2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No opportunities yet</p>
              <p className="text-sm">
                Complete your profile to start receiving personalized speaking gigs
              </p>
              <Button 
                className="mt-4 bg-gradient-to-r from-primary to-accent"
                onClick={() => navigate("/profile")}
              >
                Complete Profile
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {opportunities.map((opp) => (
                <Card key={opp.id} className="p-4 hover:border-primary transition-colors cursor-pointer" onClick={() => handleViewDetails(opp)}>
                  <div className="flex items-start gap-4">
                    <div className={`w-16 h-16 rounded-lg ${getScoreColor(opp.ai_score)} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-2xl font-bold text-white">{opp.ai_score}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{opp.event_name}</h3>
                          {opp.organizer_name && (
                            <p className="text-sm text-muted-foreground">{opp.organizer_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {opp.topics.map((topic, i) => (
                          <Badge key={i} variant="secondary">{topic}</Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {opp.deadline && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDeadline(opp.deadline)}
                          </div>
                        )}
                        {opp.fee_estimate_min && opp.fee_estimate_max && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            ${opp.fee_estimate_min.toLocaleString()} - ${opp.fee_estimate_max.toLocaleString()}
                          </div>
                        )}
                        {opp.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {opp.location}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleViewDetails(opp); }}>
                          View Details
                        </Button>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleViewDetails(opp); }}>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Pitch
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </main>

      <OpportunityModal
        opportunity={selectedOpp}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onApplied={() => {
          if (user) loadOpportunities(user.id);
        }}
      />
    </div>
  );
};

export default Dashboard;
