import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FunnelStep {
  name: string;
  count: number;
  percentage: number;
  dropoff: number;
  users?: { id: string; name: string | null; email?: string }[];
}

export function OnboardingFunnelTab() {
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  useEffect(() => {
    fetchFunnelData();
  }, []);

  const fetchFunnelData = async () => {
    setLoading(true);
    try {
      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, bio, headline');

      const allUsers = profiles || [];
      const totalUsers = allUsers.length;

      // Step 1: Signed up (all profiles)
      const signedUp = totalUsers;

      // Step 2: Completed profile (has bio or headline)
      const completedProfile = allUsers.filter(p => p.bio || p.headline).length;

      // Step 3: Uploaded headshot (check speaker_assets)
      const { data: headshots } = await supabase
        .from('speaker_assets')
        .select('speaker_id')
        .eq('asset_type', 'headshot');
      const uploadedHeadshot = new Set((headshots || []).map(h => h.speaker_id)).size;

      // Step 4: Viewed opportunities (has opportunity_scores)
      const { data: viewedOpps } = await supabase
        .from('opportunity_scores')
        .select('user_id');
      const viewedOpportunities = new Set((viewedOpps || []).map(o => o.user_id)).size;

      // Step 5: Generated first pitch
      const { data: pitches } = await supabase
        .from('pitches')
        .select('user_id');
      const generatedPitch = new Set((pitches || []).map(p => p.user_id)).size;

      // Step 6: Applied to first opportunity
      const { data: applications } = await supabase
        .from('applied_logs')
        .select('user_id');
      const appliedToOpp = new Set((applications || []).map(a => a.user_id)).size;

      // Build funnel
      const steps = [
        { name: 'Signed Up', count: signedUp },
        { name: 'Completed Profile', count: completedProfile },
        { name: 'Uploaded Headshot', count: uploadedHeadshot },
        { name: 'Viewed Opportunities', count: viewedOpportunities },
        { name: 'Generated First Pitch', count: generatedPitch },
        { name: 'Applied to Opportunity', count: appliedToOpp },
      ];

      const funnelData: FunnelStep[] = steps.map((step, index) => {
        const percentage = totalUsers > 0 ? (step.count / totalUsers) * 100 : 0;
        const prevCount = index > 0 ? steps[index - 1].count : step.count;
        const dropoff = prevCount > 0 ? ((prevCount - step.count) / prevCount) * 100 : 0;

        return {
          name: step.name,
          count: step.count,
          percentage,
          dropoff: index === 0 ? 0 : dropoff,
        };
      });

      setFunnel(funnelData);
    } catch (error) {
      console.error('Error fetching funnel data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDropoffColor = (dropoff: number) => {
    if (dropoff > 50) return 'text-red-500';
    if (dropoff > 30) return 'text-orange-500';
    if (dropoff > 15) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Funnel</CardTitle>
          <CardDescription>User journey from signup to first application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {funnel.map((step, index) => (
            <div key={step.name} className="relative">
              <div
                className={cn(
                  "border rounded-lg p-4 transition-colors cursor-pointer hover:bg-muted/50",
                  expandedStep === step.name && "bg-muted/50"
                )}
                onClick={() => setExpandedStep(expandedStep === step.name ? null : step.name)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                      step.percentage > 50 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                      step.percentage > 20 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                      "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{step.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {step.count} users ({step.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {step.dropoff > 0 && (
                      <Badge variant="outline" className={cn("font-normal", getDropoffColor(step.dropoff))}>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {step.dropoff.toFixed(1)}% drop-off
                      </Badge>
                    )}
                    {expandedStep === step.name ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                
                <Progress 
                  value={step.percentage} 
                  className="h-3"
                />
              </div>

              {/* Connector line */}
              {index < funnel.length - 1 && (
                <div className="absolute left-7 top-full h-4 w-0.5 bg-border" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Biggest Drop-off Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnel
                .filter(s => s.dropoff > 0)
                .sort((a, b) => b.dropoff - a.dropoff)
                .slice(0, 3)
                .map((step) => (
                  <div key={step.name} className="flex justify-between items-center">
                    <span className="text-sm">{step.name}</span>
                    <Badge variant="destructive">{step.dropoff.toFixed(1)}%</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Key Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Profile Completion Rate</span>
                <Badge variant="outline">
                  {funnel[1]?.percentage.toFixed(1) || 0}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Engagement Rate</span>
                <Badge variant="outline">
                  {funnel[3]?.percentage.toFixed(1) || 0}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Conversion Rate</span>
                <Badge variant="outline">
                  {funnel[5]?.percentage.toFixed(1) || 0}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
