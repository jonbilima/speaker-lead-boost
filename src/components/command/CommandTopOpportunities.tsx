import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  Star,
  MapPin,
  DollarSign,
  Calendar,
  ExternalLink,
  ThumbsDown,
  Bookmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { differenceInDays, format } from "date-fns";

interface TopOpportunity {
  id: string;
  event_name: string;
  organizer_name: string | null;
  ai_score: number;
  fee_estimate_min: number | null;
  fee_estimate_max: number | null;
  deadline: string | null;
  location: string | null;
  score_id: string;
}

interface CommandTopOpportunitiesProps {
  userId: string;
  onRefresh?: () => void;
}

export function CommandTopOpportunities({ userId, onRefresh }: CommandTopOpportunitiesProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem("command_opportunities_collapsed");
    return stored !== "true";
  });
  const [opportunities, setOpportunities] = useState<TopOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem("command_opportunities_collapsed", (!isOpen).toString());
  }, [isOpen]);

  useEffect(() => {
    loadOpportunities();
  }, [userId]);

  const loadOpportunities = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunity_scores")
        .select(`
          id,
          ai_score,
          opportunities!inner (
            id,
            event_name,
            organizer_name,
            fee_estimate_min,
            fee_estimate_max,
            deadline,
            location
          )
        `)
        .eq("user_id", userId)
        .eq("pipeline_stage", "new")
        .order("ai_score", { ascending: false })
        .limit(5);

      if (error) throw error;

      const formattedOpps: TopOpportunity[] = (data || []).map((d: any) => ({
        id: d.opportunities.id,
        score_id: d.id,
        event_name: d.opportunities.event_name,
        organizer_name: d.opportunities.organizer_name,
        ai_score: d.ai_score,
        fee_estimate_min: d.opportunities.fee_estimate_min,
        fee_estimate_max: d.opportunities.fee_estimate_max,
        deadline: d.opportunities.deadline,
        location: d.opportunities.location,
      }));

      setOpportunities(formattedOpps);
    } catch (error) {
      console.error("Error loading opportunities:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatFee = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `From $${min.toLocaleString()}`;
    if (max) return `Up to $${max.toLocaleString()}`;
    return null;
  };

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const days = differenceInDays(new Date(deadline), new Date());
    if (days < 0) return "Expired";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days <= 7) return `${days} days`;
    return format(new Date(deadline), "MMM d");
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    if (score >= 60) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
    return "bg-muted text-muted-foreground";
  };

  const handleSave = async (scoreId: string) => {
    const { error } = await supabase
      .from("opportunity_scores")
      .update({ pipeline_stage: "interested", interested_at: new Date().toISOString() })
      .eq("id", scoreId);

    if (error) {
      toast.error("Failed to save opportunity");
    } else {
      toast.success("Saved to pipeline");
      loadOpportunities();
      onRefresh?.();
    }
  };

  const handlePass = async (scoreId: string) => {
    const { error } = await supabase
      .from("opportunity_scores")
      .update({ pipeline_stage: "rejected", rejected_at: new Date().toISOString() })
      .eq("id", scoreId);

    if (error) {
      toast.error("Failed to pass opportunity");
    } else {
      toast.success("Opportunity passed");
      loadOpportunities();
      onRefresh?.();
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-primary" />
                Top Opportunities
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No new opportunities found.</p>
                <Button
                  variant="link"
                  onClick={() => navigate("/find")}
                  className="mt-2"
                >
                  Discover opportunities
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{opp.event_name}</span>
                          <Badge className={`text-xs ${getScoreColor(opp.ai_score)}`}>
                            {Math.round(opp.ai_score)}%
                          </Badge>
                        </div>
                        
                        {opp.organizer_name && (
                          <div className="text-sm text-muted-foreground mb-2">
                            {opp.organizer_name}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {formatFee(opp.fee_estimate_min, opp.fee_estimate_max) && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {formatFee(opp.fee_estimate_min, opp.fee_estimate_max)}
                            </span>
                          )}
                          {opp.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {opp.location}
                            </span>
                          )}
                          {formatDeadline(opp.deadline) && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDeadline(opp.deadline)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSave(opp.score_id)}
                          className="h-8 w-8 p-0"
                          title="Save to pipeline"
                        >
                          <Bookmark className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePass(opp.score_id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Pass"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => navigate("/pipeline")}
                          className="h-8"
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/find")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Discover More
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
